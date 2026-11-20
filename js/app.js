// Logger v2 : un journal unique de santé mentale.
// Écran principal : la journée, en frise verticale (le temps descend, un calque par type).
import * as S from './store.js';
import * as V from './verrou.js';
import * as C from './crypto.js';
import { regroupements, voisines } from './episodes.js';
import { exemple } from './demo.js';
import { activerBulles } from './graph.js';
import { FAMILLES, famille, SAISIE, CERCLES, FACETTES, MOMENTS, AIDE, ISSUES, DEBUT_JOURNEE } from './catalogue.js';
import {
  aujourdhui, heureMaintenant, ajouterJours, dateCourte, dateNum, dateLongue,
  horodatage, minutes, ajouterMinutes, jourDe, heureDe, texteDuree, pluriel, ilYA, majuscule,
} from './calc.js';

const app = document.getElementById('app');
const couche = document.getElementById('couche');
const toastEl = document.getElementById('toast');
const verrouEl = document.getElementById('verrou');
const panneau = document.getElementById('panneau');

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const I = {
  retour: '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  droite: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  croix: '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>',
  encore: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><path d="M4 4v4h4"/></svg>',
  calques: '<svg viewBox="0 0 24 24"><path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/></svg>',
  reglages: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
  partage: '<svg viewBox="0 0 24 24"><path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/></svg>',
  cadenas: '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="2"/></svg>',
  moins: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>',
  guide: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.5a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4M12 16.8v.2"/></svg>',
};

const TETE_FRISE = 88; // hauteur des en-têtes de colonnes (px), aussi dans le CSS
const auj = () => jourDe(horodatage(), DEBUT_JOURNEE);
const maintenantMin = () => Math.round(Date.now() / 60000);
const horodatageDe = (m) => horodatage(new Date(m * 60000));
let jourAffiche = null;
let resserre = true;
let familleSaisie = 'etat';
let defilerVersMaintenant = true;

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
  fermer();
  const h = location.hash || '#/';
  const m = h.match(/^#\/j\/(\d{4}-\d{2}-\d{2})$/);
  if (m) { jourAffiche = m[1] > auj() ? auj() : m[1]; return vueJour(); }
  if (h === '#/reglages') return vueReglages();
  if (h === '#/reglages/types') return vueTypes();
  if (h === '#/reglages/etiquettes') return vueEtiquettes();
  if (h === '#/guide') return vueGuide();
  jourAffiche = auj();
  return vueJour();
}

function aller(h) {
  if (location.hash === h || (h === '#/' && !location.hash)) route(); else location.hash = h;
}

const lienJour = (d) => (d === auj() ? '#/' : `#/j/${d}`);

function actions(liste) {
  return `<nav class="actions-tete" style="grid-template-columns: repeat(${liste.length}, minmax(0, 1fr))">${liste.map(([action, icone, libelle, extra = '', attrs = '']) =>
    `<button class="action-tete ${extra}" data-action="${action}" ${attrs}>${I[icone]}<span>${libelle}</span></button>`).join('')}</nav>`;
}

function bandeau({ retour, petit, titre, liste, gauche = '', droite = '' }) {
  return `<header class="bandeau-tete">
    <div class="bandeau-ligne">
      ${retour ? `<button class="btn-icone sur-couleur" data-action="aller" data-h="${retour}" aria-label="Retour">${I.retour}</button>` : gauche}
      <div class="bandeau-titre">${petit ? `<small>${petit}</small>` : ''}<h1>${titre}</h1></div>
      ${droite}
    </div>
    ${liste ? actions(liste) : ''}
  </header>`;
}

// --- Petits textes -----------------------------------------------------------------------

const couleurDe = (n) => famille(S.type(n.type)?.famille)?.couleur || '#8f9db0';
const nomType = (id) => S.type(id)?.nom || 'Type supprimé';
const sansZero = (h) => h.replace(/^0(\d)/, '$1');

