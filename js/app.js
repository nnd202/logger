// Logger v2 : un journal unique de santé mentale.
// Écran du jour : pastilles de jours, mini-frise des 24 heures (le planning replié),
// planning déployable, puis les notes du jour en cartes, chaque carte portant son enchaînement.
import * as S from './store.js';
import * as V from './verrou.js';
import * as C from './crypto.js';
import { exemple } from './demo.js';
import { activerBulles, teinte } from './graph.js';
import { FAMILLES, famille, SAISIE, CERCLES, FACETTES, MOMENTS, AIDE, ISSUES, DEBUT_JOURNEE, LATENCES, ZONE_MIN } from './catalogue.js';
import {
  aujourdhui, heureMaintenant, ajouterJours, jourSemaine, dateCourte, dateNum, dateLongue, JOURS_COURTS,
  horodatage, minutes, ajouterMinutes, jourDe, heureDe, texteDuree, pluriel, ilYA, majuscule,
} from './calc.js';

const app = document.getElementById('app');
const couche = document.getElementById('couche');
const toastEl = document.getElementById('toast');
const verrouEl = document.getElementById('verrou');
const panneau = document.getElementById('panneau');
const barre = document.getElementById('barre');

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const I = {
  retour: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  droite: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  bas: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  croix: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  reglages: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  jour: '<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  partage: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  cadenas: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
  moins: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  chaine: '<svg viewBox="0 0 24 24"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>',
  guide: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2"/></svg>',
};

const auj = () => jourDe(horodatage(), DEBUT_JOURNEE);
const maintenantMin = () => Math.round(Date.now() / 60000);
let jourAffiche = null;
let resserre = true;
let familleSaisie = 'etat';

// --- Zone visible : les fenêtres suivent le clavier et les barres du navigateur ------------

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

// --- Navigation -------------------------------------------------------------------------

