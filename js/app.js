// Interface de Logger : calendriers de suivi, saisies, stats, croisements, sauvegarde, verrou.
import * as S from './store.js';
import * as A from './analyse.js';
import * as G from './graph.js';
import * as V from './verrou.js';
import { exemple } from './demo.js';
import {
  aujourdhui, heureMaintenant, ajouterJours, ecartJours, jourSemaine, dateCourte, dateNum, dateLongue,
  JOURS, JOURS_COURTS, MOIS_COURTS, texteHeure, texteDuree, nombre, pct, pluriel, ilYA, majuscule, minutesDe,
} from './calc.js';

const app = document.getElementById('app');
const couche = document.getElementById('couche');
const toastEl = document.getElementById('toast');
const verrouEl = document.getElementById('verrou');

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const I = {
  retour: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  droite: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  croix: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  stats: '<svg viewBox="0 0 24 24"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
  reglages: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  partage: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  lien: '<svg viewBox="0 0 24 24"><circle cx="8" cy="12" r="4.5"/><circle cx="16" cy="12" r="4.5"/></svg>',
  haut: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  bas: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  horloge: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l2.5 2"/></svg>',
  soleil: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6L18 18M6 18l1.4-1.4M16.6 7.4L18 6"/></svg>',
  cadenas: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
};

const auj = () => aujourdhui();
const moisAffiche = {};
let periode = { id: 'tout' };

// --- Zone visible : les fenêtres suivent le clavier et les barres du navigateur ----

function suivreZoneVisible() {
  const vv = window.visualViewport;
  const maj = () => {
    const r = document.documentElement.style;
    r.setProperty('--vv-h', `${vv ? vv.height : window.innerHeight}px`);
    r.setProperty('--vv-top', `${vv ? vv.offsetTop : 0}px`);
  };
  maj();
  vv?.addEventListener('resize', maj);
  vv?.addEventListener('scroll', maj);
  window.addEventListener('resize', maj);
}

// --- Navigation ---------------------------------------------------------------------