function quand(n) {
  if (n.precision === 'moment') return MOMENTS.find((m) => m.heure === heureDe(n.debut))?.nom || heureDe(n.debut);
  const h = sansZero(heureDe(n.debut));
  const base = n.precision === 'vers' ? `vers ${h}` : h;
  if (n.enCours) return `${base} → en cours`;
  if (n.fin) return `${base} → ${sansZero(heureDe(n.fin))}`;
  return base;
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

function ligneNote(n) {
  const tags = n.etiquettes.map((id) => S.etiquette(id)?.nom).filter(Boolean);
  const d = details(n);
  return `<li><button class="ligne-note" data-action="note" data-id="${n.id}" style="--c:${couleurDe(n)}">
    <span class="ln-quand">${esc(quand(n))}</span>
    <span class="ln-texte">
      <b><i class="pastille-mini"></i>${esc(nomType(n.type))}</b>
      ${d.length ? `<small>${esc(d.join(' · '))}</small>` : ''}
      ${tags.length ? `<span class="ls-tags">${tags.map((t) => `<span class="etiquette">${esc(t)}</span>`).join('')}</span>` : ''}
      ${n.phrase ? `<em>${esc(n.phrase)}</em>` : ''}
    </span>
    ${n.intensite != null ? `<span class="valeur">${n.intensite}</span>` : ''}
  </button></li>`;
}

// --- Vue jour ----------------------------------------------------------------------------------

const HORS_EPISODE = new Set(['activite', 'sommeil']);
const tousGroupes = (now = maintenantMin()) => regroupements(S.notesTriees(), S.reglages().ecartEpisode, now, S.get().blocs, (n) => HORS_EPISODE.has(S.type(n.type)?.famille));

function groupesDuJour(d) {
  return tousGroupes()
    .filter((g) => g.notes.some((n) => jourDe(n.debut, DEBUT_JOURNEE) === d));
}

function vueJour() {
  const d = jourAffiche;
  const a = auj();
  const r = S.reglages();
  const toutes = S.notesDuJour(d);
  const visibles = toutes.filter((n) => r.calques.includes(S.type(n.type)?.famille));
  const statut = S.statutJour(d);
  const pause = S.enPause(d);
  const titre = d === a ? "Aujourd'hui" : d === ajouterJours(a, -1) ? 'Hier' : majuscule(dateCourte(d));
  const encours = S.enCours();
  const groupes = groupesDuJour(d);
  const derniere = S.derniere();
  const masquees = toutes.length - visibles.length;

  app.innerHTML = `
    ${bandeau({
      petit: majuscule(dateLongue(d)), titre,
      gauche: `<button class="btn-icone sur-couleur" data-action="aller" data-h="${lienJour(ajouterJours(d, -1))}" aria-label="Jour précédent">${I.retour}</button>`,
      droite: `<button class="btn-icone sur-couleur" data-action="aller" data-h="${lienJour(ajouterJours(d, 1))}" aria-label="Jour suivant" ${d >= a ? 'disabled' : ''}>${I.droite}</button>`,
      liste: [
        ['noter', 'plus', 'Noter', 'fort'],
        ['encore', 'encore', 'Encore', '', derniere ? `aria-label="Encore : ${esc(nomType(derniere.type))}"` : 'disabled'],
        ['calques', 'calques', 'Calques'],
        ['aller', 'reglages', 'Réglages', '', 'data-h="#/reglages"'],
      ],
    })}
    ${derniere ? `<p class="encore-aide">Encore = ${esc(nomType(derniere.type))}${derniere.intensite != null ? ` ${derniere.intensite}` : ''}, maintenant</p>` : ''}
    ${d !== a ? `<button class="lien retour-auj" data-action="aller" data-h="#/">Revenir à aujourd'hui ${I.droite}</button>` : ''}
    ${encours.length ? `<div class="en-cours">${encours.map((n) => `<div class="carte-encours" style="--c:${couleurDe(n)}">
        <button class="ouvrir" data-action="note" data-id="${n.id}"><b><i class="pastille-mini"></i>${esc(nomType(n.type))}</b><small>en cours depuis ${sansZero(heureDe(n.debut))} · ${texteDuree(dureeNote(n))}</small></button>
        <button class="btn btn-stop" data-action="arreter" data-id="${n.id}">${I.stop} J'arrête</button></div>`).join('')}</div>` : ''}
    <div class="statut-jour statut-${statut}">
      ${statut === 'renseigne' ? `<span>${pluriel(toutes.length, 'note')}${groupes.length ? ` · ${pluriel(groupes.length, 'enchaînement')}` : ''}</span>` : ''}
      ${statut === 'calme' ? '<span>Journée calme, rien à signaler</span><button class="lien" data-action="calme">Annuler</button>' : ''}
      ${statut === 'pause' ? `<span>Pause du suivi depuis le ${dateNum(pause.du)}</span><button class="lien" data-action="fin-pause">Reprendre</button>` : ''}
      ${statut === 'vide' ? '<span>Rien de noté</span><button class="lien" data-action="calme">Journée calme</button>' : ''}
    </div>
    ${visibles.length ? frise(d, visibles) : statut === 'renseigne' ? '<p class="vide">Toutes les notes de ce jour sont dans des calques masqués.</p>' : `<p class="vide">${d === a ? 'Touche « Noter » quand quelque chose se passe : deux touchers suffisent.' : 'Aucune note ce jour-là. Un jour sans note ne compte pas dans les calculs.'}</p>`}
    ${masquees > 0 && visibles.length ? `<p class="aide centre">${pluriel(masquees, 'note masquée', 'notes masquées')} par les calques. <button class="lien" data-action="calques">Calques</button></p>` : ''}
    ${groupes.length ? `<div class="titre-section">Enchaînements</div><ul class="liste-groupes">${groupes.map(carteGroupe).join('')}</ul>` : ''}
    ${toutes.length ? `<div class="titre-section">Toutes les notes du jour</div><ul class="notes">${toutes.map(ligneNote).join('')}</ul>` : ''}
    <div class="pied-jour"><button class="lien" data-action="aller" data-h="#/guide">${I.guide} Tout ce que fait Logger</button></div>`;
  if (defilerVersMaintenant && d === a) app.querySelector('.maintenant')?.scrollIntoView({ block: 'center' });
  defilerVersMaintenant = false;
}

function carteGroupe(g) {
  const chaine = g.types.map((t) => esc(nomType(t))).join(' → ');
  return `<li><button class="carte-groupe ${g.sorte}" data-action="groupe" data-id="${g.id}">
    <span class="cg-tete"><b>${g.sorte === 'bloc' ? esc(g.nom || 'Bloc') : 'Épisode'}</b><small>${sansZero(heureDe(g.notes[0].debut))} → ${sansZero(heureDe(horodatageDe(g.finMin)))} · ${texteDuree(g.duree)} · ${pluriel(g.notes.length, 'note')}${g.pic != null ? ` · pic ${g.pic}` : ''}</small></span>
    <span class="cg-chaine">${chaine}</span>
  </button></li>`;
}

/** Frise verticale : une colonne par type présent, le temps qui descend, des points et des plages. */
function frise(date, notes) {
  const r = S.reglages();
  const px = r.echelleHeure;
  const zero = minutes(`${date}T00:00`);
  const h = (ts) => (minutes(ts) - zero) / 60;
  const now = maintenantMin();
  const finH = (n) => (n.enCours ? (now - zero) / 60 : n.fin ? h(n.fin) : h(n.debut));
  let h0 = DEBUT_JOURNEE, h1 = DEBUT_JOURNEE + 24;
  if (resserre) {
    h0 = Math.max(DEBUT_JOURNEE, Math.floor(Math.min(...notes.map((n) => h(n.debut)))) - 1);
    h1 = Math.min(DEBUT_JOURNEE + 24, Math.ceil(Math.max(...notes.map(finH))) + 1);
    if (h1 - h0 < 3) h1 = Math.min(DEBUT_JOURNEE + 24, h0 + 3);
  }
  const hauteur = (h1 - h0) * px;
  const y = (v) => Math.max(0, Math.min(hauteur, (v - h0) * px));
  // Colonnes : un type par colonne, dans l'ordre des familles.
  const ordreFam = FAMILLES.map((f) => f.id);
  const types = [...new Set(notes.map((n) => n.type))].sort((a, b) => ordreFam.indexOf(S.type(a)?.famille) - ordreFam.indexOf(S.type(b)?.famille));
  const heures = [];
  for (let k = h0; k <= h1; k++) heures.push(`<span class="frise-heure" style="top:${y(k)}px">${k % 24} h</span>`);
  const groupes = tousGroupes(now).filter((g) => g.notes.some((n) => notes.includes(n)));
  const reperes = groupes.map((g) => {
    const t0 = y((g.debutMin - zero) / 60), t1 = y((g.finMin - zero) / 60);
    return `<button class="frise-groupe ${g.sorte}" data-action="groupe" data-id="${g.id}" style="top:${t0}px;height:${Math.max(16, t1 - t0)}px" aria-label="${g.sorte === 'bloc' ? 'Bloc' : 'Épisode'}"></button>`;
  }).join('');
  const fond = `height:${hauteur}px;background-size:100% ${px}px`;
  const colonnes = types.map((tid) => {
    const t = S.type(tid);
    const marques = notes.filter((n) => n.type === tid).map((n) => {
      const top = y(h(n.debut));
      const label = `${nomType(n.type)} · ${quand(n)}${n.intensite != null ? ` · ${n.intensite}` : ''}`;
      if (n.fin || n.enCours) {
        const bas = y(finH(n));
        return `<button class="frise-plage ${t?.famille === 'sommeil' ? 'degrade' : ''} ${n.enCours ? 'encours' : ''}" data-action="note" data-id="${n.id}" style="top:${top}px;height:${Math.max(10, bas - top)}px" aria-label="${esc(label)}" data-tip="${esc(label)}">${n.intensite != null ? `<span>${n.intensite}</span>` : ''}</button>`;
      }
      const taille = n.intensite != null ? 12 + n.intensite * 1.2 : 12;
      return `<button class="frise-point ${n.precision !== 'exacte' ? 'approx' : ''} ${n.issue === 'cede' ? 'cede' : ''}" data-action="note" data-id="${n.id}" style="top:${top}px;--t:${taille}px" aria-label="${esc(label)}" data-tip="${esc(label)}">${n.intensite != null && taille >= 20 ? n.intensite : ''}</button>`;
    }).join('');
    return `<div class="frise-corps frise-col" style="--c:${famille(t?.famille)?.couleur};${fond}">${marques}</div>`;
  }).join('');
  const vNow = (now - zero) / 60;
  const ligneNow = date === auj() && vNow >= h0 && vNow <= h1 ? `<div class="maintenant" style="top:${TETE_FRISE + y(vNow)}px"><span>${heureMaintenant()}</span></div>` : '';
  return `<div class="frise-outils">
      <button class="puce" data-action="resserrer">${resserre ? 'Voir les 24 h' : 'Resserrer sur les notes'}</button>
      <span class="frise-zoom"><span>Hauteur</span><button class="btn-icone petit" data-action="zoom" data-pas="-1" aria-label="Moins haut">${I.moins}</button><button class="btn-icone petit" data-action="zoom" data-pas="1" aria-label="Plus haut">${I.plus}</button></span>
    </div>
    <div class="frise">
      <div class="frise-grille" style="grid-template-columns: 46px repeat(${types.length}, minmax(30px, 1fr));min-width:${46 + types.length * 30}px">
        <div class="frise-tete gouttiere"></div>
        ${types.map((tid) => `<div class="frise-tete" style="--c:${famille(S.type(tid)?.famille)?.couleur}"><span>${esc(nomType(tid))}</span></div>`).join('')}
        <div class="frise-corps gouttiere" style="${fond}">${heures.join('')}${reperes}</div>
        ${colonnes}
        ${ligneNow}
      </div>
    </div>
    <div class="legende-frise"><span><i class="lp"></i>taille = intensité</span><span><i class="la"></i>heure approximative</span><span><i class="lb"></i>durée</span><span><i class="lg"></i>bloc · <i class="le"></i>épisode</span></div>`;
}

// --- Saisie en deux touchers -------------------------------------------------------------------

function vueNoter() {
  const us = S.usages('type');
  const frequents = [...us].sort((a, b) => b[1] - a[1]).map(([id]) => S.type(id)).filter((t) => t?.visible).slice(0, 6);
  const types = S.typesVisibles(familleSaisie);
  ouvrirFenetre(`<div class="pile">
    <h2>Noter <small>${heureMaintenant()}</small></h2>
    ${frequents.length ? `<p class="titre-choix">Les plus utilisés</p><div class="choix">${frequents.map((t) => `<button class="puce type-puce" style="--c:${famille(t.famille).couleur}" data-type="${t.id}"><i class="pastille-mini"></i>${esc(t.nom)}</button>`).join('')}</div>` : ''}
    <div class="onglets" role="tablist">${FAMILLES.map((f) => `<button class="${f.id === familleSaisie ? 'choisi' : ''}" style="--c:${f.couleur}" data-famille="${f.id}">${f.nom}</button>`).join('')}</div>
    <p class="aide">${famille(familleSaisie).aide}</p>
    <div class="grille-types">${types.map((t) => `<button class="btn-type" style="--c:${famille(t.famille).couleur}" data-type="${t.id}">${esc(t.nom)}</button>`).join('')}
      <button class="btn-type ajout" data-f="nouveau-type">${I.plus} Autre</button></div>
  </div>`);
  const fen = couche.querySelector('.fenetre');
  fen.addEventListener('click', (ev) => {
    const onglet = ev.target.closest('[data-famille]');
    if (onglet) { familleSaisie = onglet.dataset.famille; return vueNoter(); }
    const b = ev.target.closest('[data-type]');
    if (b) return etape2(S.type(b.dataset.type));
    if (ev.target.closest('[data-f="nouveau-type"]')) {
      const fam = familleSaisie;
      fenetreNom(`Nouveau type : ${famille(fam).nom}`, (nom) => etape2(S.ajouterType(fam, nom)));
    }
  });
}

function etape2(t) {
  const s = SAISIE[t.famille];
  const coul = famille(t.famille).couleur;
  if (s.plage) {
    const choix = [[0, 'Là, maintenant'], ['go', 'Je commence'], [15, 'Depuis 15 min'], [30, 'Depuis 30 min'], [45, 'Depuis 45 min'], [60, 'Depuis 1 h'], [90, 'Depuis 1 h 30'], [120, 'Depuis 2 h']];
    ouvrirFenetre(`<div class="pile" style="--c:${coul}">
      <h2><i class="pastille-mini"></i>${esc(t.nom)} <small>quand ?</small></h2>
      <div class="grille-types">${choix.map(([v, nom]) => `<button class="btn-type ${v === 'go' ? 'fort' : ''}" data-q="${v}">${nom}</button>`).join('')}</div>
      <button class="lien" data-q="autre">Autre heure, ou une durée précise…</button>
    </div>`);
    couche.querySelector('.fenetre').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-q]');
      if (!b) return;
      const q = b.dataset.q;
      const maint = horodatage();
      if (q === 'autre') { const n = S.ajouterNote({ type: t.id, fin: ajouterMinutes(maint, 0) }); n.debut = ajouterMinutes(maint, -30); S.enregistrer(); fermer(); route(); return fenetreNote(n, true); }
      if (q === 'go') return enregistre({ type: t.id, enCours: true }, `${t.nom} : c'est parti`);
      const m = Number(q);
      return enregistre(m ? { type: t.id, debut: ajouterMinutes(maint, -m), fin: maint } : { type: t.id }, m ? `${t.nom} : ${texteDuree(m)}` : `${t.nom} noté`);
    });
    return;
  }
  if (s.intensite && t.echelle) {
    const { min, max, bas, haut } = t.echelle;
    const vals = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    ouvrirFenetre(`<div class="pile" style="--c:${coul}">
      <h2><i class="pastille-mini"></i>${esc(t.nom)} <small>intensité</small></h2>
      <div class="grille-intensite">${vals.map((v) => `<button data-v="${v}" style="--k:${(v - min) / ((max - min) || 1)}">${v}</button>`).join('')}</div>
      <div class="echelle-legende"><span>${esc(bas || '')}</span><span>${esc(haut || '')}</span></div>
      <button class="lien" data-v="">Noter sans intensité</button>
    </div>`);
    couche.querySelector('.fenetre').addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-v]');
      if (!b) return;
      const v = b.dataset.v === '' ? null : Number(b.dataset.v);
      enregistre({ type: t.id, intensite: v }, `${t.nom}${v != null ? ` ${v}` : ''} noté à ${heureMaintenant()}`);
    });
    return;
  }
  enregistre({ type: t.id }, `${t.nom} noté à ${heureMaintenant()}`);
}