function route() {
  if (!verrouEl.hidden) return;
  fermer(false);
  const h = location.hash || '#/';
  const m = h.match(/^#\/j\/(\d{4}-\d{2}-\d{2})$/);
  let vue = 'jour';
  if (m) { jourAffiche = m[1] > auj() ? auj() : m[1]; vueJour(); }
  else if (h === '#/reglages') { vue = 'reglages'; vueReglages(); }
  else if (h === '#/reglages/types') { vue = 'reglages'; vueTypes(); }
  else if (h === '#/reglages/etiquettes') { vue = 'reglages'; vueEtiquettes(); }
  else if (h === '#/guide') { vue = 'reglages'; vueGuide(); }
  else { jourAffiche = auj(); vueJour(); }
  dessinerBarre(vue);
}

function aller(h) {
  if (location.hash === h || (h === '#/' && !location.hash)) route(); else location.hash = h;
}

const lienJour = (d) => (d === auj() ? '#/' : `#/j/${d}`);

function dessinerBarre(vue) {
  barre.hidden = false;
  barre.innerHTML = `
    <button class="${vue === 'jour' ? 'actif' : ''}" data-barre="#/">${I.jour}<span>Journée</span></button>
    <button class="barre-noter" data-barre="noter" aria-label="Noter">${I.plus}</button>
    <button class="${vue === 'reglages' ? 'actif' : ''}" data-barre="#/reglages">${I.reglages}<span>Réglages</span></button>`;
}

function bandeau({ retour, petit, titre }) {
  return `<header class="bandeau-tete">
    <div class="bandeau-ligne">
      ${retour ? `<button class="btn-icone sur-couleur" data-action="aller" data-h="${retour}" aria-label="Retour">${I.retour}</button>` : ''}
      <div class="bandeau-titre">${petit ? `<small>${petit}</small>` : ''}<h1>${titre}</h1></div>
    </div>
  </header>`;
}

// --- Petits textes -----------------------------------------------------------------------

const couleurDe = (n) => famille(S.type(n.type)?.famille)?.couleur || '#8f9db0';
const familleDe = (n) => famille(S.type(n.type)?.famille);
const nomType = (id) => S.type(id)?.nom || 'Type supprimé';
const sansZero = (h) => h.replace(/^0(\d)/, '$1');

function quand(n, long = false) {
  if (n.precision === 'moment') return MOMENTS.find((m) => m.heure === heureDe(n.debut))?.nom || heureDe(n.debut);
  const h = sansZero(heureDe(n.debut));
  if (n.enCours) return long ? `depuis ${h}, en cours` : `${h} → …`;
  if (n.fin) return long ? `de ${n.precision === 'vers' ? 'vers ' : ''}${h} à ${sansZero(heureDe(n.fin))}` : `${h} → ${sansZero(heureDe(n.fin))}`;
  return long ? `${n.precision === 'vers' ? 'vers' : 'à'} ${h}` : `${n.precision === 'vers' ? '~' : ''}${h}`;
}

const dureeNote = (n) => (n.fin ? minutes(n.fin) - minutes(n.debut) : n.enCours ? maintenantMin() - minutes(n.debut) : 0);

function details(n) {
  const bouts = [];
  if (n.issue) bouts.push(ISSUES.find((x) => x.id === n.issue)?.nom.toLowerCase());
  if (n.aide) bouts.push(AIDE.find((x) => x.id === n.aide)?.nom.toLowerCase());
  if (n.motif) bouts.push(n.motif);
  if (n.activite) bouts.push(n.activite);
  if (n.plaisir != null) bouts.push(`plaisir ${n.plaisir}`);
  if (n.maitrise != null) bouts.push(`maîtrise ${n.maitrise}`);
  if (n.quantite) bouts.push(n.quantite);
  const d = dureeNote(n);
  if (d > 0) bouts.push(texteDuree(d));
  const qui = [...n.avecQui.map((c) => CERCLES.find((x) => x.id === c)?.nom), ...n.personnes.map((p) => S.personne(p)?.nom)].filter(Boolean);
  if (qui.length) bouts.push(qui.length === 1 && qui[0] === 'Seul' ? 'seul' : `avec ${qui.join(', ')}`);
  return bouts.filter(Boolean);
}

const pastilles = (n) => [
  ...details(n).map((t) => `<span class="pastille-info">${esc(t)}</span>`),
  ...n.etiquettes.map((id) => S.etiquette(id)?.nom).filter(Boolean).map((t) => `<span class="etiquette">${esc(t)}</span>`),
].join('');

function etiquettesParUsage() {
  const us = S.usages('etiquettes');
  return S.get().etiquettes.filter((e) => !e.archive).sort((a, b) => (us.get(b.id) || 0) - (us.get(a.id) || 0));
}

// --- Vue jour ----------------------------------------------------------------------------------

function pastillesJours(d) {
  const a = auj();
  const avecNotes = new Set(S.get().notes.map((n) => jourDe(n.debut, DEBUT_JOURNEE)));
  const jours = [];
  for (let k = -60; k <= 3; k++) jours.push(ajouterJours(a, k));
  return `<div class="jours" data-jours>${jours.map((j) => {
    const futur = j > a;
    const cls = [j === a && 'auj', j === d && 'vu', futur && 'futur', S.statutJour(j) === 'pause' && 'pause'].filter(Boolean).join(' ');
    return `<button class="jour-pastille ${cls}" ${futur ? 'disabled' : `data-action="aller" data-h="${lienJour(j)}"`} ${j === d ? 'aria-current="date"' : ''}>
      <small>${JOURS_COURTS[jourSemaine(j)]}</small><b>${Number(j.slice(8))}</b><i class="${avecNotes.has(j) ? 'oui' : ''}"></i></button>`;
  }).join('')}</div>`;
}

/** Notes à afficher un jour donné : celles du jour, plus les plages venues de la veille. */
function notesAffichees(d) {
  const jour = S.notesDuJour(d);
  return [...S.plagesTraversantes(d).filter((n) => !jour.includes(n)), ...jour];
}

function vueJour() {
  const d = jourAffiche;
  const a = auj();
  const notes = S.notesDuJour(d);
  const affichees = notesAffichees(d);
  const statut = S.statutJour(d);
  const pause = S.enPause(d);
  const titre = d === a ? "Aujourd'hui" : d === ajouterJours(a, -1) ? 'Hier' : majuscule(dateCourte(d));
  const encours = S.enCours();
  const ouvert = S.reglages().planningOuvert;
  // Cartes : une tête d'enchaînement par carte ; une suite dont la tête est un autre jour fait sa propre carte.
  const ids = new Set(notes.map((n) => n.id));
  const tetes = notes.filter((n) => !n.chaine || !ids.has(n.chaine));

  app.innerHTML = `
    <header class="bandeau-tete bandeau-jour">
      <div class="bandeau-ligne">
        <button class="btn-icone sur-couleur" data-action="aller" data-h="${lienJour(ajouterJours(d, -1))}" aria-label="Jour précédent">${I.retour}</button>
        <button class="bandeau-titre titre-date" data-action="date" aria-label="Choisir une date"><small>${majuscule(dateLongue(d))}</small><h1>${titre}</h1></button>
        <button class="btn-icone sur-couleur" data-action="aller" data-h="${lienJour(ajouterJours(d, 1))}" aria-label="Jour suivant" ${d >= a ? 'disabled' : ''}>${I.droite}</button>
      </div>
      ${pastillesJours(d)}
    </header>
    ${encours.length ? `<div class="en-cours">${encours.map((n) => `<div class="carte-encours" style="--c:${couleurDe(n)}">
        <button class="ouvrir" data-action="note" data-id="${n.id}"><b><i class="pastille-mini"></i>${esc(nomType(n.type))}</b><small>en cours depuis ${sansZero(heureDe(n.debut))} · ${texteDuree(dureeNote(n))}</small></button>
        <button class="btn btn-stop" data-action="arreter" data-id="${n.id}">${I.stop} J'arrête</button></div>`).join('')}</div>` : ''}
    <section class="carte-planning ${ouvert ? 'ouvert' : ''}">
      <button class="planning-tete" data-action="planning" aria-expanded="${ouvert}">
        ${miniFrise(d, affichees)}
        <span class="planning-bascule">${ouvert ? 'Replier le planning' : 'Déployer le planning'} ${I.bas}</span>
      </button>
      ${ouvert ? (affichees.length ? planning(d, affichees) : '<p class="vide">Rien à placer sur le planning.</p>') : ''}
    </section>
    ${statut === 'pause' ? `<div class="statut-jour statut-pause"><span>Pause du suivi depuis le ${dateNum(pause.du)}</span><button class="lien" data-action="fin-pause">Reprendre</button></div>` : ''}
    ${tetes.length ? `<ul class="cartes">${tetes.map((t) => carteNote(t)).join('')}</ul>` : `
      <div class="jour-vide">
        <p>${d === a ? 'Rien de noté pour l\'instant. Touche <b>+</b> en bas quand quelque chose se passe.' : 'Aucune note ce jour-là.'}</p>
        ${statut === 'calme'
          ? '<p class="marque-calme">Marqué « rien à signaler » <button class="lien" data-action="calme">Retirer</button></p>'
          : statut !== 'pause' ? `<button class="btn" data-action="calme">Marquer ce jour « rien à signaler »</button>
            <p class="aide">Ce jour compte alors comme renseigné, sans rien de particulier. Sans ce marquage, un jour vide ne compte nulle part.</p>` : ''}
      </div>`}
    <div class="pied-jour"><button class="lien" data-action="aller" data-h="#/guide">${I.guide} Tout ce que fait Logger</button></div>`;
  // Les pastilles centrent le jour affiché.
  const bande = app.querySelector('[data-jours]');
  const vu = bande.querySelector('.vu');
  const centrer = () => { bande.scrollLeft = vu.offsetLeft - bande.clientWidth / 2 + vu.offsetWidth / 2; };
  centrer();
  requestAnimationFrame(centrer);
}

/** 24 points, un par heure : gris clair sans note, puis de plus en plus colorés. */
function miniFrise(d, notes) {
  const zero = minutes(`${d}T00:00`);
  const compte = Array(24).fill(0);
  const now = maintenantMin();
  for (const n of notes) {
    const a = Math.max(0, Math.floor((minutes(n.debut) - zero) / 60));
    const f = n.enCours ? now : n.fin ? minutes(n.fin) : minutes(n.debut);
    const b = Math.min(23, Math.floor((f - zero - 1e-6) / 60));
    for (let h = a; h <= Math.max(a, b) && h < 24; h++) compte[h]++;
  }
  const max = Math.max(3, ...compte);
  return `<span class="mini-frise">${compte.map((c, h) => `<i style="background:${c ? teinte(0.3 + 0.7 * Math.min(1, (c - 1) / (max - 1))) : '#e9e5e7'}" data-tip="${c ? pluriel(c, 'note') : 'Rien'}\n${h} h – ${h + 1} h"></i>`).join('')}</span>
    <span class="mini-heures"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></span>`;
}

/** Carte d'une note et de son enchaînement. */
function carteNote(t) {
  const suites = S.suitesDe(t.id);
  const f = familleDe(t);
  const tete = S.type(t.type);
  const venueDAvant = t.chaine && S.note(t.chaine);
  return `<li class="carte-note" style="--c:${f?.couleur}">
    <button class="cn-tete" data-action="note" data-id="${t.id}">
      <span class="cn-famille">${f?.un || ''}${t.fin || t.enCours ? ' · plage' : ''}</span>
      <span class="cn-titre"><b>${esc(tete?.nom || 'Type supprimé')}</b>${t.intensite != null ? `<span class="valeur">${t.intensite}</span>` : ''}</span>
      <span class="cn-quand">${esc(quand(t, true))}${venueDAvant ? ` · suite du ${dateCourte(venueDAvant.debut.slice(0, 10))}` : ''}</span>
      ${pastilles(t) ? `<span class="cn-pastilles">${pastilles(t)}</span>` : ''}
      ${t.phrase ? `<em class="cn-phrase">${esc(t.phrase)}</em>` : ''}
    </button>
    ${suites.length ? `<ol class="cn-suites">${suites.map((s) => `<li><button data-action="note" data-id="${s.id}" style="--c:${couleurDe(s)}">
      <span class="cs-quand">${esc(quand(s))}</span><span class="cs-texte"><b><i class="pastille-mini"></i>${esc(nomType(s.type))}</b>${details(s).length || s.etiquettes.length ? `<small>${esc([...details(s), ...s.etiquettes.map((id) => S.etiquette(id)?.nom).filter(Boolean)].join(' · '))}</small>` : ''}</span>
      ${s.intensite != null ? `<span class="valeur">${s.intensite}</span>` : ''}</button></li>`).join('')}</ol>` : ''}
    <button class="cn-enchainer" data-action="enchainer" data-id="${t.id}">${I.chaine} Enchaîner une note</button>
  </li>`;
}

/**
 * Planning déployé : le temps descend, chaque enchaînement a son couloir (un trait qui relie ses notes),
 * les noms s'écrivent à l'horizontale à droite. Même taille de point pour tout le monde.
 */
function planning(d, notes) {
  const px = S.reglages().echelleHeure;
  const zero = minutes(`${d}T00:00`);
  const now = maintenantMin();
  const h = (m) => (m - zero) / 60;
  const debutM = (n) => Math.max(zero, minutes(n.debut));
  const finM = (n) => Math.min(zero + 1440, n.enCours ? now : n.fin ? minutes(n.fin) : minutes(n.debut));
  let h0 = 0, h1 = 24;
  if (resserre) {
    h0 = Math.max(0, Math.floor(Math.min(...notes.map((n) => h(debutM(n))))) - 1);
    h1 = Math.min(24, Math.ceil(Math.max(...notes.map((n) => h(finM(n))))) + 1);
    if (h1 - h0 < 4) h1 = Math.min(24, h0 + 4);
  }
  const HAUT = 12;
  const y = (m) => HAUT + (h(m) - h0) * px;
  // Enchaînements : la tête et ses suites ; une note seule est un enchaînement d'une note.
  const groupes = new Map();
  for (const n of notes) {
    const cle = n.chaine && notes.some((x) => x.id === n.chaine) ? n.chaine : n.id;
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(n);
  }
  const liste = [...groupes.values()].map((g) => ({ notes: g, a: Math.min(...g.map(debutM)), b: Math.max(...g.map(finM)) })).sort((p, q) => p.a - q.a);
  const finsCouloirs = [];
  for (const g of liste) {
    let c = finsCouloirs.findIndex((fin) => fin < g.a - 10);
    if (c < 0) { c = finsCouloirs.length; finsCouloirs.push(0); }
    finsCouloirs[c] = g.b;
    g.couloir = c;
  }
  const L = Math.max(1, finsCouloirs.length);
  const X0 = 44, PAS = 18;
  const xC = (c) => X0 + c * PAS + 8;
  const xTexte = X0 + L * PAS + 12;
  const W = 360;
  // Étiquettes à l'horizontale, poussées vers le bas si elles se chevauchent.
  const items = liste.flatMap((g) => g.notes.map((n) => ({ n, g, yp: y(debutM(n)) }))).sort((p, q) => p.yp - q.yp);
  let bas = -Infinity;
  for (const it of items) { it.ye = Math.max(it.yp, bas + 19); bas = it.ye; }
  const H = Math.max(y(h1 * 60 + zero), bas + 16) + 8;
  const heures = [];
  for (let k = h0; k <= h1; k++) {
    heures.push(`<line x1="${X0}" x2="${W}" y1="${y(zero + k * 60)}" y2="${y(zero + k * 60)}" class="pl-grille"/><text x="${X0 - 8}" y="${y(zero + k * 60) + 3.5}" class="pl-heure">${k} h</text>`);
  }
  const degrades = FAMILLES.map((f) => `<linearGradient id="dg-${f.id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${f.couleur}" stop-opacity="0.12"/><stop offset="1" stop-color="${f.couleur}"/></linearGradient>`).join('');
  const traits = liste.filter((g) => g.notes.length > 1).map((g) => `<line x1="${xC(g.couloir)}" x2="${xC(g.couloir)}" y1="${y(g.a)}" y2="${y(g.b)}" class="pl-trait"/>`).join('');
  const marques = items.map(({ n, g, yp, ye }) => {
    const f = familleDe(n);
    const x = xC(g.couloir);
    const plage = n.fin || n.enCours;
    const corps = plage
      ? `<rect x="${x - 5}" y="${yp}" width="10" height="${Math.max(8, y(finM(n)) - yp)}" rx="5" fill="${S.type(n.type)?.endormissement ? `url(#dg-${f?.id})` : f?.couleur}" ${n.enCours ? 'class="pl-encours"' : ''}/>`
      : `<circle cx="${x}" cy="${yp}" r="5.5" ${n.precision !== 'exacte' ? `fill="#fff" stroke="${f?.couleur}" stroke-width="2.2"` : `fill="${f?.couleur}"`}/>`;
    const lien = Math.abs(ye - yp) > 2 ? `<path d="M${x + 7} ${yp} L${xTexte - 4} ${ye}" class="pl-lien"/>` : '';
    const texte = `<text x="${xTexte}" y="${ye + 4}" class="pl-texte"><tspan class="pl-t">${esc(quand(n))}</tspan> ${esc(nomType(n.type))}${n.intensite != null ? ` · ${n.intensite}` : ''}</text>`;
    return `<g data-action="note" data-id="${n.id}" class="pl-note">${lien}${corps}${texte}<rect x="${xTexte - 6}" y="${ye - 9}" width="${W - xTexte + 6}" height="18" fill="transparent"/></g>`;
  }).join('');
  const vNow = h(now);
  const ligneNow = d === auj() && vNow >= h0 && vNow <= h1 ? `<line x1="${X0}" x2="${W}" y1="${y(now)}" y2="${y(now)}" class="pl-now"/><rect x="2" y="${y(now) - 8}" width="36" height="16" rx="5" class="pl-now-fond"/><text x="20" y="${y(now) + 4}" class="pl-now-texte">${heureMaintenant()}</text>` : '';
  return `<div class="planning-outils">
      <button class="puce" data-action="resserrer">${resserre ? 'Voir les 24 h' : 'Resserrer sur les notes'}</button>
      <span class="frise-zoom"><span>Hauteur</span><button class="btn-icone petit" data-action="zoom" data-pas="-1" aria-label="Moins haut">${I.moins}</button><button class="btn-icone petit" data-action="zoom" data-pas="1" aria-label="Plus haut">${I.plus}</button></span>
    </div>
    <svg class="planning" viewBox="0 0 ${W} ${H}" style="aspect-ratio:${W}/${H}"><defs>${degrades}</defs>${heures.join('')}${traits}${marques}${ligneNow}</svg>
    <div class="legende-frise"><span><i class="lp"></i>note</span><span><i class="la"></i>heure approximative</span><span><i class="lb"></i>durée</span><span><i class="lt"></i>enchaînement</span></div>`;
}

// --- Saisie -------------------------------------------------------------------------------------

/** Fenêtre de saisie : hauteur fixe, les onglets ne rechargent que la grille. contexte.chaine : enchaîner. */
function vueNoter(contexte = {}) {
  const us = S.usages('type');
  const frequents = [...us].sort((a, b) => b[1] - a[1]).map(([id]) => S.type(id)).filter((t) => t?.visible).slice(0, 6);
  const tete = contexte.chaine ? S.note(contexte.chaine) : null;
  ouvrirFenetre(`<div class="saisie">
    <h2>${tete ? `Enchaîner <small>à ${esc(nomType(tete.type))} (${sansZero(heureDe(tete.debut))})</small>` : `Noter <small>${heureMaintenant()}</small>`}</h2>
    ${frequents.length ? `<p class="titre-choix">Les plus utilisés</p><div class="choix frequents">${frequents.map((t) => `<button class="puce type-puce" style="--c:${famille(t.famille).couleur}" data-type="${t.id}"><i class="pastille-mini"></i>${esc(t.nom)}</button>`).join('')}</div>` : ''}
    <div class="onglets" role="tablist">${FAMILLES.map((f) => `<button class="${f.id === familleSaisie ? 'choisi' : ''}" style="--c:${f.couleur}" data-famille="${f.id}">${f.nom}</button>`).join('')}</div>
    <div class="saisie-corps" data-grille></div>
  </div>`, null, 'fixe');
  const fen = couche.querySelector('.fenetre');
  const grille = fen.querySelector('[data-grille]');
  const remplir = () => {
    grille.innerHTML = `<p class="aide">${famille(familleSaisie).aide}</p>
      <div class="grille-types">${S.typesVisibles(familleSaisie).map((t) => `<button class="btn-type" style="--c:${famille(t.famille).couleur}" data-type="${t.id}">${esc(t.nom)}</button>`).join('')}
      <button class="btn-type ajout" data-f="nouveau-type">${I.plus} Autre</button></div>`;
    grille.scrollTop = 0;
  };
  remplir();
  fen.addEventListener('click', (ev) => {
    const onglet = ev.target.closest('[data-famille]');
    if (onglet) {
      familleSaisie = onglet.dataset.famille;
      fen.querySelectorAll('[data-famille]').forEach((b) => b.classList.toggle('choisi', b === onglet));
      return remplir();
    }
    const b = ev.target.closest('[data-type]');
    if (b) return etape2(S.type(b.dataset.type), contexte);
    if (ev.target.closest('[data-f="nouveau-type"]')) {
      const fam = familleSaisie;
      fenetreNom(`Nouveau type : ${famille(fam).nom}`, (nom) => etape2(S.ajouterType(fam, nom), contexte));
    }
  });
  // L'onglet choisi reste à l'écran.
  fen.querySelector('.onglets .choisi')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}

function etape2(t, contexte = {}) {
  const s = SAISIE[t.famille];
  const coul = famille(t.famille).couleur;
  const base = { type: t.id, chaine: contexte.chaine || null };
  // Enchaîner à une note d'un jour passé : la nouvelle note se place juste après la dernière de l'enchaînement,
  // et sa fiche s'ouvre pour ajuster l'heure.
  const tete = contexte.chaine ? S.note(contexte.chaine) : null;
  if (tete && jourDe(tete.debut, DEBUT_JOURNEE) < auj()) {
    const derniere = [tete, ...S.suitesDe(tete.id)].pop();
    let debut = ajouterMinutes(derniere.fin || derniere.debut, 10);
    if (jourDe(debut, DEBUT_JOURNEE) !== jourDe(tete.debut, DEBUT_JOURNEE)) debut = `${tete.debut.slice(0, 10)}T23:59`;
    Object.assign(base, { debut, precision: 'vers', retro: true });
  }
  if (t.endormissement) return etapeEndormissement(t, base);
  if (s.plage) {
    const choix = [[0, 'Là, maintenant'], ['go', 'Je commence'], [15, 'Depuis 15 min'], [30, 'Depuis 30 min'], [45, 'Depuis 45 min'], [60, 'Depuis 1 h'], [90, 'Depuis 1 h 30'], [120, 'Depuis 2 h']];
    ouvrirFenetre(`<div class="saisie" style="--c:${coul}">
      <h2><i class="pastille-mini"></i>${esc(t.nom)} <small>quand ?</small></h2>
      <div class="saisie-corps"><div class="grille-types">${choix.map(([v, nom]) => `<button class="btn-type ${v === 'go' ? 'fort' : ''}" data-q="${v}">${nom}</button>`).join('')}</div>
      <button class="lien" data-q="autre">Autre heure, ou une durée précise…</button></div>
    </div>`, null, 'fixe');
    couche.querySelector('.fenetre').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-q]');
      if (!b) return;
      const q = b.dataset.q;
      const maint = horodatage();
      if (q === 'autre') { const n = S.ajouterNote({ ...base, debut: ajouterMinutes(maint, -30), fin: maint }); if (jourAffiche === auj()) vueJour(); return fenetreNote(n, true); }
      if (q === 'go') return enregistre({ ...base, enCours: true }, `${t.nom} : c'est parti`);
      const m = Number(q);
      if (base.retro) return enregistre({ ...base, fin: m ? ajouterMinutes(base.debut, m) : null }, t.nom);
      return enregistre(m ? { ...base, debut: ajouterMinutes(maint, -m), fin: maint } : base, m ? `${t.nom} : ${texteDuree(m)}` : `${t.nom} noté`);
    });
    return;
  }
  if (s.intensite && t.echelle) {
    const { min, max, bas, haut } = t.echelle;
    const vals = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    ouvrirFenetre(`<div class="saisie" style="--c:${coul}">
      <h2><i class="pastille-mini"></i>${esc(t.nom)} <small>intensité</small></h2>
      <div class="saisie-corps">
        <div class="grille-intensite" style="grid-template-columns: repeat(${vals.length}, 1fr)">${vals.map((v) => `<button data-v="${v}" style="--k:${(v - min) / ((max - min) || 1)}">${v}</button>`).join('')}</div>
        <div class="echelle-legende"><span>${esc(bas || '')}</span><span>${esc(haut || '')}</span></div>
        <button class="lien" data-v="">Noter sans intensité</button>
      </div>
    </div>`, null, 'fixe');
    couche.querySelector('.fenetre').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-v]');
      if (!b) return;
      const v = b.dataset.v === '' ? null : Number(b.dataset.v);
      enregistre({ ...base, intensite: v }, `${t.nom}${v != null ? ` ${v}` : ''} noté à ${heureMaintenant()}`);
    });
    return;
  }
  enregistre(base, `${t.nom} noté à ${heureMaintenant()}`);
}