function route() {
  if (!verrouEl.hidden) return;
  fermer();
  const h = location.hash || '#/';
  const m = h.match(/^#\/(c|s|r)\/([^/]+)$/);
  const c = m && S.calendrier(m[2]);
  if (c && m[1] === 'c') return vueCalendrier(c);
  if (c && m[1] === 's') return vueStats(c);
  if (c && m[1] === 'r') return vueConfig(c);
  if (h === '#/croiser') return vueCroiser();
  if (h === '#/reglages') return vueReglages();
  return vueAccueil();
}

function aller(h) {
  if (location.hash === h) route(); else location.hash = h;
}

function actions(liste) {
  return `<nav class="actions-tete" style="grid-template-columns: repeat(${liste.length}, minmax(0, 1fr))">${liste.map(([action, icone, libelle, extra = '']) =>
    `<button class="action-tete ${extra}" data-action="${action}">${I[icone]}<span>${libelle}</span></button>`).join('')}</nav>`;
}

function bandeau({ retour, petit, titre, liste, chiffres }) {
  return `<header class="bandeau-tete">
    <div class="bandeau-ligne">
      ${retour ? `<button class="btn-icone sur-couleur" data-action="aller" data-h="${retour}" aria-label="Retour">${I.retour}</button>` : ''}
      <div class="bandeau-titre">${petit ? `<small>${petit}</small>` : ''}<h1>${titre}</h1></div>
    </div>
    ${chiffres || ''}
    ${liste ? actions(liste) : ''}
  </header>`;
}

// --- Petits textes -------------------------------------------------------------------

const aDesChamps = (c) => !!c.echelle || c.etiquettes.length > 0;
const typeSaisie = { jour: 'Journée', heure: "À l'heure", 'les-deux': 'Au choix' };

function quandTexte(s) {
  return s.heure ? texteHeure(minutesDe(s.heure)) : 'journée';
}

function nomsEtiquettes(c, s) {
  return (s.etiquettes || []).map((id) => c.etiquettes.find((e) => e.id === id)?.nom).filter(Boolean);
}

function ligneSaisie(c, s, avecDate = true) {
  const tags = nomsEtiquettes(c, s);
  return `<li><button class="ligne-saisie" data-action="saisie" data-id="${s.id}" style="--c:${c.couleur}">
    <span class="ls-quand"><b>${avecDate ? dateCourte(s.date) : quandTexte(s)}</b>${avecDate ? `<small>${quandTexte(s)}</small>` : ''}</span>
    <span class="ls-texte">
      ${tags.length ? `<span class="ls-tags">${tags.map((t) => `<span class="etiquette">${esc(t)}</span>`).join('')}</span>` : ''}
      ${s.note ? `<em>${esc(s.note)}</em>` : ''}
      ${!tags.length && !s.note ? '<span class="ls-vide">noté</span>' : ''}
    </span>
    ${s.valeur != null ? `<span class="valeur">${nombre(s.valeur)}</span>` : ''}
  </button></li>`;
}

function derniereFois(c) {
  const l = S.saisiesDe(c.id);
  const s = l[l.length - 1];
  if (!s) return 'Rien de noté pour l\'instant';
  return `Dernière fois : ${ilYA(s.date)}${s.heure ? ` à ${texteHeure(minutesDe(s.heure))}` : ''}`;
}

// --- Accueil ------------------------------------------------------------------------

function carteCal(c) {
  const a = auj();
  const lundi = ajouterJours(a, -jourSemaine(a));
  const l = S.saisiesDe(c.id);
  const semaine = l.filter((s) => s.date >= lundi).length;
  const mois = l.filter((s) => s.date.slice(0, 7) === a.slice(0, 7)).length;
  const nomMois = new Date(`${a}T12:00:00`).toLocaleDateString('fr-FR', { month: 'long' });
  const jours = new Set(l.map((s) => s.date));
  const sept = Array.from({ length: 14 }, (_, i) => ajouterJours(a, i - 13));
  return `<li class="carte-cal" style="--c:${c.couleur}">
    <button class="ouvrir" data-action="aller" data-h="#/c/${c.id}">
      <strong>${esc(c.nom)}</strong>
      <span class="chiffres"><b>${semaine}</b> fois cette semaine · <b>${mois}</b> en ${nomMois}</span>
      <small>${derniereFois(c)}</small>
      <span class="semaine-mini" aria-hidden="true">${sept.map((d) => `<i class="${jours.has(d) ? 'oui' : c.loupes.includes(d) ? 'loupe' : ''}"></i>`).join('')}</span>
    </button>
    <button class="btn-maintenant" data-action="maintenant" data-id="${c.id}" aria-label="Noter maintenant dans ${esc(c.nom)}">${I.plus}</button>
  </li>`;
}

function vueAccueil() {
  const cals = S.calendriers();
  const r = S.get().reglages;
  const jours = r.dernierExport ? ecartJours(r.dernierExport, auj()) : null;
  const rappel = S.get().saisies.length >= 10 && (jours == null || jours >= 30) && !S.aDesExemples();
  app.innerHTML = `
    ${bandeau({
      titre: 'Logger', petit: majuscule(dateLongue(auj())),
      liste: [['nouveau', 'plus', 'Nouveau'], ['aller" data-h="#/croiser', 'lien', 'Croiser'], ['aller" data-h="#/reglages', 'reglages', 'Réglages'], ['exporter', 'partage', 'Exporter']],
    })}
    ${S.aDesExemples() ? `<div class="exemple-bandeau"><span>Calendriers d'exemple (inventés) affichés.</span><button class="lien" data-action="retirer-exemple">Les retirer</button></div>` : ''}
    ${rappel ? `<div class="rappel"><span>${jours == null ? 'Aucun export pour l\'instant.' : `Dernier export il y a ${jours} jours.`}</span><button class="lien" data-action="exporter">Exporter</button></div>` : ''}
    ${cals.length ? `<ul class="liste">${cals.map(carteCal).join('')}</ul>
      <p class="aide centre">Le bouton <b>+</b> note l'instant présent en un geste.</p>` : `
      <div class="accueil-vide">
        <p>Un calendrier par chose à suivre : fatigue, stress, oublis, phrases dites…<br>Tu notes au fil de l'eau, l'appli compte et cherche les motifs.</p>
        <button class="btn btn-principal btn-large" data-action="nouveau">${I.plus} Créer un calendrier</button>
        <button class="lien" data-action="charger-exemple">Voir d'abord avec un exemple</button>
      </div>`}
    <p class="pied">Logger · données gardées sur cet appareil</p>`;
}

// --- Saisie rapide ------------------------------------------------------------------

function maintenant(c) {
  const champs = { date: auj(), heure: c.saisie === 'jour' ? null : heureMaintenant() };
  if (aDesChamps(c)) return fenetreSaisie(c, null, champs);
  if (!champs.heure && S.saisiesDuJour(c.id, champs.date).some((s) => !s.heure)) return toast("Aujourd'hui est déjà coché");
  const s = S.ajouterSaisie(c, champs);
  route();
  toast(champs.heure ? `Noté à ${texteHeure(minutesDe(champs.heure))}` : "Aujourd'hui coché", { libelle: 'Modifier', action: () => fenetreSaisie(c, s) });
}

// --- Calendrier -----------------------------------------------------------------------

function intensite(c, ss) {
  if (!c.echelle) return 0.55;
  const v = ss.map((s) => s.valeur).filter((x) => x != null);
  if (!v.length) return 0.55;
  const { min, max } = c.echelle;
  return Math.max(0.1, Math.min(1, ((v.reduce((x, y) => x + y, 0) / v.length) - min) / ((max - min) || 1)));
}

function vueCalendrier(c) {
  const a = auj();
  const mois = moisAffiche[c.id] ||= a.slice(0, 7);
  const [an, mo] = mois.split('-').map(Number);
  const premier = `${mois}-01`;
  const decalage = jourSemaine(premier);
  const nbJours = new Date(an, mo, 0).getDate();
  const debutGrille = ajouterJours(premier, -decalage);
  const nbCases = Math.ceil((decalage + nbJours) / 7) * 7;
  const toutes = S.saisiesDe(c.id);
  const parJour = new Map();
  for (const s of toutes) { if (!parJour.has(s.date)) parJour.set(s.date, []); parJour.get(s.date).push(s); }

  const cases = Array.from({ length: nbCases }, (_, i) => {
    const date = ajouterJours(debutGrille, i);
    if (date.slice(0, 7) !== mois) return '<span class="cal-jour hors"></span>';
    const ss = parJour.get(date) || [];
    const loupe = !ss.length && c.loupes.includes(date);
    const it = ss.length ? intensite(c, ss) : 0;
    const cls = [date === a && 'auj', date > a && 'futur', date < c.debut && !ss.length && !loupe && 'avant', ss.length && 'coche', ss.length && it > 0.72 && 'fonce', loupe && 'loupe'].filter(Boolean).join(' ');
    const heures = ss.filter((s) => s.heure);
    const contenu = heures.length ? `<span class="cal-heure">${texteHeure(minutesDe(heures[0].heure))}</span>` : '';
    return `<button class="cal-jour ${cls}" data-action="jour" data-date="${date}" style="--i:${it.toFixed(2)}">
      <span class="cal-num">${Number(date.slice(8))}</span>${contenu}${ss.length > 1 ? `<span class="cal-n">${ss.length}</span>` : ''}</button>`;
  }).join('');

  // Bilan du mois affiché (jours suivis jusqu'à aujourd'hui).
  const du = premier > c.debut ? premier : c.debut;
  const finMois = `${mois}-${String(nbJours).padStart(2, '0')}`;
  const au = finMois < a ? finMois : a;
  const nbSuivis = du <= au ? ecartJours(du, au) + 1 : 0;
  const duMois = toutes.filter((s) => s.date.slice(0, 7) === mois);
  const joursCoches = new Set(duMois.map((s) => s.date)).size;
  const loupes = c.loupes.filter((d) => d.slice(0, 7) === mois && !parJour.has(d)).length;
  const nomMois = new Date(an, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  app.innerHTML = `
    ${bandeau({
      retour: '#/', petit: `Suivi depuis le ${dateNum(c.debut)} · ${pluriel(toutes.length, 'fois', 'fois')} en tout`, titre: esc(c.nom),
      liste: [['maintenant', 'plus', 'Maintenant', 'fort'], ['aller" data-h="#/s/' + c.id, 'stats', 'Stats'], ['aller" data-h="#/r/' + c.id, 'reglages', 'Réglages']],
    })}
    <div class="cal" style="--c:${c.couleur}">
      <div class="cal-tete">
        <button class="btn-icone" data-action="mois" data-pas="-1" aria-label="Mois précédent">${I.retour}</button>
        <button class="mois" data-action="mois-actuel"><strong>${nomMois}</strong>${mois !== a.slice(0, 7) ? '<small>revenir à aujourd\'hui</small>' : ''}</button>
        <button class="btn-icone" data-action="mois" data-pas="1" aria-label="Mois suivant" ${mois >= a.slice(0, 7) ? 'disabled' : ''}>${I.droite}</button>
      </div>
      <div class="cal-semaine">${JOURS_COURTS.map((j) => `<span>${j}</span>`).join('')}</div>
      <div class="cal-grille">${cases}</div>
      <div class="cal-resume">
        <span><b>${joursCoches}</b> jour${joursCoches > 1 ? 's' : ''} sur ${nbSuivis} · <b>${duMois.length}</b> fois</span>
        ${loupes ? `<span><b>${loupes}</b> loupé${loupes > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="legende-cal"><span><i></i>noté${c.echelle ? ' (plus foncé = plus intense)' : ''}</span><span><i class="l"></i>loupé</span>${c.debut > ajouterJours(premier, -1) ? '<span><i class="a"></i>avant le suivi</span>' : ''}</div>
    </div>
    <p class="aide centre">Touche un jour pour noter, corriger ou le marquer comme loupé.</p>
    <div class="titre-section">Ce mois-ci</div>
    ${duMois.length ? `<ul class="saisies">${[...duMois].reverse().map((s) => ligneSaisie(c, s)).join('')}</ul>` : '<p class="vide">Rien de noté ce mois-ci.</p>'}`;
}

function fenetreJour(c, date) {
  const a = auj();
  if (date > a) return toast("Ce jour n'est pas encore arrivé");
  const ss = S.saisiesDuJour(c.id, date);
  const aJournee = ss.some((s) => !s.heure);
  const loupe = c.loupes.includes(date);
  const boutons = [];
  if (c.saisie !== 'heure' && !aJournee) boutons.push(`<button class="btn ${c.saisie === 'jour' ? 'btn-principal' : ''} btn-large" data-f="journee">${I.soleil} ${c.saisie === 'jour' ? 'Cocher ce jour' : 'Toute la journée'}</button>`);
  if (c.saisie !== 'jour') boutons.push(`<button class="btn btn-principal btn-large" data-f="heure">${I.horloge} À une heure</button>`);
  ouvrirFenetre(`<div class="pile" style="--c:${c.couleur}">
    <h2>${majuscule(dateLongue(date))}</h2>
    ${date < c.debut ? `<p class="aide">Avant le début du suivi : noter ce jour avancera le début au ${dateNum(date)}.</p>` : ''}
    ${ss.length ? `<ul class="saisies">${ss.map((s) => ligneSaisie(c, s, false)).join('')}</ul>` : ''}
    ${boutons.length === 2 ? `<div class="btn-duo">${boutons.join('')}</div>` : boutons.join('')}
    ${!ss.length ? `<p class="aide">${loupe ? 'Ce jour est marqué <b>loupé</b> : tu ne sais plus. Il reste compté dans les jours suivis, et les stats rappellent combien de jours sont loupés.' : 'Tu ne sais plus si c\'est arrivé ? Marque le jour comme loupé : il reste dans le calcul, mais les stats le signalent.'}</p>
      <div class="actions-sec"><button class="lien ${loupe ? 'danger' : ''}" data-f="loupe">${loupe ? 'Ce n\'est plus un jour loupé' : 'Marquer comme loupé'}</button></div>` : ''}
  </div>`);
  couche.querySelector('[data-f="journee"]')?.addEventListener('click', () => {
    if (aDesChamps(c)) return fenetreSaisie(c, null, { date, heure: null });
    const s = S.ajouterSaisie(c, { date, heure: null });
    fermer(); route();
    toast('Jour coché', { libelle: 'Modifier', action: () => fenetreSaisie(c, s) });
  });
  couche.querySelector('[data-f="heure"]')?.addEventListener('click', () => fenetreSaisie(c, null, { date, heure: heureMaintenant() }));
  couche.querySelector('[data-f="loupe"]')?.addEventListener('click', () => {
    S.basculerLoupe(c, date); fermer(); route();
    toast(c.loupes.includes(date) ? 'Jour marqué loupé' : 'Marque retirée');
  });
}

function fenetreSaisie(c, s, init = {}) {
  const v = s || { date: auj(), heure: null, valeur: null, etiquettes: [], note: '', ...init };
  const typeActuel = v.heure ? 'heure' : 'jour';
  const montrerType = c.saisie === 'les-deux' || (s && typeActuel !== c.saisie);
  const e = c.echelle;
  const n = e ? e.max - e.min + 1 : 0;
  const echelle = !e ? '' : n <= 11 ? `
    <p class="titre-choix">${esc(e.nom)}<em>facultatif</em></p>
    <div class="echelle choix-echelle" style="grid-template-columns: repeat(${n}, 1fr)">${Array.from({ length: n }, (_, i) => e.min + i).map((x) => `<button type="button" class="puce ${v.valeur === x ? 'choisi' : ''}" data-v="${x}">${x}</button>`).join('')}</div>
    ${e.bas || e.haut ? `<div class="echelle-legende"><span>${esc(e.bas || '')}</span><span>${esc(e.haut || '')}</span></div>` : ''}
    <input type="hidden" name="valeur" value="${v.valeur ?? ''}">`
    : `<label class="champ"><span>${esc(e.nom)} (${e.min} à ${e.max})</span><input name="valeur" inputmode="decimal" value="${v.valeur ?? ''}" placeholder="${esc([e.bas, e.haut].filter(Boolean).join(' → '))}"></label>`;
  ouvrirFenetre(`
    <form style="--c:${c.couleur}">
      <h2>${esc(c.nom)} <small>${s ? 'modifier' : 'nouvelle saisie'}</small></h2>
      ${montrerType ? `<div class="segment" data-type><button type="button" data-t="jour" class="${typeActuel === 'jour' ? 'choisi' : ''}">Journée</button><button type="button" data-t="heure" class="${typeActuel === 'heure' ? 'choisi' : ''}">À une heure</button></div>` : ''}
      <input type="hidden" name="type" value="${montrerType ? typeActuel : c.saisie === 'heure' ? 'heure' : 'jour'}">
      <div class="deux">
        <label class="champ"><span>Jour</span><input type="date" name="date" value="${v.date}" max="${auj()}" required></label>
        <label class="champ" data-heure ${(montrerType ? typeActuel : c.saisie) === 'heure' ? '' : 'hidden'}><span>Heure</span><input type="time" name="heure" value="${v.heure || heureMaintenant()}"></label>
      </div>
      ${echelle}
      ${c.etiquettes.length ? `<p class="titre-choix">Étiquettes<em>facultatif</em></p>
        <div class="choix choix-etq">${c.etiquettes.map((t) => `<button type="button" class="puce etq ${v.etiquettes?.includes(t.id) ? 'choisi' : ''}" data-id="${t.id}">${esc(t.nom)}</button>`).join('')}</div>` : ''}
      ${c.note || v.note ? `<label class="champ"><span>Note</span><textarea name="note" rows="2" placeholder="Ce qui s'est passé, le contexte…">${esc(v.note || '')}</textarea></label>` : ''}
      <button class="btn btn-principal btn-large">${s ? 'Enregistrer' : 'Noter'}</button>
      ${s ? '<div class="actions-sec"><button type="button" class="lien danger" data-f="supprimer">Supprimer cette saisie</button></div>' : ''}
    </form>`, (fd) => {
    const date = fd.get('date');
    if (!date) return toast('Choisis un jour');
    if (date > auj()) return toast("Ce jour n'est pas encore arrivé");
    const heure = fd.get('type') === 'heure' ? (fd.get('heure') || heureMaintenant()) : null;
    if (!heure && S.saisiesDuJour(c.id, date).some((x) => !x.heure && x !== s)) return toast('Ce jour est déjà coché pour la journée');
    let valeur = String(fd.get('valeur') ?? '').trim().replace(',', '.');
    valeur = valeur === '' ? null : Number(valeur);
    if (valeur != null && (!Number.isFinite(valeur) || valeur < e.min || valeur > e.max)) return toast(`${e.nom} : entre ${e.min} et ${e.max}`);
    const etiquettes = [...couche.querySelectorAll('.choix-etq .choisi')].map((b) => b.dataset.id);
    const champs = { date, heure, valeur, etiquettes, note: String(fd.get('note') || '').trim() };
    if (s) S.modifierSaisie(s, champs); else S.ajouterSaisie(c, champs);
    if (date.slice(0, 7) !== (moisAffiche[c.id] || '')) moisAffiche[c.id] = date.slice(0, 7);
    fermer(); route();
    toast(s ? 'Saisie modifiée' : heure ? `Noté à ${texteHeure(minutesDe(heure))}` : 'Jour coché');
  });
  const f = couche.querySelector('form');
  f.querySelector('[data-type]')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-t]');
    if (!b) return;
    f.type.value = b.dataset.t;
    f.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('choisi', x === b));
    f.querySelector('[data-heure]').hidden = b.dataset.t !== 'heure';
  });
  f.querySelector('.choix-echelle')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-v]');
    if (!b) return;
    const deja = b.classList.contains('choisi');
    f.querySelectorAll('.choix-echelle .puce').forEach((x) => x.classList.remove('choisi'));
    if (!deja) b.classList.add('choisi');
    f.valeur.value = deja ? '' : b.dataset.v;
  });
  f.querySelector('.choix-etq')?.addEventListener('click', (ev) => ev.target.closest('.puce')?.classList.toggle('choisi'));
  f.querySelector('[data-f="supprimer"]')?.addEventListener('click', (ev) => {
    if (!confirmerDeux(ev.currentTarget)) return;
    const copie = { ...s };
    S.supprimerSaisie(s.id); fermer(); route();
    toast('Saisie supprimée', { libelle: 'Annuler', action: () => { S.get().saisies.push(copie); S.enregistrer(); route(); } });
  });
}