function enregistre(champs, message) {
  const n = S.ajouterNote(champs);
  fermer();
  defilerVersMaintenant = true;
  if (jourAffiche !== auj()) aller('#/'); else route();
  complement(n, message);
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
  else if (t.famille === 'sommeil' && t.echelle) rapide = `<p class="titre-choix">${esc(t.echelle.bas)} → ${esc(t.echelle.haut)}</p><div class="intensite-mini">${Array.from({ length: 11 }, (_, v) => `<button class="${n.intensite === v ? 'choisi' : ''}" data-champ="intensite" data-val="${v}">${v}</button>`).join('')}</div>`;
  else if (t.famille === 'activite') rapide = `<div class="choix">${CERCLES.map((c) => `<button class="puce ${n.avecQui.includes(c.id) ? 'choisi' : ''}" data-cercle="${c.id}">${c.nom}</button>`).join('')}</div>`;
  else if (t.famille === 'declencheur' || t.famille === 'etat') {
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
      const v = b.dataset.champ === 'intensite' ? Number(b.dataset.val) : b.dataset.val;
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

function etiquettesParUsage() {
  const us = S.usages('etiquettes');
  return S.get().etiquettes.filter((e) => !e.archive).sort((a, b) => (us.get(b.id) || 0) - (us.get(a.id) || 0));
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
    <div class="echelle" data-zone="${champ}" style="grid-template-columns: repeat(11, 1fr)">${Array.from({ length: 11 }, (_, v) => `<button type="button" class="puce ${val === v ? 'choisi' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
    ${bas || haut ? `<div class="echelle-legende"><span>${esc(bas)}</span><span>${esc(haut)}</span></div>` : ''}
    <input type="hidden" name="${champ}" value="${val ?? ''}">`;
  const unChoix = (champ, liste, val, titre) => `<p class="titre-choix">${titre}<em>facultatif</em></p><div class="choix" data-un="${champ}">${liste.map((x) => `<button type="button" class="puce ${val === x.id ? 'choisi' : ''}" data-v="${esc(x.id)}">${esc(x.nom)}</button>`).join('')}</div><input type="hidden" name="${champ}" value="${esc(val ?? '')}">`;
  const plusieurs = (attr, liste, vals) => liste.map((x) => `<button type="button" class="puce ${attr === 'etq' ? 'etq' : ''} ${vals.includes(x.id) ? 'choisi' : ''}" data-${attr}="${x.id}">${esc(x.nom)}</button>`).join('');
  const blocActuel = n.bloc ? S.bloc(n.bloc) : null;
  const avecFin = !!(n.fin || n.enCours);

  ouvrirFenetre(`<form style="--c:${coul}">
    <h2><i class="pastille-mini"></i>${esc(t?.nom || 'Note')} <small>${nouvelle ? 'nouvelle note' : 'fiche de la note'}</small></h2>
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
    ${blocActuel ? `<p class="aide" data-bloc>Dans le bloc « ${esc(blocActuel.nom || 'sans nom')} ». <button type="button" class="lien" data-f="sortir-bloc">L'en retirer</button></p>` : ''}

    <button class="btn btn-principal btn-large">Enregistrer</button>
    <div class="actions-sec"><button type="button" class="lien danger" data-f="supprimer">Supprimer cette note</button></div>
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
    if (j !== jourAffiche) aller(lienJour(j)); else route();
    toast('Note enregistrée');
  });

  const f = couche.querySelector('form');
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
  f.querySelectorAll('[data-zone], [data-un]').forEach((z) => z.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-v]');
    if (!b) return;
    const deja = b.classList.contains('choisi');
    z.querySelectorAll('.puce').forEach((x) => x.classList.remove('choisi'));
    if (!deja) b.classList.add('choisi');
    f[z.dataset.zone || z.dataset.un].value = deja ? '' : b.dataset.v;
  }));
  f.querySelectorAll('[data-multi]').forEach((z) => z.addEventListener('click', (ev) => {
    const b = ev.target.closest('.puce:not(.ajout)');
    if (b) b.classList.toggle('choisi');
  }));
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
  f.querySelector('[data-f="sortir-bloc"]')?.addEventListener('click', () => {
    S.definirMembres(n.bloc, S.get().notes.filter((x) => x.bloc === n.bloc && x.id !== n.id).map((x) => x.id));
    f.querySelector('[data-bloc]').remove();
    toast('Retirée du bloc');
  });
  f.querySelector('[data-f="supprimer"]').addEventListener('click', (ev) => {
    if (!confirmerDeux(ev.currentTarget)) return;
    const copie = S.supprimerNote(n.id);
    fermer(); route();
    toast('Note supprimée', { libelle: 'Annuler', action: () => { S.remettreNote(copie); route(); } });
  });
}