/**
 * Endormissement, d'après le journal de sommeil de consensus : l'heure où l'on essaie de dormir,
 * puis le temps estimé pour s'endormir. La zone en dégradé va de l'une à l'autre (30 min au moins).
 */
function etapeEndormissement(t, base) {
  const maint = horodatage();
  const hh = new Date().getHours();
  const defaut = hh >= 20 || hh < 4 ? heureDe(maint) : '23:00';
  const dateDefaut = hh < 12 && defaut === '23:00' ? ajouterJours(aujourdhui(), -1) : aujourdhui();
  ouvrirFenetre(`<form class="saisie" style="--c:${famille('sommeil').couleur}">
    <h2><i class="pastille-mini"></i>${esc(t.nom)}</h2>
    <div class="saisie-corps">
      <div class="deux">
        <label class="champ"><span>J'ai essayé de dormir vers</span><input type="time" name="heure" value="${defaut}"></label>
        <label class="champ"><span>Le</span><input type="date" name="date" value="${dateDefaut}" max="${aujourdhui()}"></label>
      </div>
      <p class="titre-choix">Pour m'endormir, il m'a fallu environ</p>
      <div class="choix" data-un="latence">${LATENCES.map((l, i) => `<button type="button" class="puce ${i === 1 ? 'choisi' : ''}" data-v="${l.min}">${l.nom}</button>`).join('')}</div>
      <input type="hidden" name="latence" value="${LATENCES[1].min}">
      <p class="titre-choix">Comment j'étais<em>facultatif</em></p>
      <div class="grille-intensite petite" data-zone="intensite" style="grid-template-columns: repeat(11, 1fr)">${Array.from({ length: 11 }, (_, v) => `<button type="button" data-v="${v}" style="--k:${v / 10}">${v}</button>`).join('')}</div>
      <div class="echelle-legende"><span>${esc(t.echelle.bas)}</span><span>${esc(t.echelle.haut)}</span></div>
      <input type="hidden" name="intensite" value="">
      <p class="aide">Une estimation suffit : le moment où l'on croit s'endormir est flou pour tout le monde.</p>
      <button class="btn btn-principal btn-large">Noter</button>
    </div>
  </form>`, (fd) => {
    const debut = `${fd.get('date')}T${fd.get('heure') || defaut}`;
    if (debut > maint) return toast("Cette heure n'est pas encore arrivée");
    const latence = Number(fd.get('latence')) || 25;
    const v = fd.get('intensite');
    enregistre({ ...base, debut, fin: ajouterMinutes(debut, Math.max(ZONE_MIN, latence)), latence, precision: 'vers', intensite: v === '' ? null : Number(v) }, `Endormissement noté vers ${sansZero(heureDe(debut))}`, jourDe(debut, DEBUT_JOURNEE));
  }, 'fixe');
  brancherChoix(couche.querySelector('form'));
}