// --- Réglages d'un calendrier --------------------------------------------------------

function vueConfig(c, nouveau = false) {
  const e = c.echelle || { nom: 'Intensité', min: 0, max: 10, bas: '', haut: '' };
  const liens = S.liensDe(c.id).map((l) => S.calendrier(l.a === c.id ? l.b : l.a)).filter(Boolean);
  const idx = S.calendriers().indexOf(c);
  app.innerHTML = `
    ${bandeau({ retour: `#/c/${c.id}`, petit: esc(c.nom), titre: nouveau ? 'Nouveau calendrier' : 'Réglages' })}
    <form class="config" style="--c:${c.couleur}">
      <div class="carte">
        <label class="champ"><span>Nom</span><input name="nom" value="${esc(c.nom)}" required autocomplete="off"></label>
        <div class="champ"><span>Couleur</span><div class="couleurs">${S.COULEURS.map((x) => `<button type="button" class="pastille ${x === c.couleur ? 'choisi' : ''}" style="--c:${x}" data-couleur="${x}" aria-label="Couleur"></button>`).join('')}</div></div>
        <input type="hidden" name="couleur" value="${c.couleur}">
        <label class="champ"><span>Début du suivi</span><input type="date" name="debut" value="${c.debut}" max="${auj()}"></label>
        <p class="aide">Les stats comptent les jours à partir de cette date (« 12 jours sur 40 »).</p>
      </div>

      <div class="carte">
        <h3>Type de saisie</h3>
        <div class="segment" data-saisie>${Object.entries(typeSaisie).map(([k, nom]) => `<button type="button" data-s="${k}" class="${c.saisie === k ? 'choisi' : ''}">${nom}</button>`).join('')}</div>
        <input type="hidden" name="saisie" value="${c.saisie}">
        <p class="aide" data-aide-saisie></p>
      </div>

      <div class="carte">
        <label class="interrupteur"><span><b>Échelle</b><br><small>Une note chiffrée à chaque saisie (intensité, gravité…)</small></span><input type="checkbox" name="avecEchelle" ${c.echelle ? 'checked' : ''}><i></i></label>
        <div class="sous-bloc" data-echelle ${c.echelle ? '' : 'hidden'}>
          <label class="champ"><span>Nom de l'échelle</span><input name="eNom" value="${esc(e.nom)}" autocomplete="off"></label>
          <div class="deux">
            <label class="champ"><span>Valeur basse</span><input name="eMin" inputmode="numeric" value="${e.min}"></label>
            <label class="champ"><span>Valeur haute</span><input name="eMax" inputmode="numeric" value="${e.max}"></label>
          </div>
          <div class="deux">
            <label class="champ"><span>Libellé du bas</span><input name="eBas" value="${esc(e.bas)}" placeholder="à peine" autocomplete="off"></label>
            <label class="champ"><span>Libellé du haut</span><input name="eHaut" value="${esc(e.haut)}" placeholder="KO total" autocomplete="off"></label>
          </div>
          <p class="aide">Jusqu'à 11 valeurs, la saisie se fait en un toucher (0 à 10, 1 à 5…).</p>
        </div>
      </div>

      <div class="carte">
        <h3>Étiquettes <small>pour repérer le contexte</small></h3>
        <div class="sous-bloc" data-etiquettes>${c.etiquettes.map((t) => ligneEtiquette(t)).join('')}</div>
        <button type="button" class="lien" data-f="ajouter-etq" style="align-self:flex-start">${I.plus} Ajouter une étiquette</button>
        <p class="aide">Par exemple « mal dormi », « travail », « après repas ». Les stats montrent celles qui reviennent et leur effet sur l'échelle.</p>
      </div>

      <div class="carte">
        <label class="interrupteur"><span><b>Note libre</b><br><small>Un champ texte à chaque saisie</small></span><input type="checkbox" name="note" ${c.note ? 'checked' : ''}><i></i></label>
      </div>

      ${!nouveau ? `<div class="carte">
        <h3>Croisements</h3>
        <p class="aide">${liens.length ? `Lié à ${liens.map((x) => `<b>${esc(x.nom)}</b>`).join(', ')}.` : 'Lié à aucun autre calendrier.'}</p>
        <button type="button" class="lien" data-action="aller" data-h="#/croiser" style="align-self:flex-start">Gérer les croisements ${I.droite}</button>
      </div>
      <div class="carte">
        <h3>Place dans la liste <span style="display:flex;gap:6px">
          <button type="button" class="btn-icone petit" data-f="monter" ${idx <= 0 ? 'disabled' : ''} aria-label="Monter">${I.haut}</button>
          <button type="button" class="btn-icone petit" data-f="descendre" ${idx >= S.calendriers().length - 1 ? 'disabled' : ''} aria-label="Descendre">${I.bas}</button></span></h3>
      </div>` : ''}

      <button class="btn btn-principal btn-large">${nouveau ? 'Créer le calendrier' : 'Enregistrer'}</button>
    </form>
    ${!nouveau ? `<div class="zone-danger"><button class="lien danger" data-f="supprimer-cal">Supprimer ce calendrier et ses ${S.saisiesDe(c.id).length} saisies</button></div>` : ''}`;

  const f = app.querySelector('form');
  const aideSaisie = () => {
    f.querySelector('[data-aide-saisie]').textContent = {
      jour: 'Un jour est coché ou non (fatigue, humeur du jour…). « Maintenant » coche aujourd\'hui.',
      heure: 'Chaque saisie a son heure exacte, plusieurs par jour possibles (stress, oublis…). Les stats montrent les heures.',
      'les-deux': 'Tu choisis à chaque fois : la journée entière ou une heure précise.',
    }[f.saisie.value];
  };
  aideSaisie();
  f.querySelector('[data-saisie]').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-s]');
    if (!b) return;
    f.saisie.value = b.dataset.s;
    f.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('choisi', x === b));
    aideSaisie();
  });
  f.querySelector('.couleurs').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-couleur]');
    if (!b) return;
    f.couleur.value = b.dataset.couleur;
    f.querySelectorAll('.pastille').forEach((x) => x.classList.toggle('choisi', x === b));
  });
  f.avecEchelle.addEventListener('change', () => { f.querySelector('[data-echelle]').hidden = !f.avecEchelle.checked; });
  f.querySelector('[data-f="ajouter-etq"]').addEventListener('click', () => {
    f.querySelector('[data-etiquettes]').insertAdjacentHTML('beforeend', ligneEtiquette({ id: '', nom: '' }));
    f.querySelector('[data-etiquettes] .ligne-etq:last-child input').focus();
  });
  f.querySelector('[data-etiquettes]').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-f="retirer-etq"]');
    if (b) b.closest('.ligne-etq').remove();
  });
  f.querySelector('[data-f="monter"]')?.addEventListener('click', () => { S.deplacerCalendrier(c.id, -1); toast('Monté dans la liste'); vueConfig(c); });
  f.querySelector('[data-f="descendre"]')?.addEventListener('click', () => { S.deplacerCalendrier(c.id, 1); toast('Descendu dans la liste'); vueConfig(c); });
  app.querySelector('[data-f="supprimer-cal"]')?.addEventListener('click', (ev) => {
    if (!confirmerDeux(ev.currentTarget)) return;
    S.supprimerCalendrier(c.id); toast('Calendrier supprimé'); aller('#/');
  });
  f.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    const nom = majuscule(fd.get('nom'));
    if (!nom) return toast('Donne un nom au calendrier');
    let echelle = null;
    if (fd.get('avecEchelle')) {
      const min = parseInt(fd.get('eMin'), 10), max = parseInt(fd.get('eMax'), 10);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return toast("L'échelle doit aller d'une valeur basse à une plus haute");
      if (max - min > 100) return toast("L'échelle est trop grande (100 valeurs au plus)");
      echelle = { nom: majuscule(fd.get('eNom')) || 'Intensité', min, max, bas: String(fd.get('eBas') || '').trim(), haut: String(fd.get('eHaut') || '').trim() };
    }
    const etiquettes = [...f.querySelectorAll('[data-etiquettes] .ligne-etq')].map((l) => {
      const i = l.querySelector('input');
      return { id: i.dataset.id || `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, nom: i.value.trim() };
    }).filter((t) => t.nom);
    const debut = fd.get('debut') || c.debut;
    const premiere = S.saisiesDe(c.id)[0];
    Object.assign(c, {
      nom, couleur: fd.get('couleur'), saisie: fd.get('saisie'), echelle, etiquettes, note: !!fd.get('note'),
      debut: premiere && premiere.date < debut ? premiere.date : debut,
    });
    if (premiere && premiere.date < debut) toast(`Début ramené au ${dateNum(premiere.date)} : une saisie existe ce jour-là`);
    else toast(nouveau ? 'Calendrier créé' : 'Réglages enregistrés');
    S.enregistrer();
    aller(`#/c/${c.id}`);
  });
}