// --- Épisodes et blocs --------------------------------------------------------------------------

function trouverGroupe(id) {
  return tousGroupes().find((g) => g.id === id);
}

function fenetreGroupe(id) {
  const g = trouverGroupe(id);
  if (!g) return toast('Cet enchaînement a changé');
  const bloc = g.sorte === 'bloc';
  ouvrirFenetre(`<div class="pile">
    <h2>${bloc ? esc(g.nom || 'Bloc') : 'Épisode'} <small>${sansZero(heureDe(g.notes[0].debut))} → ${sansZero(heureDe(horodatageDe(g.finMin)))} · ${texteDuree(g.duree)}${g.pic != null ? ` · pic ${g.pic}` : ''}</small></h2>
    <p class="aide">${bloc ? 'Regroupement fait à la main.' : `Calculé : des notes à moins de ${S.reglages().ecartEpisode} min d'écart. Fige-le en bloc pour le nommer, l'étendre, le réduire ou le couper.`}</p>
    <div class="chaine">${g.types.map((t) => `<span style="--c:${famille(S.type(t)?.famille)?.couleur}">${esc(nomType(t))}</span>`).join('<b>→</b>')}</div>
    <ul class="notes">${g.notes.map(ligneNote).join('')}</ul>
    ${bloc ? `<label class="champ"><span>Nom du bloc</span><input data-f="nom" value="${esc(g.nom)}" placeholder="Soirée difficile…" autocomplete="off"></label>` : ''}
    <button class="btn btn-principal btn-large" data-f="membres">${bloc ? 'Ajouter ou retirer des notes' : 'Figer en bloc et ajuster les notes'}</button>
    ${bloc ? '<div class="actions-sec"><button class="lien danger" data-f="defaire">Défaire le bloc (les notes restent)</button></div>' : ''}
  </div>`);
  const fen = couche.querySelector('.fenetre');
  fen.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-action="note"]');
    if (b) fenetreNote(S.note(b.dataset.id));
  });
  fen.querySelector('[data-f="nom"]')?.addEventListener('change', (ev) => { S.bloc(g.id).nom = ev.target.value.trim(); S.enregistrer(); vueJour(); toast('Bloc renommé'); });
  fen.querySelector('[data-f="membres"]').addEventListener('click', () => fenetreMembres(g));
  fen.querySelector('[data-f="defaire"]')?.addEventListener('click', (ev) => {
    if (!confirmerDeux(ev.currentTarget)) return;
    S.defaireBloc(g.id); fermer(); route(); toast('Bloc défait');
  });
}