function enregistre(champs, message, jour = auj()) {
  const retro = champs.retro;
  delete champs.retro;
  if (retro && champs.fin && champs.debut > champs.fin) champs.fin = ajouterMinutes(champs.debut, 30);
  const n = S.ajouterNote(champs);
  if (retro) {
    if (jourAffiche === jourDe(n.debut, DEBUT_JOURNEE)) vueJour();
    fenetreNote(n);
    return toast("Placée après l'enchaînement : ajuste l'heure si besoin");
  }
  fermer();
  // On attend que le retour d'historique de la fenêtre soit passé avant de changer de jour.
  setTimeout(() => { if (jourAffiche !== jour) aller(lienJour(jour)); else route(); complement(n, message); }, 60);
}

/** Panneau de complément : apparaît après chaque note, ne bloque rien, disparaît seul. */
let minuteurPanneau;
function complement(n, message) {
  const t = S.type(n.type);
  const s = SAISIE[t.famille];
  const puces = (liste, champ) => `<div class="choix">${liste.map((x) => `<button class="puce ${n[champ] === x.id ? 'choisi' : ''}" data-champ="${champ}" data-val="${esc(x.id)}">${esc(x.nom)}</button>`).join('')}</div>`;
  let rapide = '';
  if (s.issue) rapide = puces(ISSUES, 'issue');
  else if (s.aide) rapide = puces(AIDE, 'aide');
  else if (t.motifs) rapide = puces(t.motifs.map((m) => ({ id: m, nom: m })), 'motif');
  else if (t.famille === 'activite') rapide = `<div class="choix">${CERCLES.map((c) => `<button class="puce ${n.avecQui.includes(c.id) ? 'choisi' : ''}" data-cercle="${c.id}">${c.nom}</button>`).join('')}</div>`;
  else if (['declencheur', 'etat', 'corps'].includes(t.famille)) {
    rapide = `<div class="choix">${etiquettesParUsage().slice(0, 6).map((e) => `<button class="puce etq ${n.etiquettes.includes(e.id) ? 'choisi' : ''}" data-etq="${e.id}">${esc(e.nom)}</button>`).join('')}</div>`;
  }
  panneau.innerHTML = `<div class="panneau-tete" style="--c:${famille(t.famille).couleur}"><span><i class="pastille-mini"></i>${esc(message)}</span>
      <button class="btn-icone petit" data-p="fermer" aria-label="Fermer">${I.croix}</button></div>
    ${rapide}
    <div class="panneau-actions"><button class="lien" data-p="details">Détails : heure, avec qui, phrase…</button><button class="lien discret" data-p="annuler">Annuler la note</button></div>`;
  panneau.hidden = false;
  const relancer = () => { clearTimeout(minuteurPanneau); minuteurPanneau = setTimeout(() => { panneau.hidden = true; }, 10000); };
  relancer();
  panneau.onclick = (ev) => {
    relancer();
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.p === 'fermer') { panneau.hidden = true; return; }
    if (b.dataset.p === 'details') { panneau.hidden = true; return fenetreNote(n); }
    if (b.dataset.p === 'annuler') { S.supprimerNote(n.id); panneau.hidden = true; route(); return toast('Note annulée'); }
    if (b.dataset.champ) {
      const v = b.dataset.val;
      S.modifierNote(n, { [b.dataset.champ]: n[b.dataset.champ] === v ? null : v });
    } else if (b.dataset.cercle) {
      const c = b.dataset.cercle;
      S.modifierNote(n, { avecQui: n.avecQui.includes(c) ? n.avecQui.filter((x) => x !== c) : [...n.avecQui, c] });
    } else if (b.dataset.etq) {
      const e = b.dataset.etq;
      S.modifierNote(n, { etiquettes: n.etiquettes.includes(e) ? n.etiquettes.filter((x) => x !== e) : [...n.etiquettes, e] });
    } else return;
    route();
    complement(n, message);
  };
}

/** Branche les choix à un toucher (data-un / data-zone) et multiples (data-multi) d'un formulaire. */
function brancherChoix(f) {
  f.querySelectorAll('[data-zone], [data-un]').forEach((z) => z.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-v]');
    if (!b) return;
    const deja = b.classList.contains('choisi');
    z.querySelectorAll('[data-v]').forEach((x) => x.classList.remove('choisi'));
    const garder = z.dataset.un === 'latence'; // un choix obligatoire ne se décoche pas
    if (!deja || garder) b.classList.add('choisi');
    f[z.dataset.zone || z.dataset.un].value = deja && !garder ? '' : b.dataset.v;
  }));
  f.querySelectorAll('[data-multi]').forEach((z) => z.addEventListener('click', (ev) => {
    const b = ev.target.closest('.puce:not(.ajout)');
    if (b) b.classList.toggle('choisi');
  }));
}

// --- Fiche d'une note -------------------------------------------------------------------------