function ligneEtiquette(t) {
  return `<div class="ligne-etq"><input data-id="${t.id}" value="${esc(t.nom)}" placeholder="Nom de l'étiquette" autocomplete="off">
    <button type="button" class="btn-icone petit" data-f="retirer-etq" aria-label="Retirer">${I.croix}</button></div>`;
}

// --- Stats ------------------------------------------------------------------------------

const etiquetteTemps = (cle, parSemaine) => {
  if (parSemaine) return `${Number(cle.slice(8))}/${cle.slice(5, 7)}`;
  const [a, m] = cle.split('-');
  return `${MOIS_COURTS[Number(m) - 1].replace('.', '')}${Number(a) !== new Date().getFullYear() ? ` ${a.slice(2)}` : ''}`;
};

function vueStats(c) {
  const a = auj();
  const b = A.bornes(c.debut, periode, a);
  const res = b.vide ? null : A.analyser(c, S.saisiesDe(c.id), b.du, b.au, a);
  const chips = A.PERIODES.map((p) => `<button class="puce ${periode.id === p.id ? 'choisi' : ''}" data-action="periode" data-p="${p.id}">${p.nom}</button>`).join('');
  app.innerHTML = `
    ${bandeau({ retour: `#/c/${c.id}`, petit: esc(c.nom), titre: 'Stats' })}
    <div class="periodes">${chips}</div>
    ${res ? `<p class="periode-texte">Du ${dateCourte(b.du, true)} au ${dateCourte(b.au, true)} · ${pluriel(res.N, 'jour')}${b.du === c.debut ? ' (depuis le début du suivi)' : ''}</p>` : ''}
    <div style="--c:${c.couleur}">${res && res.nbSaisies ? sectionsStats(c, res) : `<p class="vide">${res ? 'Rien de noté sur cette période.' : 'Cette période est avant le début du suivi.'}</p>`}</div>
    ${sectionCroisements(c)}`;
}

function sectionsStats(c, r) {
  const e = c.echelle;
  const tuiles = `<div class="tuiles">
    <div class="tuile"><strong>${r.coches} <small>/ ${r.N} j</small></strong><em>jours cochés · ${pct(r.taux)}</em></div>
    <div class="tuile"><strong>${r.nbSaisies}</strong><em>fois en tout · ≈ ${nombre(r.parSemaineMoy)} / semaine</em></div>
    <div class="tuile ${r.loupes.length ? 'alerte' : ''}"><strong>${r.loupes.length}</strong><em>jour${r.loupes.length > 1 ? 's' : ''} loupé${r.loupes.length > 1 ? 's' : ''}${r.loupes.length ? ' · comptés sans saisie' : ''}</em></div>
    <div class="tuile"><strong>${r.rythme.dernier ? ilYA(r.rythme.dernier) : '–'}</strong><em>dernière fois${r.rythme.dernier ? ` · ${dateCourte(r.rythme.dernier)}` : ''}</em></div>
    ${e && r.echelle?.n ? `<div class="tuile large"><strong>${nombre(r.echelle.moyenne)} <small>/ ${e.max}</small></strong><em>${esc(e.nom.toLowerCase())} en moyenne · de ${nombre(r.echelle.min)} à ${nombre(r.echelle.max)} · médiane ${nombre(r.echelle.mediane)}</em></div>` : ''}
  </div>`;

  // Tendance
  let tendance = '';
  if (r.tendance) {
    const t = r.tendance, n = t.fenetre === 30 ? '30 derniers jours' : '7 derniers jours';
    const sens = t.recent > t.avant ? 'plus' : t.recent < t.avant ? 'moins' : 'autant';
    tendance = `<p class="phrase">Ces <b>${n}</b> : <b>${pluriel(t.recent, 'jour coché', 'jours cochés')}</b>, contre ${t.avant} les ${t.fenetre} jours d'avant (${sens === 'autant' ? 'autant' : `<span class="${sens === 'plus' ? 'fort' : ''}">${sens}</span>`}).</p>`;
  }

  // Rythme
  const ry = r.rythme;
  const faitsRythme = [];
  if (ry.ecartMedian != null) faitsRythme.push(['', `Entre deux jours cochés, il se passe le plus souvent <b>${pluriel(Math.round(ry.ecartMedian), 'jour')}</b> (médiane ; moyenne ${nombre(ry.ecartMoyen)} j).`]);
  if (ry.q1 != null && ry.q3 != null && ry.q3 > ry.q1) faitsRythme.push(['', `La moitié des écarts tient entre <b>${Math.round(ry.q1)} et ${Math.round(ry.q3)} jours</b>.`]);
  if (ry.plusLongueSerie > 1) faitsRythme.push(['', `Plus longue série : <b>${ry.plusLongueSerie} jours d'affilée</b>${ry.serieEnCours > 1 ? ` (en cours : ${ry.serieEnCours} j)` : ''}.`]);
  if (ry.plusLongueAbsence > 1) faitsRythme.push(['', `Plus longue période sans : <b>${pluriel(ry.plusLongueAbsence, 'jour')}</b>.`]);
  if (ry.prochain) {
    const p = ry.prochain;
    const retard = ry.depuisDernier != null && ry.q3 != null && ry.depuisDernier > ry.q3;
    faitsRythme.push([retard ? 'fort' : '', retard
      ? `Ça fait <b>${ry.depuisDernier} jours</b> : c'est plus long que 3 écarts sur 4 jusqu'ici.`
      : `D'après les écarts habituels, la prochaine fois tomberait vers le <b>${dateCourte(p.date)}</b> (le plus souvent entre le ${dateCourte(p.du)} et le ${dateCourte(p.au)}).`]);
  }
  const rythme = faitsRythme.length ? `<div class="carte-graphe"><p class="graphe-titre">Rythme</p><ul class="faits">${faitsRythme.map(([cl, t]) => `<li class="${cl}">${t}</li>`).join('')}</ul></div>` : '';

  // Jours de la semaine
  const plus = r.semaine.filter((x) => x.ressort === 'plus'), moins = r.semaine.filter((x) => x.ressort === 'moins');
  const max = [...r.semaine].sort((x, y) => y.taux - x.taux)[0];
  let phraseSemaine = plus.length
    ? `${plus.map((x) => `Le <b>${JOURS[x.j]}</b> ressort : ${pct(x.taux)} des ${JOURS[x.j]}s cochés (${x.coches} sur ${x.jours})`).join('. ')}, contre ${pct(r.taux)} des jours en moyenne. Peu probable que ce soit le hasard.`
    : r.coches >= 6 ? `Aucun jour ne ressort nettement pour l'instant. Le plus haut : le ${JOURS[max.j]} (${pct(max.taux)}, ${max.coches} sur ${max.jours}).` : 'Encore trop peu de jours cochés pour comparer les jours de la semaine.';
  if (moins.length) phraseSemaine += ` Plus rare le ${moins.map((x) => JOURS[x.j]).join(' et le ')} (${moins.map((x) => pct(x.taux)).join(', ')}).`;
  const semaine = `<div class="carte-graphe">
    <p class="graphe-titre">Jours de la semaine <small>part des jours cochés</small></p>
    ${G.barres({ barres: r.semaine.map((x) => ({ etiquette: JOURS_COURTS[x.j], y: x.taux * 100, fort: x.ressort === 'plus', tip: `${pct(x.taux)}\n${majuscule(JOURS[x.j])} : ${x.coches} sur ${x.jours} · ${pluriel(x.saisies, 'saisie')}` })), reference: r.taux * 100, format: (v) => `${Math.round(v)} %`, hauteur: 140 })}
    <div class="legende"><span><i class="cle ligne"></i>moyenne, tous jours confondus</span></div>
    <p class="phrase">${phraseSemaine}</p>
  </div>`;

  // Heures
  let heures = '';
  if (r.heures.n) {
    const h = r.heures;
    const cl = h.classement.slice(0, 3).map((x, i) => `${i === 0 ? ' ' : ', puis '}vers <b>${x.h} h</b> (${x.n} fois)`).join('');
    const tr = [...h.tranches].sort((x, y) => y.n - x.n)[0];
    heures = `<div class="carte-graphe">
      <p class="graphe-titre">Heures <small>${pluriel(h.n, 'saisie')} avec heure</small></p>
      ${G.barres({ barres: h.compte.map((n, hr) => ({ etiquette: hr % 6 === 0 ? `${hr} h` : '', y: n, tip: `${n} fois\n${hr} h – ${hr + 1} h` })), format: (v) => v, hauteur: 130, etiquettesToutes: true })}
      <p class="phrase">Le plus souvent${cl}. ${pct(tr.n / h.n)} des fois <b>${tr.nom}</b>.${h.n >= 5 ? ` Heure moyenne ≈ <b>${texteHeure(h.heureMoyenne)}</b>, ${h.concentration > 0.75 ? 'très regroupée' : h.concentration > 0.5 ? 'assez regroupée' : 'plutôt dispersée dans la journée'}.` : ''}</p>
      ${h.n >= 10 ? `<p class="sous-titre">Jour × heure</p>${G.grilleHeures(h.grille, JOURS.map(majuscule))}` : ''}
    </div>`;
  }

  // Dans le temps
  const tps = r.temps;
  const unite = r.parSemaine ? 'semaine' : 'mois';
  const temps = tps.length > 1 ? `<div class="carte-graphe">
    <p class="graphe-titre">Par ${unite} <small>nombre de fois</small></p>
    ${G.barres({ barres: tps.map((x) => ({ etiquette: etiquetteTemps(x.cle, r.parSemaine), y: x.saisies, tip: `${pluriel(x.saisies, 'fois', 'fois')}\n${r.parSemaine ? `Semaine du ${dateCourte(x.cle)}` : etiquetteTemps(x.cle, false)} · ${x.coches} j cochés sur ${x.jours}${x.moyenne != null ? ` · ${e.nom.toLowerCase()} ${nombre(x.moyenne)}` : ''}` })), hauteur: 130 })}
    ${e && tps.filter((x) => x.moyenne != null).length > 1 ? `<p class="sous-titre">${esc(e.nom)} : moyenne par ${unite}</p>${G.courbe({ points: tps.map((x) => ({ etiquette: etiquetteTemps(x.cle, r.parSemaine), y: x.moyenne, tip: `${nombre(x.moyenne)}\n${r.parSemaine ? `Semaine du ${dateCourte(x.cle)}` : etiquetteTemps(x.cle, false)}` })), format: (v) => nombre(v), min: e.min, max: e.max, hauteur: 120 })}` : ''}
    ${tendance}
  </div>` : tendance ? `<div class="carte-graphe">${tendance}</div>` : '';

  // Carte des jours (au plus un an)
  const fin = r.au;
  const debut = r.N > 371 ? ajouterJours(fin, -370) : r.du;
  const lundi0 = ajouterJours(debut, -jourSemaine(debut));
  const colonnes = Math.floor(ecartJours(lundi0, fin) / 7) + 1;
  const maxN = Math.max(1, ...[...r.parJour.values()].map((l) => l.length));
  const moisEtiq = [];
  const cases = [];
  for (let d = lundi0; d <= fin; d = ajouterJours(d, 1)) {
    const col = Math.floor(ecartJours(lundi0, d) / 7), lig = jourSemaine(d);
    if (d.slice(8) === '01' || (d === debut)) { if (!moisEtiq.some((m) => m.col === col) && (!moisEtiq.length || col - moisEtiq[moisEtiq.length - 1].col >= 3)) moisEtiq.push({ col, nom: MOIS_COURTS[Number(d.slice(5, 7)) - 1] }); }
    const ss = r.parJour.get(d) || [];
    const loupe = r.loupes.includes(d);
    const t = ss.length && e ? intensite(c, ss) : null;
    cases.push({ col, lig, hors: d < debut, n: ss.length, loupe, t, tip: `${dateCourte(d)}\n${loupe ? 'loupé' : ss.length ? `${pluriel(ss.length, 'fois', 'fois')}${t != null ? ` · ${e.nom.toLowerCase()} ${nombre(ss.reduce((x, s) => x + (s.valeur ?? 0), 0) / (ss.filter((s) => s.valeur != null).length || 1))}` : ''}` : 'rien'}` });
  }
  const carte = `<div class="carte-graphe">
    <p class="graphe-titre">Carte des jours <small>${e ? 'plus foncé = plus intense' : 'plus foncé = plus de fois'}</small></p>
    ${G.carteJours({ cases, colonnes, maxN, moisEtiquettes: moisEtiq })}
    <div class="legende"><span><i class="cle" style="background:${G.teinte(0.6)}"></i>noté</span><span><i class="cle" style="background:#efecee"></i>rien</span><span><i class="cle" style="background:repeating-linear-gradient(45deg,#b7bcc4 0 2px,#efecee 2px 4px)"></i>loupé</span></div>
  </div>`;

  // Échelle
  let echelle = '';
  if (e && r.echelle?.n) {
    const x = r.echelle;
    const pj = x.parJourSemaine.map((v, j) => ({ v, j })).filter((o) => o.v != null).sort((p, q) => q.v - p.v);
    echelle = `<div class="carte-graphe">
      <p class="graphe-titre">${esc(e.nom)} <small>${pluriel(x.n, 'saisie notée', 'saisies notées')}</small></p>
      ${x.distribution.length ? G.barres({ barres: x.distribution.map((o) => ({ etiquette: String(o.v), y: o.n, tip: `${o.n} fois\n${e.nom} ${o.v}${o.v === e.min && e.bas ? ` (${e.bas})` : o.v === e.max && e.haut ? ` (${e.haut})` : ''}` })), hauteur: 120, etiquettesToutes: true }) : ''}
      <p class="phrase">Moyenne <b>${nombre(x.moyenne)}</b>, médiane ${nombre(x.mediane)}.${pj.length >= 3 ? ` Plus haute le <b>${JOURS[pj[0].j]}</b> (${nombre(pj[0].v)}), plus basse le ${JOURS[pj[pj.length - 1].j]} (${nombre(pj[pj.length - 1].v)}).` : ''}</p>
    </div>`;
  }

  // Étiquettes
  let etiquettes = '';
  if (c.etiquettes.length) {
    const maxE = Math.max(1, ...r.etiquettes.map((t) => t.n));
    etiquettes = `<div class="carte-graphe">
      <p class="graphe-titre">Étiquettes</p>
      <div class="barres-h">${r.etiquettes.map((t) => `<div class="barre-h"><span>${esc(t.nom)}</span><span>${t.n} fois · ${pct(t.part)}${e && t.moyAvec != null ? ` · ${e.nom.toLowerCase()} ${nombre(t.moyAvec)}` : ''}</span><span class="piste"><i style="width:${(t.n / maxE) * 100}%"></i></span></div>`).join('')}</div>
      <ul class="faits">
        ${e ? r.etiquettes.filter((t) => t.n >= 2 && t.moyAvec != null && t.moySans != null && Math.abs(t.moyAvec - t.moySans) >= 1).map((t) => `<li class="fort">Avec « ${esc(t.nom)} », ${esc(e.nom.toLowerCase())} en moyenne <b>${nombre(t.moyAvec)}</b>, contre ${nombre(t.moySans)} sans.</li>`).join('') : ''}
        ${r.combinaisons.map((k) => `<li>« ${esc(k.noms[0])} » et « ${esc(k.noms[1])} » ensemble : <b>${k.n} fois</b>.</li>`).join('')}
        ${r.sansEtiquette ? `<li>${pluriel(r.sansEtiquette, 'saisie', 'saisies')} sans étiquette.</li>` : ''}
      </ul>
    </div>`;
  }

  return `${tuiles}${rythme}${semaine}${heures}${temps}${carte}${echelle}${etiquettes}`;
}