function fenetreMembres(g) {
  const liste = voisines(S.notesTriees(), g);
  const dedans = new Set(g.notes.map((n) => n.id));
  ouvrirFenetre(`<form>
    <h2>Notes du bloc <small>de 3 h avant à 3 h après</small></h2>
    <p class="aide">Coche les notes du même enchaînement : c'est ainsi qu'on étend, réduit ou coupe un bloc.</p>
    <ul class="coches">${liste.map((n) => `<li><label style="--c:${couleurDe(n)}"><input type="checkbox" value="${n.id}" ${dedans.has(n.id) ? 'checked' : ''}>
      <span class="ln-quand">${esc(quand(n))}</span><span><i class="pastille-mini"></i>${esc(nomType(n.type))}${n.intensite != null ? ` · ${n.intensite}` : ''}${n.bloc && n.bloc !== g.id ? ' <em>(dans un autre bloc)</em>' : ''}</span></label></li>`).join('')}</ul>
    <button class="btn btn-principal btn-large">Enregistrer le bloc</button>
  </form>`, () => {
    const ids = [...couche.querySelectorAll('.coches input:checked')].map((x) => x.value);
    if (!ids.length) return toast('Coche au moins une note');
    if (g.sorte === 'bloc') S.definirMembres(g.id, ids); else S.creerBloc(ids);
    fermer(); route(); toast('Bloc enregistré');
  });
}