function fenetreNote(n, nouvelle = false) {
  const t = S.type(n.type);
  const fam = t?.famille || 'etat';
  const s = SAISIE[fam];
  const coul = famille(fam).couleur;
  const precision = n.precision || 'exacte';
  const options = FAMILLES.map((f) => `<optgroup label="${f.nom}">${S.get().types.filter((x) => x.famille === f.id && (x.visible || x.id === n.type)).map((x) => `<option value="${x.id}" ${x.id === n.type ? 'selected' : ''}>${esc(x.nom)}</option>`).join('')}</optgroup>`).join('');
  const zone010 = (champ, titre, val, bas = '', haut = '') => `<p class="titre-choix">${titre}<em>facultatif</em></p>
    <div class="grille-intensite petite" data-zone="${champ}" style="grid-template-columns: repeat(11, 1fr)">${Array.from({ length: 11 }, (_, v) => `<button type="button" class="${val === v ? 'choisi' : ''}" data-v="${v}" style="--k:${v / 10}">${v}</button>`).join('')}</div>
    ${bas || haut ? `<div class="echelle-legende"><span>${esc(bas)}</span><span>${esc(haut)}</span></div>` : ''}
    <input type="hidden" name="${champ}" value="${val ?? ''}">`;
  const unChoix = (champ, liste, val, titre) => `<p class="titre-choix">${titre}<em>facultatif</em></p><div class="choix" data-un="${champ}">${liste.map((x) => `<button type="button" class="puce ${val === x.id ? 'choisi' : ''}" data-v="${esc(x.id)}">${esc(x.nom)}</button>`).join('')}</div><input type="hidden" name="${champ}" value="${esc(val ?? '')}">`;
  const plusieurs = (attr, liste, vals) => liste.map((x) => `<button type="button" class="puce ${attr === 'etq' ? 'etq' : ''} ${vals.includes(x.id) ? 'choisi' : ''}" data-${attr}="${x.id}">${esc(x.nom)}</button>`).join('');
  const tete = n.chaine ? S.note(n.chaine) : null;
  const suites = S.suitesDe(n.id);
  const avecFin = !!(n.fin || n.enCours);

  ouvrirFenetre(`<form style="--c:${coul}">
    <h2><i class="pastille-mini"></i>${esc(t?.nom || 'Note')} <small>${nouvelle ? 'nouvelle note' : 'fiche de la note'}</small></h2>
    ${tete ? `<p class="aide" data-chaine>Enchaînée à <b>${esc(nomType(tete.type))}</b> (${sansZero(heureDe(tete.debut))}). <button type="button" class="lien" data-f="detacher">Détacher</button></p>` : ''}
    ${suites.length ? `<p class="aide">Début d'un enchaînement de ${pluriel(suites.length + 1, 'note')}.</p>` : ''}
    <label class="champ"><span>Type</span><select name="type">${options}</select></label>

    <p class="titre-choix">Quand</p>
    <div class="segment" data-precision>${[['exacte', 'Heure exacte'], ['vers', 'Environ'], ['moment', 'Un moment']].map(([k, nom]) => `<button type="button" data-p="${k}" class="${precision === k ? 'choisi' : ''}">${nom}</button>`).join('')}</div>
    <input type="hidden" name="precision" value="${precision}">
    <div class="deux">
      <label class="champ"><span>Jour</span><input type="date" name="date" value="${n.debut.slice(0, 10)}" max="${aujourdhui()}"></label>
      <label class="champ" data-heure ${precision === 'moment' ? 'hidden' : ''}><span>${avecFin ? 'Début' : 'Heure'}</span><input type="time" name="heure" value="${heureDe(n.debut)}"></label>
    </div>
    <div class="choix" data-moments ${precision === 'moment' ? '' : 'hidden'}>${MOMENTS.map((m) => `<button type="button" class="puce ${precision === 'moment' && heureDe(n.debut) === m.heure ? 'choisi' : ''}" data-m="${m.heure}">${m.nom}</button>`).join('')}</div>
    <label class="interrupteur"><span>Sur une durée (plage)</span><input type="checkbox" name="plage" ${avecFin ? 'checked' : ''}><i></i></label>
    <div class="sous-bloc" data-fin ${avecFin ? '' : 'hidden'}>
      ${n.enCours ? `<p class="aide">En cours depuis ${heureDe(n.debut)}.</p><button type="button" class="btn" data-f="arreter">${I.stop} J'arrête maintenant</button>` : `
      <label class="champ"><span>Fin</span><input type="time" name="fin" value="${n.fin ? heureDe(n.fin) : heureDe(ajouterMinutes(n.debut, 30))}"></label>
      <div class="choix" data-duree><span class="aide">Durée :</span>${[15, 30, 45, 60, 90, 120].map((m) => `<button type="button" class="puce" data-d="${m}">${texteDuree(m)}</button>`).join('')}</div>
      <p class="aide">Une fin plus tôt que le début passe au lendemain (la nuit).</p>`}
    </div>

    ${t?.echelle ? zone010('intensite', 'Intensité', n.intensite, t.echelle.bas, t.echelle.haut) : ''}
    ${s.issue ? unChoix('issue', ISSUES, n.issue, 'Et alors ?') : ''}
    ${s.aide ? unChoix('aide', AIDE, n.aide, 'Ça a aidé ?') : ''}
    ${t?.motifs ? unChoix('motif', t.motifs.map((m) => ({ id: m, nom: m })), n.motif, 'Pourquoi ?') : ''}
    ${s.quantite ? `<label class="champ"><span>Quantité <em>facultatif</em></span><input name="quantite" value="${esc(n.quantite)}" placeholder="2 cigarettes, 3 verres, 1 h de jeu…" autocomplete="off"></label>` : ''}
    ${s.activite ? `
      <label class="champ"><span>Quelle activité ? <em>nom libre, réutilisable</em></span><input name="activite" value="${esc(n.activite)}" list="noms-activites" placeholder="PWA avec Claude, ménage, dîner…" autocomplete="off"></label>
      <datalist id="noms-activites">${S.nomsActivites().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>
      ${zone010('plaisir', 'Plaisir', n.plaisir, 'aucun', 'immense')}
      ${zone010('maitrise', 'Maîtrise, accomplissement', n.maitrise, 'aucun', 'très fort')}
      <p class="titre-choix">Facettes<em>facultatif</em></p><div class="choix" data-multi="facettes">${plusieurs('fac', FACETTES, n.facettes)}</div>` : ''}

    <p class="titre-choix">Avec qui<em>facultatif</em></p>
    <div class="choix" data-multi="avecQui">${plusieurs('cer', CERCLES, n.avecQui)}</div>
    <div class="choix" data-multi="personnes">${plusieurs('per', S.get().personnes, n.personnes)}<button type="button" class="puce ajout" data-f="personne">${I.plus} Prénom</button></div>

    <p class="titre-choix">Étiquettes<em>contexte, déclencheur</em></p>
    <div class="choix" data-multi="etiquettes">${plusieurs('etq', S.get().etiquettes.filter((e) => !e.archive || n.etiquettes.includes(e.id)), n.etiquettes)}<button type="button" class="puce ajout" data-f="etiquette">${I.plus} Nouvelle</button></div>

    <label class="champ"><span>Une phrase <em>facultatif</em></span><textarea name="phrase" rows="2" placeholder="Ce qui s'est passé, le contexte…">${esc(n.phrase)}</textarea></label>

    <button class="btn btn-principal btn-large">Enregistrer</button>
    <div class="actions-sec">
      <button type="button" class="lien" data-f="enchainer">${I.chaine} Enchaîner une note</button>
      <button type="button" class="lien danger" data-f="supprimer">Supprimer</button>
    </div>
  </form>`, (fd) => {
    const date = fd.get('date') || n.debut.slice(0, 10);
    const heure = fd.get('heure') || heureDe(n.debut);
    const debut = `${date}T${heure}`;
    let fin = null;
    const garderEnCours = n.enCours && !!fd.get('plage');
    if (fd.get('plage') && !n.enCours) {
      fin = `${date}T${fd.get('fin') || heure}`;
      if (fin < debut) fin = `${ajouterJours(date, 1)}T${fd.get('fin')}`;
    }
    if (debut > horodatage()) return toast("Cette heure n'est pas encore arrivée");
    const num = (k) => { const v = fd.get(k); return v === '' || v == null ? null : Number(v); };
    const lus = (cle) => [...couche.querySelectorAll(`[data-multi="${cle}"] .choisi`)].map((b) => b.dataset.fac || b.dataset.cer || b.dataset.per || b.dataset.etq);
    S.modifierNote(n, {
      type: fd.get('type'), debut, fin, enCours: garderEnCours, precision: fd.get('precision'),
      intensite: num('intensite'), plaisir: num('plaisir'), maitrise: num('maitrise'),
      issue: fd.get('issue') || null, aide: fd.get('aide') || null, motif: fd.get('motif') || null,
      quantite: String(fd.get('quantite') || '').trim(), activite: String(fd.get('activite') || '').trim(),
      facettes: lus('facettes'), avecQui: lus('avecQui'), personnes: lus('personnes'), etiquettes: lus('etiquettes'),
      phrase: String(fd.get('phrase') || '').trim(),
    });
    fermer();
    const j = jourDe(n.debut, DEBUT_JOURNEE);
    setTimeout(() => { if (j !== jourAffiche) aller(lienJour(j)); else route(); toast('Note enregistrée'); }, 60);
  });

  const f = couche.querySelector('form');
  brancherChoix(f);
  f.querySelector('[data-precision]').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-p]');
    if (!b) return;
    f.precision.value = b.dataset.p;
    f.querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('choisi', x === b));
    f.querySelector('[data-heure]').hidden = b.dataset.p === 'moment';
    f.querySelector('[data-moments]').hidden = b.dataset.p !== 'moment';
  });
  f.querySelector('[data-moments]').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-m]');
    if (!b) return;
    f.heure.value = b.dataset.m;
    f.querySelectorAll('[data-m]').forEach((x) => x.classList.toggle('choisi', x === b));
  });
  f.plage.addEventListener('change', () => { f.querySelector('[data-fin]').hidden = !f.plage.checked; });
  f.querySelector('[data-duree]')?.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-d]');
    if (b) f.fin.value = heureDe(ajouterMinutes(`${f.date.value}T${f.heure.value}`, Number(b.dataset.d)));
  });
  const ajoutEnLigne = (sel, creer, attr) => f.querySelector(sel).addEventListener('click', (ev) => {
    const btn = ev.currentTarget;
    const champ = document.createElement('input');
    champ.className = 'puce-saisie';
    champ.placeholder = 'Nom, puis Entrée';
    btn.replaceWith(champ);
    champ.focus();
    let fait = false;
    const valider = () => {
      if (fait) return;
      fait = true;
      const v = champ.value.trim();
      if (v) {
        const x = creer(v);
        const p = document.createElement('button');
        p.type = 'button';
        p.className = `puce ${attr === 'etq' ? 'etq' : ''} choisi`;
        p.dataset[attr] = x.id;
        p.textContent = x.nom;
        champ.before(p);
      }
      champ.replaceWith(btn);
    };
    champ.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });
    champ.addEventListener('blur', valider);
  });
  ajoutEnLigne('[data-f="personne"]', (v) => S.ajouterPersonne(majuscule(v)), 'per');
  ajoutEnLigne('[data-f="etiquette"]', (v) => S.ajouterEtiquette(v.toLowerCase()), 'etq');
  f.querySelector('[data-f="arreter"]')?.addEventListener('click', () => { S.arreter(n); fermer(); route(); toast(`Arrêté : ${texteDuree(dureeNote(n))}`); });
  f.querySelector('[data-f="detacher"]')?.addEventListener('click', () => { S.detacher(n); f.querySelector('[data-chaine]').remove(); route(); toast("Détachée de l'enchaînement"); });
  f.querySelector('[data-f="enchainer"]').addEventListener('click', () => vueNoter({ chaine: n.chaine || n.id }));
  f.querySelector('[data-f="supprimer"]').addEventListener('click', (ev) => {
    if (!confirmerDeux(ev.currentTarget)) return;
    const copie = { ...n };
    const suites = S.suitesDe(n.id).map((x) => x.id);
    S.supprimerNote(n.id);
    fermer(); route();
    toast('Note supprimée', { libelle: 'Annuler', action: () => {
      S.remettreNote(copie);
      for (const id of suites) { const x = S.note(id); if (x) x.chaine = copie.id; }
      S.enregistrer(); route();
    } });
  });
}

function fenetreDate() {
  ouvrirFenetre(`<form><h2>Aller à une date</h2>
    <label class="champ"><span>Date</span><input type="date" name="d" value="${jourAffiche}" max="${auj()}"></label>
    <button class="btn btn-principal btn-large">Voir ce jour</button></form>`, (fd) => {
    const d = fd.get('d');
    if (d) { fermer(); setTimeout(() => aller(lienJour(d > auj() ? auj() : d)), 60); }
  });
}

// --- Réglages ----------------------------------------------------------------------------------

function vueReglages() {
  const r = S.reglages();
  const copie = S.copieDisponible();
  const pauses = [...S.get().pauses].sort((a, b) => b.du.localeCompare(a.du));
  const enPause = S.enPause(auj());
  app.innerHTML = `
    ${bandeau({ titre: 'Réglages' })}
    <div class="carte">
      <h3>Types de notes <small>${S.get().types.filter((t) => t.visible).length} affichés</small></h3>
      <p class="aide">Afficher ou masquer chaque état, symptôme, envie, coping, activité… Renommer, ajouter les tiens.</p>
      <button class="btn btn-large" data-action="aller" data-h="#/reglages/types">Gérer les types ${I.droite}</button>
    </div>
    <div class="carte">
      <h3>Étiquettes et personnes</h3>
      <p class="aide">Ta bibliothèque d'étiquettes (contexte, déclencheurs) et les prénoms : renommer, archiver, fusionner.</p>
      <button class="btn btn-large" data-action="aller" data-h="#/reglages/etiquettes">Gérer ${I.droite}</button>
    </div>
    <div class="carte">
      <h3>Pause du suivi <small>${enPause ? 'en cours' : 'aucune en cours'}</small></h3>
      <p class="aide">Vacances, période difficile : les jours en pause ne comptent nulle part. Aucune justification demandée.</p>
      ${enPause ? '<button class="btn btn-large" data-action="fin-pause">Reprendre le suivi</button>' : '<button class="btn btn-large" data-action="pause">Commencer une pause aujourd\'hui</button>'}
      ${pauses.length ? `<ul class="liste-simple">${pauses.map((p) => `<li><span>Du ${dateNum(p.du)} ${p.au ? `au ${dateNum(p.au)}` : '(en cours)'}</span><button class="lien discret" data-action="suppr-pause" data-id="${p.id}">Supprimer</button></li>`).join('')}</ul>` : ''}
    </div>
    <div class="carte">
      <h3>Code de verrouillage <small>${r.code ? 'activé' : 'aucun'}</small></h3>
      <p class="aide">6 chiffres, demandés à l'ouverture et après 5 min en arrière-plan. Le même code chiffre le fichier d'export.</p>
      <button class="btn btn-large ${r.code ? '' : 'btn-principal'}" data-action="code">${I.cadenas} ${r.code ? 'Changer le code' : 'Créer un code'}</button>
      ${r.code ? '<div class="actions-sec"><button class="lien danger" data-action="supprimer-code">Supprimer le code</button></div>' : ''}
    </div>
    <div class="carte">
      <h3>Sauvegarde <small>${r.dernierExport ? `dernier export : ${ilYA(r.dernierExport)}` : 'jamais exporté'}</small></h3>
      <p class="aide">Un fichier contient tout. Il est chiffré avec ton code : il ne se relit que dans Logger, avec ce code.</p>
      <button class="btn btn-principal btn-large" data-action="exporter">${I.partage} Exporter toutes mes données</button>
      <label class="btn btn-large">Restaurer depuis un export<input type="file" accept=".txt,.json,text/plain,application/json" hidden data-f="import"></label>
      ${copie ? `<div class="actions-sec"><button class="lien" data-action="annuler-import">Annuler le dernier import (revenir à l'état du ${new Date(copie).toLocaleDateString('fr-FR')})</button></div>` : ''}
    </div>
    <div class="carte">
      <h3>Exemple pour tester</h3>
      <p class="aide">Trois semaines de notes inventées (soirées enchaînées, activités, endormissement). Retirables d'un geste.</p>
      ${S.aDesExemples() ? '<button class="btn btn-large" data-action="retirer-exemple">Retirer l\'exemple</button>' : '<button class="btn btn-large" data-action="charger-exemple">Charger l\'exemple</button>'}
    </div>
    <div class="carte">
      <h3>Aide</h3>
      <button class="btn btn-large" data-action="aller" data-h="#/guide">${I.guide} Tout ce que fait Logger</button>
      <p class="aide">Besoin de parler à quelqu'un tout de suite : <b>3114</b>, numéro national de prévention du suicide, gratuit, 24 h/24.</p>
    </div>
    <div class="zone-danger"><button class="lien danger" data-action="tout-effacer">Tout effacer sur cet appareil</button></div>
    <p class="pied">Logger v2.0.1 · les données restent sur cet appareil</p>`;
  app.querySelector('[data-f="import"]').addEventListener('change', (ev) => importer(ev.target.files[0]));
}

function vueTypes() {
  const us = S.usages('type');
  app.innerHTML = `
    ${bandeau({ retour: '#/reglages', petit: 'Réglages', titre: 'Types de notes' })}
    <p class="aide" style="margin:0 4px 10px">Un type masqué disparaît de la saisie, pas de l'historique. Les noms se modifient directement. Le chiffre = nombre de notes.</p>
    ${FAMILLES.map((f) => `<div class="carte" style="--c:${f.couleur}">
      <h3><span><i class="pastille-mini"></i>${f.nom}</span><small>${f.aide}</small></h3>
      ${S.get().types.filter((t) => t.famille === f.id).map((t) => `<div class="ligne-etq">
        <input data-renommer="${t.id}" value="${esc(t.nom)}" autocomplete="off" aria-label="Nom">
        <small class="usage">${us.get(t.id) || 0}</small>
        <label class="interrupteur mini" aria-label="Afficher dans la saisie"><input type="checkbox" data-visible="${t.id}" ${t.visible ? 'checked' : ''}><i></i></label>
      </div>`).join('')}
      <button class="lien" data-f="ajouter" data-fam="${f.id}" style="align-self:flex-start">${I.plus} Ajouter un type</button>
    </div>`).join('')}`;
  app.querySelectorAll('[data-renommer]').forEach((i) => i.addEventListener('change', () => { const v = majuscule(i.value); if (v) { S.type(i.dataset.renommer).nom = v; S.enregistrer(); toast('Renommé'); } }));
  app.querySelectorAll('[data-visible]').forEach((i) => i.addEventListener('change', () => { S.type(i.dataset.visible).visible = i.checked; S.enregistrer(); toast(i.checked ? 'Affiché dans la saisie' : 'Masqué de la saisie'); }));
  app.querySelectorAll('[data-f="ajouter"]').forEach((b) => b.addEventListener('click', () => fenetreNom(`Nouveau type : ${famille(b.dataset.fam).nom}`, (nom) => { S.ajouterType(b.dataset.fam, nom); fermer(); vueTypes(); toast('Type ajouté'); })));
}

function vueEtiquettes() {
  const us = S.usages('etiquettes');
  const up = S.usages('personnes');
  const etqs = [...S.get().etiquettes].sort((a, b) => a.archive - b.archive || (us.get(b.id) || 0) - (us.get(a.id) || 0));
  app.innerHTML = `
    ${bandeau({ retour: '#/reglages', petit: 'Réglages', titre: 'Étiquettes et personnes' })}
    <div class="carte">
      <h3>Étiquettes <small>triées par usage</small></h3>
      ${etqs.map((e) => `<div class="ligne-etq ${e.archive ? 'archivee' : ''}">
        <input data-etq="${e.id}" value="${esc(e.nom)}" autocomplete="off" aria-label="Nom">
        <small class="usage">${us.get(e.id) || 0}</small>
        <select data-fusion="${e.id}" aria-label="Fusionner dans"><option value="">Fusionner…</option>${etqs.filter((x) => x.id !== e.id).map((x) => `<option value="${x.id}">dans « ${esc(x.nom)} »</option>`).join('')}</select>
        <button class="btn-icone petit" data-archive="${e.id}" aria-label="${e.archive ? 'Ressortir' : 'Archiver'}">${e.archive ? I.plus : I.moins}</button>
      </div>`).join('')}
      <button class="lien" data-f="ajouter-etq" style="align-self:flex-start">${I.plus} Ajouter une étiquette</button>
      <p class="aide">− archive (l'étiquette quitte les choix mais reste sur les notes), + la ressort. Fusionner déplace toutes ses notes vers une autre étiquette.</p>
    </div>
    <div class="carte">
      <h3>Personnes <small>prénoms privés</small></h3>
      ${S.get().personnes.map((p) => `<div class="ligne-etq"><input data-per="${p.id}" value="${esc(p.nom)}" autocomplete="off" aria-label="Prénom"><small class="usage">${up.get(p.id) || 0}</small></div>`).join('') || '<p class="aide">Aucun prénom pour l\'instant : ajoute-les depuis une note (« Avec qui »).</p>'}
    </div>`;
  app.querySelectorAll('[data-etq]').forEach((i) => i.addEventListener('change', () => { const v = i.value.trim().toLowerCase(); if (v) { S.etiquette(i.dataset.etq).nom = v; S.enregistrer(); toast('Renommée'); } }));
  app.querySelectorAll('[data-per]').forEach((i) => i.addEventListener('change', () => { const v = majuscule(i.value); if (v) { S.personne(i.dataset.per).nom = v; S.enregistrer(); toast('Renommé'); } }));
  app.querySelectorAll('[data-fusion]').forEach((s) => s.addEventListener('change', () => {
    if (!s.value) return;
    S.fusionnerEtiquettes(s.dataset.fusion, s.value); vueEtiquettes(); toast('Étiquettes fusionnées');
  }));
  app.querySelectorAll('[data-archive]').forEach((b) => b.addEventListener('click', () => { const e = S.etiquette(b.dataset.archive); e.archive = !e.archive; S.enregistrer(); vueEtiquettes(); toast(e.archive ? 'Archivée' : 'Ressortie'); }));
  app.querySelector('[data-f="ajouter-etq"]').addEventListener('click', () => fenetreNom('Nouvelle étiquette', (nom) => { S.ajouterEtiquette(nom.toLowerCase()); fermer(); vueEtiquettes(); }));
}

// --- Tout ce que fait Logger -------------------------------------------------------------------

function vueGuide() {
  const sections = [
    ['Noter', [
      ['Noter en deux touchers', 'Le bouton + en bas → un type → l\'intensité. C\'est enregistré à l\'heure actuelle.'],
      ['Après chaque note', 'Un panneau en bas propose les compléments utiles (cédé / traversée, a aidé ?, avec qui, étiquettes…), puis disparaît seul.'],
      ['Enchaîner', 'Sous chaque carte, « Enchaîner une note » ajoute une note liée (stress → fatigue…). C\'est toi qui décides de ce qui va ensemble ; le + du bas crée une note séparée.'],
      ['Plages', 'Coping, activités, sommeil : « Je commence » puis « J\'arrête », ou « Depuis 30 min ». Toute note peut devenir une plage dans sa fiche.'],
      ['Endormissement', 'L\'heure où tu as essayé de dormir et le temps qu\'il t\'a fallu (estimation) : la zone en dégradé va de l\'un à l\'autre, 30 min au moins.'],
      ['Heure approximative', 'Dans la fiche : heure exacte, environ, ou un moment (la nuit, le matin…). Pas besoin de regarder l\'horloge.'],
      ['Fiche d\'une note', 'Toucher une carte ou une ligne : type, heure, durée, intensité, avec qui, étiquettes, phrase. Tout est facultatif. La croix, le fond ou le retour du téléphone ferment sans enregistrer.'],
      ['Activités', 'Un nom libre réutilisable, plaisir et maîtrise de 0 à 10, facettes (choisie, écran, créatif…).'],
    ]],
    ['Lire sa journée', [
      ['Pastilles des jours', 'Faire glisser pour remonter le temps. Pastille pleine : aujourd\'hui ; cerclée : le jour affiché ; un point dessous : des notes ce jour-là. Toucher la date ouvre un calendrier.'],
      ['Les 24 points', 'Un point par heure, de 0 h à 24 h : gris = rien, puis de plus en plus coloré selon le nombre de notes.'],
      ['Planning', 'Toucher les points le déploie : le temps descend, un trait relie les notes d\'un même enchaînement. « Voir les 24 h » et la hauteur s\'y règlent.'],
      ['Cartes', 'Les notes du jour dans l\'ordre, chaque carte avec son enchaînement.'],
      ['Journée', 'De 0 h à 24 h. Une plage qui passe minuit (endormissement) s\'affiche sur les deux jours.'],
    ]],
    ['Jours et pauses', [
      ['Jour renseigné', 'Un jour avec une note, ou marqué « rien à signaler ». Un jour vide ne compte nulle part : pas de jour raté.'],
      ['Pause du suivi', 'Réglages → Pause : les jours en pause ne comptent nulle part.'],
    ]],
    ['Bibliothèques', [
      ['Types', 'Réglages → Types : afficher, masquer, renommer, ajouter. « Autre » dans la saisie en crée un aussi.'],
      ['Étiquettes et personnes', 'Ajout direct depuis une note ; Réglages pour renommer, archiver, fusionner.'],
    ]],
    ['Sécurité et sauvegarde', [
      ['Code à 6 chiffres', 'Verrouille l\'appli et chiffre le fichier d\'export.'],
      ['Export et restauration', 'Un fichier .txt chiffré. Restaurer : tout remplacer ou fusionner, avec une copie de secours annulable.'],
      ['Exemple', 'Des données inventées pour tester, retirables.'],
    ]],
    ['Bientôt', [
      ['v2.1', 'Débrief du matin (nuit), bilan du soir, questionnaires (WHO-5, PHQ-9, GAD-7, AUDIT-C, MDS-16).'],
      ['v2.2', 'Vues semaine, mois, année ; import Sport ; compteurs « depuis combien de temps ».'],
      ['v2.3', 'Faits mis en regard ; résumé PDF à parties choisies.'],
    ]],
  ];
  app.innerHTML = `
    ${bandeau({ retour: '#/', titre: 'Tout ce que fait Logger' })}
    ${sections.map(([titre, items]) => `<div class="titre-section">${titre}</div><dl class="guide">${items.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join('')}</dl>`).join('')}
    <p class="aide centre">Besoin de parler à quelqu'un tout de suite : <b>3114</b>, gratuit, 24 h/24.</p>`;
}

// --- Export et import ---------------------------------------------------------------------------

async function exporter() {
  const r = S.reglages();
  if (!r.code) {
    ouvrirFenetre(`<div class="pile"><h2>Export</h2>
      <p class="aide">Sans code, le fichier n'est pas chiffré : n'importe qui pourra le lire. Crée d'abord un code pour le protéger.</p>
      <button class="btn btn-principal btn-large" data-f="code">${I.cadenas} Créer un code</button>
      <div class="actions-sec"><button class="lien" data-f="clair">Exporter sans chiffrement</button></div></div>`);
    couche.querySelector('[data-f="code"]').addEventListener('click', () => fenetreCode());
    couche.querySelector('[data-f="clair"]').addEventListener('click', async () => { fermer(); await partager(C.enClair(S.donneesExport())); });
    return;
  }
  ouvrirFenetre('<div class="pile"><h2>Chiffrer l\'export</h2><p class="aide centre" data-aide>Tape ton code : il chiffre le fichier.</p><div data-pave></div></div>');
  const aide = couche.querySelector('[data-aide]');
  V.pave(couche.querySelector('[data-pave]'), async (code, recommencer) => {
    if (await V.empreinte(code, r.code.sel) !== r.code.empreinte) { aide.textContent = 'Ce n\'est pas ton code.'; return recommencer(true); }
    aide.textContent = 'Chiffrement…';
    const texte = await C.chiffrer(S.donneesExport(), code);
    fermer();
    await partager(texte);
  }, r.code.longueur || V.LONGUEUR);
}

async function partager(texte) {
  const nom = `${aujourdhui().replaceAll('-', '')} - Logger - Export.txt`;
  const fichier = new File([texte], nom, { type: 'text/plain' });
  let ok = false;
  try {
    if (navigator.canShare?.({ files: [fichier] })) { await navigator.share({ files: [fichier], title: nom }); ok = true; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  if (!ok) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(fichier);
    a.download = nom;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  S.noterExport(aujourdhui());
  route();
  toast(ok ? 'Export partagé' : 'Export téléchargé');
}

async function importer(fichier) {
  if (!fichier) return;
  let entete;
  try { entete = C.lireEnTete(await fichier.text()); } catch (e) { return toast(e.message); }
  if (!entete.chiffre) return choisirModeImport(fichier.name, entete, entete.donnees);
  ouvrirFenetre('<div class="pile"><h2>Fichier chiffré</h2><p class="aide centre" data-aide>Tape le code utilisé lors de cet export.</p><div data-pave></div></div>');
  const aide = couche.querySelector('[data-aide]');
  V.pave(couche.querySelector('[data-pave]'), async (code, recommencer) => {
    aide.textContent = 'Déchiffrement…';
    let d;
    try { d = await C.dechiffrer(entete, code); } catch { aide.textContent = 'Ce code ne correspond pas à ce fichier.'; return recommencer(true); }
    choisirModeImport(fichier.name, entete, d);
  });
}

function choisirModeImport(nom, entete, d) {
  ouvrirFenetre(`<div class="pile">
    <h2>Restaurer</h2>
    <p class="aide">${esc(nom)}<br>${pluriel(d.notes?.length || 0, 'note')} · exporté le ${new Date(entete.le).toLocaleDateString('fr-FR')}</p>
    <button class="btn btn-principal btn-large" data-m="remplacer">Tout remplacer</button>
    <button class="btn btn-large" data-m="fusionner">Fusionner (ajouter ce qui manque)</button>
    <p class="aide">Une copie de tes données actuelles est faite avant : tu pourras annuler.</p>
  </div>`);
  couche.querySelector('.fenetre').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-m]');
    if (!b) return;
    try { S.importer(d, b.dataset.m); } catch (e) { return toast(e.message); }
    fermer(); setTimeout(() => aller('#/'), 60);
    toast(b.dataset.m === 'remplacer' ? 'Données restaurées' : 'Données fusionnées', { libelle: 'Annuler', action: annulerImport });
  });
}

function annulerImport() {
  if (!S.copieDisponible()) return toast('Aucune copie à restaurer');
  S.restaurerCopie(); route(); toast('Import annulé');
}

// --- Code ----------------------------------------------------------------------------------------

function fenetreCode() {
  let premier = null;
  ouvrirFenetre(`<div class="pile"><h2 data-titre>Nouveau code</h2><p class="aide centre" data-aide>Choisis ${V.LONGUEUR} chiffres.</p><div data-pave></div></div>`);
  const titre = couche.querySelector('[data-titre]'), aide = couche.querySelector('[data-aide]');
  V.pave(couche.querySelector('[data-pave]'), async (code, recommencer) => {
    if (!premier) {
      if (V.tropSimple(code)) { aide.textContent = 'Trop simple : choisis-en un autre.'; return recommencer(true); }
      premier = code; titre.textContent = 'Confirme le code'; aide.textContent = 'Tape-le une seconde fois.';
      return recommencer();
    }
    if (code !== premier) { premier = null; titre.textContent = 'Nouveau code'; aide.textContent = 'Les deux codes diffèrent. Recommence.'; return recommencer(true); }
    const sel = Math.random().toString(36).slice(2, 10);
    S.reglages().code = { sel, empreinte: await V.empreinte(code, sel), longueur: V.LONGUEUR };
    S.enregistrer(); fermer(); route();
    toast("Code enregistré. Un export fait avant garde l'ancien code.");
  });
}

let enArrierePlan = null;

function verrouiller() {
  const code = S.reglages().code;
  if (!code) return false;
  fermer(false);
  panneau.hidden = true;
  barre.hidden = true;
  app.innerHTML = '';
  verrouEl.innerHTML = '<img src="icons/icon-192.png" alt=""><h2>Logger</h2><div data-pave></div><button class="lien" data-f="oubli">Code oublié ?</button>';
  verrouEl.hidden = false;
  V.pave(verrouEl.querySelector('[data-pave]'), async (saisi, recommencer) => {
    if (await V.empreinte(saisi, code.sel) !== code.empreinte) return recommencer(true);
    verrouEl.hidden = true;
    verrouEl.innerHTML = '';
    route();
  }, code.longueur || V.LONGUEUR);
  verrouEl.querySelector('[data-f="oubli"]').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.arme) {
      b.dataset.arme = '1';
      b.textContent = "Sans le code, seule issue : tout effacer sur cet appareil. Un export chiffré ne se relit qu'avec son code. Toucher encore pour tout effacer.";
      return;
    }
    if (!confirmerDeux(b)) return;
    S.effacerAvecCode(); verrouEl.hidden = true; verrouEl.innerHTML = ''; route(); toast('Données effacées');
  });
  return true;
}