// --- Croisements --------------------------------------------------------------------

function sectionCroisements(c) {
  const liens = S.liensDe(c.id);
  if (!liens.length) return `<div class="titre-section">Croisements</div><p class="aide centre">Lie ce calendrier à un autre pour voir ce qui arrive avant, pendant et après. <button class="lien" data-action="aller" data-h="#/croiser">Croiser</button></p>`;
  return `<div class="titre-section">Croisements <button class="lien" data-action="aller" data-h="#/croiser">Gérer</button></div>
    ${liens.map((l) => carteCroisement(c, S.calendrier(l.a === c.id ? l.b : l.a))).join('')}`;
}

const fois = (n, sur) => `${n} fois sur ${sur}`;
const ratioTexte = (r) => (r == null ? '' : r >= 1 ? `×${nombre(r)}` : `÷${nombre(1 / r)}`);

function phraseCas(centre, autre, x) {
  const debut = {
    avant3: `Dans les 3 jours avant un jour de ${centre}`,
    veille: `La veille d'un jour de ${centre}`,
    meme: `Le même jour que ${centre}`,
    lendemain: `Le lendemain d'un jour de ${centre}`,
    apres3: `Dans les 3 jours après ${centre}`,
  }[x.id];
  return `${debut}, <b>${autre}</b> était là <b>${fois(x.n, x.sur)}</b> (${pct(x.part)}), contre ${pct(x.base)} d'habitude : <b>${ratioTexte(x.ratio)}</b>.`;
}