// --- Calques -------------------------------------------------------------------------------------

function fenetreCalques() {
  const r = S.reglages();
  ouvrirFenetre(`<div class="pile">
    <h2>Calques</h2>
    <p class="aide">Les familles affichées sur la frise. Les notes masquées restent dans la liste du jour.</p>
    ${FAMILLES.map((f) => `<label class="interrupteur" style="--c:${f.couleur}"><span><i class="pastille-mini"></i>${f.nom}</span><input type="checkbox" data-fam="${f.id}" ${r.calques.includes(f.id) ? 'checked' : ''}><i></i></label>`).join('')}
    <div class="actions-sec"><button class="lien" data-f="tout">Tout afficher</button></div>
  </div>`);
  const fen = couche.querySelector('.fenetre');
  fen.addEventListener('change', (ev) => {
    const c = ev.target.dataset.fam;
    if (!c) return;
    r.calques = ev.target.checked ? [...new Set([...r.calques, c])] : r.calques.filter((x) => x !== c);
    S.enregistrer(); vueJour();
  });
  fen.querySelector('[data-f="tout"]').addEventListener('click', () => { r.calques = FAMILLES.map((f) => f.id); S.enregistrer(); fermer(); vueJour(); });
}

// --- Réglages ----------------------------------------------------------------------------------