// --- Fenêtres et messages ---------------------------------------------------------------------
// Une fenêtre ouverte ajoute une étape à l'historique : le bouton retour du téléphone la ferme
// au lieu de quitter l'écran.

let etapeHistorique = false;

function ouvrirFenetre(html, onSubmit, classe = '') {
  panneau.hidden = true;
  couche.innerHTML = `<div class="fenetre ${classe}" role="dialog" aria-modal="true">
    <div class="fenetre-haut"><div class="poignee-fenetre"></div><button class="fermer-fenetre" data-fermer aria-label="Fermer">${I.croix}</button></div>${html}</div>`;
  couche.hidden = false;
  document.body.classList.add('fige');
  if (!etapeHistorique) { history.pushState({ fenetre: true }, ''); etapeHistorique = true; }
  couche.onclick = (ev) => { if (ev.target === couche || ev.target.closest('[data-fermer]')) fermer(); };
  const f = couche.querySelector('form');
  if (f && onSubmit) f.onsubmit = (ev) => { ev.preventDefault(); onSubmit(new FormData(f), f); };
}

/** historique = false quand la fermeture accompagne une navigation (on ne recule pas). */
function fermer(historique = true) {
  const ouverte = !couche.hidden;
  couche.hidden = true;
  couche.innerHTML = '';
  document.body.classList.remove('fige');
  if (etapeHistorique) {
    etapeHistorique = false;
    if (historique && ouverte) history.back();
  }
}