function tableAutour(centre, autre, cas) {
  return `<p class="sous-titre"><i style="--c:${centre.couleur}"></i>Autour d'un jour de ${esc(centre.nom)}, ${esc(autre.nom)} est là…</p>
  <table class="table"><thead><tr><th></th><th>fois</th><th>part</th><th>d'habitude</th></tr></thead><tbody>
    ${cas.map((x) => `<tr><td>${x.nom}</td><td>${x.n}<em>/${x.sur}</em></td><td class="${x.fort ? (x.sens > 0 ? 'fort' : 'faible') : ''}">${pct(x.part)}</td><td>${pct(x.base)}</td></tr>`).join('')}
  </tbody></table>`;
}

function carteCroisement(A_, B_, avecDelier = null) {
  const r = A.croiser(A_, B_, S.saisiesDe(A_.id), S.saisiesDe(B_.id), auj());
  const nomA = esc(A_.nom), nomB = esc(B_.nom);
  const tete = `<h3><i class="pastille-mini" style="--c:${A_.couleur}"></i>${nomA} <span class="et">et</span> <i class="pastille-mini" style="--c:${B_.couleur}"></i>${nomB}</h3>
    <small>${r.N > 0 ? `Sur ${pluriel(r.N, 'jour')} suivis par les deux (depuis le ${dateNum(r.du)}) : ${r.nA} j de ${nomA}, ${r.nB} j de ${nomB}.` : 'Pas encore de jours suivis en commun.'}</small>`;
  const delier = avecDelier ? `<div class="actions-sec"><button class="lien discret" data-action="delier" data-id="${avecDelier}">Délier</button></div>` : '';
  if (!r.assez) return `<div class="carte-lien">${tete}<p class="aide">Pas encore assez de données : il faut au moins 3 jours cochés de chaque côté.</p>${delier}</div>`;
  const m = r.marquant;
  const marquant = m ? `<div class="marquant">Le plus marquant : ${m.centre === 'A' ? phraseCas(nomA, nomB, m) : phraseCas(nomB, nomA, m)}</div>`
    : '<div class="marquant">Rien ne ressort nettement pour l\'instant : les deux semblent arriver indépendamment.</div>';
  const faits = [];
  const o = r.ordre;
  if (o.aAvant + o.bAvant >= 2) {
    const [p, q, n, ec] = o.aAvant >= o.bAvant ? [nomA, nomB, o.aAvant, o.ecartA] : [nomB, nomA, o.bAvant, o.ecartB];
    faits.push(['', `Les jours où les deux ont une heure, <b>${p}</b> vient avant ${q} <b>${fois(n, o.aAvant + o.bAvant)}</b>${ec != null ? `, environ ${texteDuree(ec)} avant` : ''}.`]);
  }
  for (const [cal, ech, autre] of [[A_, r.echelleA, nomB], [B_, r.echelleB, nomA]]) {
    if (!ech) continue;
    faits.push([Math.abs(ech.avec - ech.sans) >= 1 ? 'fort' : '', `${esc(cal.echelle.nom)} de ${esc(cal.nom)} : <b>${nombre(ech.avec)}</b> en moyenne les jours avec ${autre}, contre ${nombre(ech.sans)} les autres jours.`]);
  }
  const proches = r.proches.map((p) => {
    const k = ecartJours(p.a, p.b);
    return `<li>${k === 0 ? `${dateCourte(p.a)} : les deux le même jour` : k > 0 ? `${dateCourte(p.a)} : ${nomA}, puis ${nomB} le lendemain` : `${dateCourte(p.b)} : ${nomB}, puis ${nomA} le lendemain`}</li>`;
  }).join('');
  return `<div class="carte-lien">${tete}${marquant}
    ${tableAutour(A_, B_, r.autourA)}
    ${tableAutour(B_, A_, r.autourB)}
    ${faits.length ? `<ul class="faits" style="margin-top:8px">${faits.map(([cl, t]) => `<li class="${cl}">${t}</li>`).join('')}</ul>` : ''}
    ${proches ? `<p class="sous-titre">Dernières fois rapprochées</p><ul class="faits">${proches}</ul>` : ''}
    <p class="aide" style="font-size:12.5px">« D'habitude » : part de tous les jours suivis où l'autre calendrier est coché. En couleur : nettement plus (rouge) ou moins (bleu) que d'habitude, avec au moins 3 cas.</p>
    ${delier}</div>`;
}