function vueReglages() {
  const r = S.reglages();
  const copie = S.copieDisponible();
  const pauses = [...S.get().pauses].sort((a, b) => b.du.localeCompare(a.du));
  const enPause = S.enPause(auj());
  app.innerHTML = `
    ${bandeau({ retour: '#/', titre: 'Réglages' })}
    <div class="carte">
      <h3>Types de notes <small>${S.get().types.filter((t) => t.visible).length} affichés</small></h3>
      <p class="aide">Afficher ou masquer chaque état, envie, coping, activité… Renommer, ajouter les tiens.</p>
      <button class="btn btn-large" data-action="aller" data-h="#/reglages/types">Gérer les types ${I.droite}</button>
    </div>
    <div class="carte">
      <h3>Étiquettes et personnes</h3>
      <p class="aide">Ta bibliothèque d'étiquettes (contexte, déclencheurs) et les prénoms : renommer, archiver, fusionner.</p>
      <button class="btn btn-large" data-action="aller" data-h="#/reglages/etiquettes">Gérer ${I.droite}</button>
    </div>
    <div class="carte">
      <h3>Épisodes</h3>
      <label class="champ"><span>Écart maximum entre deux notes d'un même épisode (minutes)</span><input type="number" inputmode="numeric" min="5" max="240" step="5" value="${r.ecartEpisode}" data-f="ecart"></label>
      <p class="aide">Un épisode calculé n'est qu'une proposition : touche-le pour le figer en bloc et l'ajuster.</p>
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
      <p class="aide">Trois semaines de notes inventées (soirées en chaîne, activités, endormissement). Retirables d'un geste.</p>
      ${S.aDesExemples() ? '<button class="btn btn-large" data-action="retirer-exemple">Retirer l\'exemple</button>' : '<button class="btn btn-large" data-action="charger-exemple">Charger l\'exemple</button>'}
    </div>
    <div class="carte">
      <h3>Aide</h3>
      <button class="btn btn-large" data-action="aller" data-h="#/guide">${I.guide} Tout ce que fait Logger</button>
      <p class="aide">Besoin de parler à quelqu'un tout de suite : <b>3114</b>, numéro national de prévention du suicide, gratuit, 24 h/24.</p>
    </div>
    <div class="zone-danger"><button class="lien danger" data-action="tout-effacer">Tout effacer sur cet appareil</button></div>
    <p class="pied">Logger v2.0 · les données restent sur cet appareil</p>`;
  app.querySelector('[data-f="ecart"]').addEventListener('change', (ev) => {
    const v = Math.max(5, Math.min(240, Number(ev.target.value) || 45));
    r.ecartEpisode = v; S.enregistrer(); toast(`Épisodes : ${v} min d'écart au plus`);
  });
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
      ['Noter en deux touchers', '« Noter » → un type → l\'intensité. C\'est enregistré à l\'heure actuelle.'],
      ['Encore', 'Répète la dernière note, maintenant (écrit sous le bandeau). Pour une nouvelle impulsion, même 2 min après.'],
      ['Après chaque note', 'Un panneau en bas propose les compléments utiles (cédé / traversée, a aidé ?, avec qui, étiquettes…), puis disparaît seul.'],
      ['Plages', 'Coping, activités, sommeil : « Je commence » puis « J\'arrête », ou « Depuis 30 min ». Toute note peut devenir une plage dans sa fiche.'],
      ['Heure approximative', 'Dans la fiche : heure exacte, environ, ou un moment (la nuit, le matin…). Pas besoin de regarder l\'horloge.'],
      ['Fiche d\'une note', 'Toucher une note (sur la frise ou dans la liste) : type, heure, durée, intensité, avec qui, étiquettes, phrase. Tout est facultatif.'],
      ['Activités', 'Un nom libre réutilisable, plaisir et maîtrise de 0 à 10, facettes (choisie, écran, créatif…).'],
    ]],
    ['Lire sa journée', [
      ['Frise verticale', 'Le temps descend, une colonne par type. Taille du point = intensité ; cercle évidé = heure approximative ; barre = durée.'],
      ['Journée de vie', 'De 5 h à 5 h : une note à 1 h du matin appartient à la veille.'],
      ['Calques', 'Afficher ou masquer chaque famille sur la frise.'],
      ['Voir les 24 h / Hauteur', 'Cadrer la frise sur les notes ou sur la journée entière ; changer la hauteur des heures.'],
      ['Jours précédents', 'Flèches du bandeau ; « Revenir à aujourd\'hui » quand tu remontes.'],
    ]],
    ['Enchaînements', [
      ['Épisodes', 'Des notes à moins de 45 min d\'écart (réglable) forment un épisode : trait pointillé à gauche de la frise, et carte sous la frise.'],
      ['Blocs', 'Fige un épisode en bloc pour le nommer, l\'étendre, le réduire ou le couper (cocher les notes). Trait plein.'],
    ]],
    ['Jours et pauses', [
      ['Jour renseigné', 'Un jour avec une note, ou « Journée calme ». Un jour vide ne compte pas dans les calculs : pas de jour raté.'],
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
      ['v2.1', 'Questionnaires (WHO-5, PHQ-9, GAD-7, AUDIT-C, MDS-16), journal du matin, bilan du soir.'],
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
    fermer(); aller('#/');
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
  fermer();
  panneau.hidden = true;
  app.innerHTML = '';
  verrouEl.innerHTML = '<img src="icons/icon-192.png" alt=""><h2>Logger</h2><div data-pave></div><button class="lien" data-f="oubli">Code oublié ?</button>';
  verrouEl.hidden = false;
  V.pave(verrouEl.querySelector('[data-pave]'), async (saisi, recommencer) => {
    if (await V.empreinte(saisi, code.sel) !== code.empreinte) return recommencer(true);
    verrouEl.hidden = true;
    verrouEl.innerHTML = '';
    defilerVersMaintenant = true;
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

function ouvrirFenetre(html, onSubmit) {
  panneau.hidden = true;
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

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el || el.disabled) return;
  const d = el.dataset;
  switch (d.action) {
    case 'aller': return aller(d.h);
    case 'noter': return vueNoter();
    case 'encore': {
      const n = S.encore();
      if (!n) return;
      defilerVersMaintenant = true;
      if (jourAffiche !== auj()) aller('#/'); else route();
      return complement(n, `${nomType(n.type)}${n.intensite != null ? ` ${n.intensite}` : ''} encore, à ${heureMaintenant()}`);
    }
    case 'calques': return fenetreCalques();
    case 'note': return fenetreNote(S.note(d.id));
    case 'groupe': return fenetreGroupe(d.id);
    case 'arreter': { const n = S.note(d.id); S.arreter(n); route(); return toast(`${nomType(n.type)} : ${texteDuree(dureeNote(n))}`); }
    case 'calme': S.basculerCalme(jourAffiche); route(); return toast(S.statutJour(jourAffiche) === 'calme' ? 'Journée calme notée' : 'Retiré');
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
    case 'charger-exemple': S.chargerExemple(exemple(auj())); toast('Exemple chargé'); defilerVersMaintenant = true; return aller('#/');
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