window.addEventListener('popstate', () => {
  if (etapeHistorique) {
    etapeHistorique = false;
    couche.hidden = true;
    couche.innerHTML = '';
    document.body.classList.remove('fige');
  }
});

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

function fenetreNom(titre, onOk) {
  ouvrirFenetre(`<form><h2>${esc(titre)}</h2>
    <label class="champ"><span>Nom</span><input name="nom" autocomplete="off" required></label>
    <button class="btn btn-principal btn-large">Continuer</button></form>`, (fd) => {
    const n = majuscule(fd.get('nom'));
    if (n) onOk(n);
  });
  setTimeout(() => couche.querySelector('input')?.focus(), 60);
}

// --- Actions --------------------------------------------------------------------------------------

barre.addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-barre]');
  if (!b) return;
  if (b.dataset.barre === 'noter') return vueNoter();
  aller(b.dataset.barre);
});

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const d = el.dataset;
  switch (d.action) {
    case 'aller': return aller(d.h);
    case 'date': return fenetreDate();
    case 'note': return fenetreNote(S.note(d.id));
    case 'enchainer': return vueNoter({ chaine: d.id });
    case 'planning': { const r = S.reglages(); r.planningOuvert = !r.planningOuvert; S.enregistrer(); return vueJour(); }
    case 'arreter': { const n = S.note(d.id); S.arreter(n); route(); return toast(`${nomType(n.type)} : ${texteDuree(dureeNote(n))}`); }
    case 'calme': S.basculerCalme(jourAffiche); route(); return toast(S.statutJour(jourAffiche) === 'calme' ? 'Marqué « rien à signaler »' : 'Marquage retiré');
    case 'pause': S.commencerPause(auj()); route(); return toast('Pause du suivi commencée');
    case 'fin-pause': { const p = S.enPause(auj()) || S.enPause(jourAffiche); if (p) S.finirPause(p, ajouterJours(auj(), -1)); route(); return toast('Suivi repris'); }
    case 'suppr-pause': if (confirmerDeux(el)) { S.supprimerPause(d.id); route(); toast('Pause supprimée'); } return;
    case 'resserrer': resserre = !resserre; return vueJour();
    case 'zoom': {
      const r = S.reglages();
      const pas = [32, 48, 72, 104];
      const i = Math.max(0, Math.min(pas.length - 1, Math.max(0, pas.indexOf(r.echelleHeure)) + Number(d.pas)));
      r.echelleHeure = pas[i]; S.enregistrer(); return vueJour();
    }
    case 'exporter': return exporter();
    case 'annuler-import': return annulerImport();
    case 'code': return fenetreCode();
    case 'supprimer-code': if (confirmerDeux(el)) { delete S.reglages().code; S.enregistrer(); route(); toast('Code supprimé'); } return;
    case 'charger-exemple': S.chargerExemple(exemple(auj())); toast('Exemple chargé'); return aller('#/');
    case 'retirer-exemple': if (confirmerDeux(el)) { S.retirerExemples(); route(); toast('Exemple retiré'); } return;
    case 'tout-effacer': if (confirmerDeux(el)) { S.toutEffacer(); toast('Tout est effacé'); aller('#/'); } return;
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { enArrierePlan = Date.now(); return; }
  if (enArrierePlan && Date.now() - enArrierePlan > V.DELAI && verrouEl.hidden) verrouiller();
  enArrierePlan = null;
  if (verrouEl.hidden && couche.hidden && (location.hash === '#/' || !location.hash)) route();
});
window.addEventListener('hashchange', route);
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !couche.hidden) fermer(); });

activerBulles();
suivreZoneVisible();
if (!verrouiller()) route();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