function vueCroiser() {
  const liens = S.get().liens;
  app.innerHTML = `
    ${bandeau({ retour: '#/', titre: 'Croisements', petit: 'Ce qui arrive avant, pendant, après' })}
    <p class="aide" style="margin:0 4px 12px">Choisis les calendriers qui ont un sens ensemble (stress et fatigue, oui ; ampoules de voiture et stress, sans doute pas). L'appli montre des faits comptés : à toi d'en tirer le sens.</p>
    <button class="btn btn-principal btn-large" data-action="lier">${I.lien} Lier deux calendriers</button>
    ${liens.length ? liens.map((l) => carteCroisement(S.calendrier(l.a), S.calendrier(l.b), l.id)).join('') : '<p class="vide">Aucun croisement pour l\'instant.</p>'}`;
}

function fenetreLier() {
  const cals = S.calendriers();
  if (cals.length < 2) return toast('Il faut au moins deux calendriers');
  const options = (sel) => cals.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.nom)}</option>`).join('');
  ouvrirFenetre(`<form>
    <h2>Lier deux calendriers</h2>
    <label class="champ"><span>Celui-ci…</span><select name="a">${options(cals[0].id)}</select></label>
    <label class="champ"><span>…avec celui-là</span><select name="b">${options(cals[1].id)}</select></label>
    <button class="btn btn-principal btn-large">Lier</button>
  </form>`, (fd) => {
    const a = fd.get('a'), b = fd.get('b');
    if (a === b) return toast('Choisis deux calendriers différents');
    if (!S.lier(a, b)) return toast('Ces deux-là sont déjà liés');
    fermer(); route(); toast('Calendriers liés');
  });
}

// --- Réglages de l'appli : code, sauvegarde ----------------------------------------------

function vueReglages() {
  const r = S.get().reglages;
  const copie = S.copieDisponible();
  app.innerHTML = `
    ${bandeau({ retour: '#/', titre: 'Réglages' })}
    <div class="carte">
      <h3>Code de verrouillage <small>${r.code ? 'activé' : 'aucun'}</small></h3>
      <p class="aide">Un code à 6 chiffres demandé à l'ouverture et après 5 minutes en arrière-plan. Il empêche d'ouvrir l'appli, mais les données ne sont pas chiffrées.</p>
      <button class="btn btn-large ${r.code ? '' : 'btn-principal'}" data-action="code">${I.cadenas} ${r.code ? (r.code.longueur || 4) < V.LONGUEUR ? 'Passer à un code à 6 chiffres' : 'Changer le code' : 'Créer un code'}</button>
      ${r.code ? '<div class="actions-sec"><button class="lien danger" data-action="supprimer-code">Supprimer le code</button></div>' : ''}
    </div>
    <div class="carte">
      <h3>Sauvegarde <small>${r.dernierExport ? `dernier export : ${ilYA(r.dernierExport)}` : 'jamais exporté'}</small></h3>
      <p class="aide">Un seul fichier contient tout : calendriers, réglages, saisies, jours loupés, croisements. À ranger dans un stockage protégé (Proton Drive par exemple).</p>
      <button class="btn btn-principal btn-large" data-action="exporter">${I.partage} Exporter toutes mes données</button>
      <label class="btn btn-large">Restaurer depuis un export<input type="file" accept=".txt,.json,text/plain,application/json" hidden data-f="import"></label>
      ${copie ? `<div class="actions-sec"><button class="lien" data-action="annuler-import">Annuler le dernier import (revenir à l'état du ${new Date(copie).toLocaleDateString('fr-FR')})</button></div>` : ''}
    </div>
    <div class="carte">
      <h3>Exemple</h3>
      <p class="aide">Trois calendriers inventés sur quatre mois, pour voir à quoi ressemblent les stats et les croisements.</p>
      ${S.aDesExemples() ? '<button class="btn btn-large" data-action="retirer-exemple">Retirer l\'exemple</button>' : '<button class="btn btn-large" data-action="charger-exemple">Charger l\'exemple</button>'}
    </div>
    <div class="zone-danger"><button class="lien danger" data-action="tout-effacer">Tout effacer sur cet appareil</button></div>
    <p class="pied">Logger · les données restent dans ce navigateur</p>`;
  app.querySelector('[data-f="import"]').addEventListener('change', (ev) => importer(ev.target.files[0]));
}

async function importer(fichier) {
  if (!fichier) return;
  let d;
  try { d = S.lireExport(await fichier.text()); } catch (e) { return toast(e.message); }
  const presents = new Set(S.calendriers().map((c) => c.id));
  const absents = d.calendriers.filter((c) => !presents.has(c.id)).length;
  ouvrirFenetre(`<div class="pile">
    <h2>Restaurer</h2>
    <p class="aide">${esc(fichier.name)}<br>${pluriel(d.calendriers.length, 'calendrier')} · ${pluriel(d.saisies.length, 'saisie')}${d.le ? ` · exporté le ${new Date(d.le).toLocaleDateString('fr-FR')}` : ''}</p>
    <button class="btn btn-large" data-f="ajouter" ${absents ? '' : 'disabled'}>Ajouter les calendriers absents (${absents})</button>
    <button class="btn btn-principal btn-large" data-f="remplacer">Tout remplacer</button>
    <p class="aide">Une copie de tes données actuelles est faite avant : tu pourras annuler l'import (Réglages).</p>
  </div>`);
  const faire = (mode) => {
    const n = S.importer(d, mode);
    fermer(); aller('#/');
    toast(mode === 'remplacer' ? 'Données restaurées' : `${pluriel(n, 'calendrier ajouté', 'calendriers ajoutés')}`, { libelle: 'Annuler', action: annulerImport });
  };
  couche.querySelector('[data-f="ajouter"]').onclick = () => faire('ajouter');
  couche.querySelector('[data-f="remplacer"]').onclick = () => faire('remplacer');
}

function annulerImport() {
  if (!S.copieDisponible()) return toast('Aucune copie à restaurer');
  S.restaurerCopie(); route(); toast('Import annulé');
}

async function exporter() {
  const a = auj().replaceAll('-', '');
  await partagerFichier(`${a} - Logger - Export complet.txt`, S.contenuExport());
  S.noterExport();
  route();
}

async function partagerFichier(nom, contenu) {
  // .txt : Android refuse de partager du .json ; le contenu reste du JSON lisible.
  const fichier = new File([contenu], nom, { type: 'text/plain' });
  try {
    if (navigator.canShare?.({ files: [fichier] })) {
      await navigator.share({ files: [fichier], title: nom });
      toast('Export partagé');
      return;
    }
  } catch (e) {
    if (e?.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(fichier);
  a.download = nom;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast('Export téléchargé');
}

// --- Code -------------------------------------------------------------------------------

function fenetreCode() {
  let premier = null;
  ouvrirFenetre('<div class="pile"><h2 data-titre>Nouveau code</h2><p class="aide centre" data-aide>Choisis 6 chiffres.</p><div data-pave></div></div>');
  const titre = couche.querySelector('[data-titre]'), aide = couche.querySelector('[data-aide]');
  V.pave(couche.querySelector('[data-pave]'), async (code, recommencer) => {
    if (!premier) {
      if (V.tropSimple(code)) { aide.textContent = 'Trop simple : choisis-en un autre.'; return recommencer(true); }
      premier = code; titre.textContent = 'Confirme le code'; aide.textContent = 'Tape-le une seconde fois.';
      return recommencer();
    }
    if (code !== premier) { premier = null; titre.textContent = 'Nouveau code'; aide.textContent = 'Les deux codes diffèrent. Recommence.'; return recommencer(true); }
    const sel = Math.random().toString(36).slice(2, 10);
    S.get().reglages.code = { sel, empreinte: await V.empreinte(code, sel), longueur: V.LONGUEUR };
    S.enregistrer(); fermer(); route(); toast('Code enregistré');
  });
}

let enArrierePlan = null;

function verrouiller() {
  const code = S.get().reglages.code;
  if (!code) return false;
  fermer();
  app.innerHTML = '';
  verrouEl.innerHTML = '<img src="icons/icon-192.png" alt=""><h2>Logger</h2><div data-pave></div><button class="lien" data-f="oubli">Code oublié ?</button>';
  verrouEl.hidden = false;
  V.pave(verrouEl.querySelector('[data-pave]'), async (saisi, recommencer) => {
    if (await V.empreinte(saisi, code.sel) !== code.empreinte) return recommencer(true);
    verrouEl.hidden = true;
    verrouEl.innerHTML = '';
    route();
    if ((code.longueur || 4) < V.LONGUEUR) toast('Ton code a 4 chiffres : passe-le à 6 dans Réglages', { libelle: 'Changer', action: () => aller('#/reglages') });
  }, code.longueur || 4);
  verrouEl.querySelector('[data-f="oubli"]').onclick = (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.arme) {
      b.dataset.arme = '1';
      b.textContent = 'Sans le code, seule issue : tout effacer sur cet appareil, puis restaurer ton dernier export. Toucher encore pour tout effacer.';
      return;
    }
    if (!confirmerDeux(b)) return;
    S.toutEffacer(); verrouEl.hidden = true; verrouEl.innerHTML = ''; route(); toast('Données effacées');
  };
  return true;
}

// --- Fenêtres et messages --------------------------------------------------------------

function ouvrirFenetre(html, onSubmit) {
  couche.innerHTML = `<div class="fenetre" role="dialog" aria-modal="true"><div class="poignee-fenetre"></div>${html}</div>`;
  couche.hidden = false;
  document.body.classList.add('fige');
  couche.onclick = (ev) => { if (ev.target === couche) fermer(); };
  const f = couche.querySelector('form');
  if (f && onSubmit) f.onsubmit = (ev) => { ev.preventDefault(); onSubmit(new FormData(f), f); };
}

function fermer() {
  couche.hidden = true;
  couche.innerHTML = '';
  document.body.classList.remove('fige');
}

let toastMinuteur;
function toast(t, bouton = null) {
  toastEl.innerHTML = `<span>${esc(t)}</span>${bouton ? `<button>${esc(bouton.libelle)}</button>` : ''}`;
  toastEl.hidden = false;
  if (bouton) toastEl.querySelector('button').onclick = () => { toastEl.hidden = true; bouton.action(); };
  clearTimeout(toastMinuteur);
  toastMinuteur = setTimeout(() => { toastEl.hidden = true; }, bouton ? 5000 : 2600);
}

function confirmerDeux(btn) {
  if (btn.dataset.confirme) return true;
  btn.dataset.confirme = '1';
  const t = btn.textContent;
  btn.textContent = 'Toucher encore pour confirmer';
  setTimeout(() => { delete btn.dataset.confirme; btn.textContent = t; }, 3000);
  return false;
}

function fenetreNom(titre, aide, onOk) {
  ouvrirFenetre(`<form><h2>${titre}</h2>${aide ? `<p class="aide">${aide}</p>` : ''}
    <label class="champ"><span>Nom</span><input name="nom" autocomplete="off" required placeholder="Fatigue, Stress, Clés oubliées…"></label>
    <button class="btn btn-principal btn-large">Continuer</button></form>`, (fd) => {
    const n = majuscule(fd.get('nom'));
    if (n) onOk(n);
  });
  setTimeout(() => couche.querySelector('input')?.focus(), 60);
}

// --- Actions ------------------------------------------------------------------------

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) return;
  const d = el.dataset;
  const calCourant = () => S.calendrier(location.hash.split('/')[2]);
  switch (d.action) {
    case 'aller': return aller(d.h);
    case 'nouveau':
      return fenetreNom('Nouveau calendrier', 'Ce que tu veux suivre. Tu régleras ensuite le type de saisie, une échelle, des étiquettes.', (n) => {
        const c = S.creerCalendrier(n);
        fermer();
        history.pushState(null, '', `#/r/${c.id}`);
        vueConfig(c, true);
      });
    case 'maintenant': return maintenant(d.id ? S.calendrier(d.id) : calCourant());
    case 'jour': return fenetreJour(calCourant(), d.date);
    case 'saisie': { const s = S.saisie(d.id); return fenetreSaisie(S.calendrier(s.cal), s); }
    case 'mois': {
      const c = calCourant();
      const [a, m] = moisAffiche[c.id].split('-').map(Number);
      const n = new Date(a, m - 1 + Number(d.pas), 1);
      moisAffiche[c.id] = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
      return vueCalendrier(c);
    }
    case 'mois-actuel': { const c = calCourant(); moisAffiche[c.id] = auj().slice(0, 7); return vueCalendrier(c); }
    case 'periode': {
      const c = calCourant();
      if (d.p !== 'dates') { periode = { id: d.p }; return vueStats(c); }
      return ouvrirFenetre(`<form><h2>Période</h2>
        <div class="deux"><label class="champ"><span>Du</span><input type="date" name="du" value="${periode.du || c.debut}" max="${auj()}"></label>
        <label class="champ"><span>Au</span><input type="date" name="au" value="${periode.au || auj()}" max="${auj()}"></label></div>
        <button class="btn btn-principal btn-large">Afficher</button></form>`, (fd) => {
        const du = fd.get('du'), au = fd.get('au');
        if (!du || !au || du > au) return toast('Choisis un début avant la fin');
        periode = { id: 'dates', du, au }; fermer(); vueStats(c);
      });
    }
    case 'lier': return fenetreLier();
    case 'delier': if (confirmerDeux(el)) { S.delier(d.id); route(); toast('Croisement retiré'); } return;
    case 'exporter': return exporter();
    case 'annuler-import': return annulerImport();
    case 'code': return fenetreCode();
    case 'supprimer-code': if (confirmerDeux(el)) { delete S.get().reglages.code; S.enregistrer(); route(); toast('Code supprimé'); } return;
    case 'charger-exemple': S.chargerExemple(exemple()); toast('Exemple chargé'); return aller('#/');
    case 'retirer-exemple': if (confirmerDeux(el)) { S.retirerExemples(); route(); toast('Exemple retiré'); } return;
    case 'tout-effacer': if (confirmerDeux(el)) { S.toutEffacer(); toast('Tout est effacé'); aller('#/'); } return;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { enArrierePlan = Date.now(); return; }
  if (enArrierePlan && Date.now() - enArrierePlan > V.DELAI && verrouEl.hidden) verrouiller();
  enArrierePlan = null;
  if (verrouEl.hidden && (location.hash.startsWith('#/c/') || location.hash === '#/' || !location.hash)) route(); // « aujourd'hui » a pu changer
});
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !couche.hidden) fermer(); });

G.activerBulles();
suivreZoneVisible();
if (!verrouiller()) route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
