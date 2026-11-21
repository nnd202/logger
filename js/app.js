// Logger v2 : un journal unique de santé mentale.
// Écran du jour : pastilles de jours, mini-frise des 24 heures (le planning replié),
// planning déployable, puis les notes du jour en cartes, chaque carte portant son enchaînement.
import * as S from './store.js';
import * as V from './verrou.js';
import * as C from './crypto.js';
import { exemple } from './demo.js';
import { activerBulles, teinte } from './graph.js';
import { FAMILLES, famille, SAISIE, CERCLES, FACETTES, MOMENTS, AIDE, ISSUES, DEBUT_JOURNEE, LATENCES, ZONE_MIN, SUGGESTIONS } from './catalogue.js';
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

let dernierJourAffiche = null;

function vueJour() {
  const d = jourAffiche;
  // Même jour réaffiché (durée, déplacement, hauteur, note ajoutée) : on garde la position, verticale et latérale.
  const memo = d === dernierJourAffiche && app.querySelector('.bandeau-jour')
    ? { y: window.scrollY, x: app.querySelector('.pl-defile')?.scrollLeft || 0 } : null;
  dernierJourAffiche = d;
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
    ${!S.reglages().code ? `<div class="rappel-code">${I.cadenas}<span>Aucun code : l'appli s'ouvre sans protection.</span><button class="lien" data-action="code">Créer un code</button></div>` : ''}
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
  if (ouvert) brancherPlanning();
  if (memo) {
    const defile = app.querySelector('.pl-defile');
    if (defile) defile.scrollLeft = memo.x;
    window.scrollTo(0, memo.y);
  }
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
 * Planning déployé : une colonne par type présent (pastille-icône en tête), le temps qui descend,
 * les heures fixes à gauche et les colonnes qui défilent à l'horizontale. Chaque note = une pastille
 * à son heure, prolongée d'une barre si elle dure. Gestes : toucher une pastille ouvre la fiche ;
 * appui long → déplacer ; appui long sur la petite poignée → durée ; toucher un vide → noter à cette heure.
 * Appui long sur une icône du haut → ranger la colonne.
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
  const OFF = 18; // marge haute et basse : les pastilles du bord ne sont pas coupées
  const y = (m) => (h(m) - h0) * px + OFF;
  const hauteur = (h1 - h0) * px + 2 * OFF;
  // Colonnes dans l'ordre fixé pour ce jour : rien ne bouge tout seul, un nouveau type s'ajoute à la fin,
  // et l'appui long sur une icône du haut permet de les ranger.
  const types = S.ordreColonnes(d, notes);
  const heures = [];
  for (let k = h0; k <= h1; k++) heures.push(`<span class="plh" style="top:${(k - h0) * px + OFF}px">${k} h</span>`);
  const colonnes = types.map((tid) => {
    const t = S.type(tid);
    const f = famille(t?.famille);
    const marques = notes.filter((n) => n.type === tid).map((n) => {
      const a = debutM(n);
      const barre = n.fin || n.enCours ? Math.max(0, y(finM(n)) - y(a)) : 0;
      const veille = minutes(n.debut) < zero;
      return `<div class="pln ${t?.famille === 'envie' ? 'anneau' : ''} ${n.issue === 'cede' ? 'cede' : ''} ${n.precision !== 'exacte' ? 'approx' : ''} ${veille ? 'veille' : ''}" data-id="${n.id}" style="top:${y(a)}px">
        ${barre ? `<div class="pln-barre ${t?.endormissement ? 'degrade' : ''} ${n.enCours ? 'encours' : ''}" style="height:${Math.max(22, barre)}px">${n.fin && !n.enCours ? `<span class="pln-fin" ${barre < 44 ? 'hidden' : ''}>${sansZero(heureDe(n.fin))}</span>` : ''}</div>` : ''}
        <span class="pln-heure">${veille ? 'veille' : `${n.precision === 'vers' ? '~' : ''}${sansZero(heureDe(n.debut))}`}</span>
        <button class="pln-pastille" data-pastille aria-label="${esc(`${nomType(n.type)} · ${quand(n)}${n.intensite != null ? ` · ${n.intensite}` : ''}`)}">${esc(t?.icone || '•')}${n.intensite != null ? `<small>${n.intensite}</small>` : ''}</button>
        <span class="pln-poignee" data-poignee style="top:${Math.max(24, barre)}px" aria-label="Étirer la durée"></span>
      </div>`;
    }).join('');
    return `<div class="plc" data-type="${tid}" style="--c:${f?.couleur}">${marques}</div>`;
  }).join('');
  const vNow = h(now);
  const ligneNow = d === auj() && vNow >= h0 && vNow <= h1 ? `<div class="pl-maintenant" style="top:${(vNow - h0) * px + OFF}px"></div>` : '';
  const nowGouttiere = ligneNow ? `<span class="plh plh-now" style="top:${(vNow - h0) * px + OFF}px">${heureMaintenant()}</span>` : '';
  return `<div class="planning-outils">
      <button class="puce" data-action="resserrer">${resserre ? 'Voir les 24 h' : 'Resserrer sur les notes'}</button>
      <span class="frise-zoom"><span>Hauteur</span><button class="btn-icone petit" data-action="zoom" data-pas="-1" aria-label="Moins haut">${I.moins}</button><button class="btn-icone petit" data-action="zoom" data-pas="1" aria-label="Plus haut">${I.plus}</button></span>
    </div>
    <div class="pl" data-zero="${zero}" data-h0="${h0}" data-h1="${h1}" data-px="${px}" data-off="${OFF}" data-jour="${d}">
      <div class="pl-gouttiere"><div class="pl-tete"></div><div class="pl-heures" style="height:${hauteur}px">${heures.join('')}${nowGouttiere}</div></div>
      <div class="pl-defile">
        <div class="pl-cols" style="--n:${types.length + 1}">
          <div class="pl-tetes">${types.map((tid) => `<button class="pl-entete" style="--c:${famille(S.type(tid)?.famille)?.couleur}" data-entete="${tid}" aria-label="${esc(nomType(tid))}">${esc(S.type(tid)?.icone || '•')}</button>`).join('')}
            <button class="pl-entete ajout" data-action="noter-ici" aria-label="Noter un autre type">${I.plus}</button></div>
          <div class="pl-corps" style="height:${hauteur}px;background-size:100% ${px}px;background-position:0 ${OFF}px">
            ${colonnes}<div class="plc plc-ajout" data-type=""></div>
            ${ligneNow}
          </div>
        </div>
      </div>
    </div>
    <div class="pl-legende">
      <button class="lien" data-action="legende">${legendeOuverte ? 'Masquer la légende' : 'Légende et gestes'} ${I.bas}</button>
      ${legendeOuverte ? `<ul class="legende-types">${types.map((tid) => { const t = S.type(tid); return `<li style="--c:${famille(t?.famille)?.couleur}"><span class="pl-entete mini">${esc(t?.icone || '•')}</span><b>${esc(t?.nom || '')}</b><small>${famille(t?.famille)?.un || ''}</small></li>`; }).join('')}</ul>
        <ul class="legende-gestes">
          <li><span class="pln-demo"></span>Pastille pleine : c'est arrivé, à cette heure.</li>
          <li><span class="pln-demo anneau"></span>Anneau seul : une envie (anneau épais : cédée).</li>
          <li><span class="pln-demo approx"></span>Pointillés : heure approximative.</li>
          <li><span class="pln-demo barre"></span>Barre : la durée.</li>
          <li>Toucher une icône du haut : son nom et sa famille. Appui long sur une icône du haut : ranger la colonne ailleurs.</li>
          <li>Toucher une pastille : sa fiche. Appui long sur la pastille : la déplacer (son contour passe en pointillés).</li>
          <li>Appui long sur la poignée sous la pastille, puis tirer : la durée (la barre passe en pointillés ; remonter jusqu'à la pastille l'annule). L'heure de fin s'écrit au bas de la barre.</li>
          <li>Toucher un vide : noter à cette heure. Un nouveau type s'ajoute en dernière colonne ; rien ne change de place tout seul.</li>
        </ul>` : ''}
    </div>`;
}

let legendeOuverte = false;

/** Gestes du planning : toucher, appui long pour déplacer, poignée pour la durée, toucher un vide. */
function brancherPlanning() {
  const pl = app.querySelector('.pl');
  if (!pl) return;
  const corps = pl.querySelector('.pl-corps');
  const zero = Number(pl.dataset.zero), h0 = Number(pl.dataset.h0), h1 = Number(pl.dataset.h1), px = Number(pl.dataset.px), off = Number(pl.dataset.off);
  // Jamais au-delà de maintenant : on ne déplace ni n'étire une note dans le futur.
  const limite = pl.dataset.jour === auj() ? Math.min(zero + h1 * 60, maintenantMin()) : zero + h1 * 60;
  const tempsDe = (clientY, max = limite) => {
    const top = corps.getBoundingClientRect().top + off;
    const m = zero + h0 * 60 + ((clientY - top) / px) * 60;
    return Math.max(zero + h0 * 60, Math.min(max, Math.round(m / 5) * 5));
  };
  const yDe = (m) => ((m - zero) / 60 - h0) * px + off;
  const bulle = document.getElementById('bulle-heure');
  const montrer = (ev, texte) => {
    clearTimeout(bulle.minuteur);
    bulle.textContent = texte;
    bulle.hidden = false;
    const l = Math.min(window.innerWidth - 150, Math.max(8, ev.clientX - 150));
    bulle.style.left = `${l}px`;
    bulle.style.top = `${Math.max(8, ev.clientY - 74)}px`;
  };
  const cacher = () => { bulle.hidden = true; };
  const hm = (m) => sansZero(heureDe(horodatage(new Date(m * 60000))));
  let g = null;
  // Pendant un geste (après l'appui long), le doigt ne fait plus défiler l'écran.
  let bloquer = false;
  pl.addEventListener('touchmove', (ev) => { if (bloquer) ev.preventDefault(); }, { passive: false });
  pl.addEventListener('contextmenu', (ev) => ev.preventDefault());
  const tenir = (sorte, faire) => setTimeout(() => {
    if (!g || g.sorte !== sorte) return;
    bloquer = true;
    navigator.vibrate?.(15);
    faire();
  }, 400);

  corps.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('.pln');
    if (!el) return;
    const n = S.note(el.dataset.id);
    const poignee = ev.target.closest('[data-poignee]');
    const pastille = ev.target.closest('[data-pastille]');
    if (!poignee && !pastille) return;
    (poignee || pastille).setPointerCapture(ev.pointerId);
    g = { el, n, x0: ev.clientX, y0: ev.clientY, debut: minutes(n.debut), debutAff: Math.max(minutes(n.debut), zero + h0 * 60) };
    if (poignee) {
      // Appui long sur la poignée : un simple glissement fait défiler le planning sans toucher à la durée.
      g.sorte = 'attente-poignee';
      g.minuteur = tenir('attente-poignee', () => {
        g.sorte = 'etirer';
        el.classList.add('saisi', 'etire');
        montrer(ev, n.fin ? `jusqu'à ${sansZero(heureDe(n.fin))} · glisse` : 'Glisse vers le bas pour la durée');
      });
      return;
    }
    g.sorte = 'attente';
    if (!el.classList.contains('veille')) g.minuteur = tenir('attente', () => {
      g.sorte = 'deplacer';
      el.classList.add('saisi', 'deplace');
      montrer(ev, `${sansZero(heureDe(n.debut))} · glisse pour déplacer`);
    });
  });
  corps.addEventListener('pointermove', (ev) => {
    if (!g) return;
    if (g.sorte.startsWith('attente')) {
      if (Math.hypot(ev.clientX - g.x0, ev.clientY - g.y0) > 8) { clearTimeout(g.minuteur); g.sorte = 'rien'; }
      return;
    }
    const heure = g.el.querySelector('.pln-heure');
    const fin = g.el.querySelector('.pln-fin');
    if (g.sorte === 'deplacer') {
      const duree = g.n.fin ? minutes(g.n.fin) - g.debut : 0;
      const m = tempsDe(ev.clientY, limite - duree);
      g.m = m;
      g.el.style.top = `${yDe(m)}px`;
      if (heure) heure.textContent = `${g.n.precision === 'vers' ? '~' : ''}${hm(m)}`;
      if (fin && duree) fin.textContent = hm(m + duree);
      montrer(ev, duree ? `${hm(m)} → ${hm(m + duree)}` : hm(m));
    } else if (g.sorte === 'etirer') {
      const m = tempsDe(ev.clientY);
      g.m = m;
      const duree = m - g.debut;
      const barreH = duree > 0 ? Math.max(22, yDe(m) - yDe(g.debutAff)) : 0;
      let barre = g.el.querySelector('.pln-barre');
      if (!barre && barreH) { barre = document.createElement('div'); barre.className = 'pln-barre'; g.el.prepend(barre); }
      if (barre) {
        barre.style.height = `${barreH}px`;
        barre.hidden = !barreH;
        let f = barre.querySelector('.pln-fin');
        if (!f) { f = document.createElement('span'); f.className = 'pln-fin'; barre.append(f); }
        f.textContent = hm(m);
        f.hidden = barreH < 44;
      }
      g.el.querySelector('.pln-poignee').style.top = `${Math.max(24, barreH)}px`;
      montrer(ev, duree > 0 ? `jusqu'à ${hm(m)} · ${texteDuree(duree)}` : 'Sans durée');
    }
  });
  const finir = (ev, annule = false) => {
    if (!g) return;
    clearTimeout(g.minuteur);
    const { sorte, n, m, debut } = g;
    g = null;
    bloquer = false;
    if (sorte !== 'attente-poignee') cacher();
    if (annule) return sorte === 'deplacer' || sorte === 'etirer' ? vueJour() : undefined;
    if (sorte === 'attente') return fenetreNote(n);
    if (sorte === 'attente-poignee') {
      montrer(ev, 'Appui long sur la poignée, puis tire');
      bulle.minuteur = setTimeout(cacher, 1800);
      return;
    }
    if (sorte === 'deplacer' && m != null && m !== debut) {
      const ts = horodatage(new Date(m * 60000));
      if (ts > horodatage()) { toast("Cette heure n'est pas encore arrivée"); return vueJour(); }
      const d = m - debut;
      S.modifierNote(n, { debut: ts, fin: n.fin ? ajouterMinutes(n.fin, d) : null });
      toast(`Déplacée à ${sansZero(heureDe(ts))}`, { libelle: 'Annuler', action: () => { S.modifierNote(n, { debut: horodatage(new Date(debut * 60000)), fin: n.fin ? ajouterMinutes(n.fin, -d) : null }); vueJour(); } });
      return vueJour();
    }
    if (sorte === 'etirer' && m != null) {
      const avant = { fin: n.fin, enCours: n.enCours };
      if (m <= debut) S.modifierNote(n, { fin: null, enCours: false });
      else S.modifierNote(n, { fin: horodatage(new Date(m * 60000)), enCours: false });
      toast(n.fin ? `Durée : ${texteDuree(dureeNote(n))}` : 'Durée retirée', { libelle: 'Annuler', action: () => { S.modifierNote(n, avant); vueJour(); } });
      return vueJour();
    }
    if (sorte === 'deplacer' || sorte === 'etirer') vueJour();
  };
  corps.addEventListener('pointerup', (ev) => finir(ev));
  corps.addEventListener('pointercancel', (ev) => finir(ev, true));

  // Colonnes : appui long sur une icône du haut, puis glisser à gauche ou à droite pour la ranger.
  const tetes = pl.querySelector('.pl-tetes');
  const defile = pl.querySelector('.pl-defile');
  const jour = pl.dataset.jour;
  let c = null;
  let ignorerClic = false;
  const placer = () => c.ordre.forEach((tid, i) => {
    tetes.querySelector(`[data-entete="${tid}"]`).style.order = i;
    corps.querySelector(`.plc[data-type="${tid}"]`).style.order = i;
  });
  const viser = () => {
    const r = tetes.getBoundingClientRect();
    const larg = r.width / (c.ordre.length + 1);
    const i = Math.max(0, Math.min(c.ordre.length - 1, Math.floor((c.x - r.left) / larg)));
    const j = c.ordre.indexOf(c.tid);
    if (i === j) return;
    c.ordre.splice(j, 1);
    c.ordre.splice(i, 0, c.tid);
    placer();
    navigator.vibrate?.(5);
  };
  const defiler = () => {
    if (!c || c.sorte !== 'colonne') return;
    const r = defile.getBoundingClientRect();
    const pas = c.x < r.left + 36 ? -6 : c.x > r.right - 36 ? 6 : 0;
    if (pas) { defile.scrollLeft += pas; viser(); }
    c.rAF = requestAnimationFrame(defiler);
  };
  tetes.addEventListener('pointerdown', (ev) => {
    const b = ev.target.closest('[data-entete]');
    if (!b) return;
    b.setPointerCapture(ev.pointerId);
    c = { sorte: 'attente', tid: b.dataset.entete, x0: ev.clientX, y0: ev.clientY, x: ev.clientX };
    c.minuteur = setTimeout(() => {
      if (!c || c.sorte !== 'attente') return;
      c.sorte = 'colonne';
      bloquer = true;
      navigator.vibrate?.(15);
      cacher();
      c.ordre = [...tetes.querySelectorAll('[data-entete]')].map((x) => x.dataset.entete);
      tetes.querySelector('.pl-entete.ajout').style.order = 999;
      corps.querySelector('.plc-ajout').style.order = 999;
      placer();
      b.classList.add('saisi');
      corps.querySelector(`.plc[data-type="${c.tid}"]`).classList.add('saisie');
      c.rAF = requestAnimationFrame(defiler);
    }, 400);
  });
  tetes.addEventListener('pointermove', (ev) => {
    if (!c) return;
    c.x = ev.clientX;
    if (c.sorte === 'attente' && Math.hypot(ev.clientX - c.x0, ev.clientY - c.y0) > 8) { clearTimeout(c.minuteur); c.sorte = 'rien'; }
    if (c.sorte === 'colonne') viser();
  });
  const lacher = (annule) => {
    if (!c) return;
    clearTimeout(c.minuteur);
    cancelAnimationFrame(c.rAF);
    const { sorte, ordre } = c;
    c = null;
    bloquer = false;
    if (sorte !== 'colonne') return;
    ignorerClic = true;
    setTimeout(() => { ignorerClic = false; }, 50);
    if (!annule) S.ordonnerColonnes(jour, ordre);
    vueJour();
  };
  tetes.addEventListener('pointerup', () => lacher(false));
  tetes.addEventListener('pointercancel', () => lacher(true));

  // Toucher une icône du haut : son nom et sa famille, dans une bulle sous l'icône.
  tetes.addEventListener('click', (ev) => {
    if (ignorerClic) return;
    const b = ev.target.closest('[data-entete]');
    if (!b) return;
    const ty = S.type(b.dataset.entete);
    const r = b.getBoundingClientRect();
    bulle.innerHTML = `${esc(ty.icone)} ${esc(ty.nom)}<small>${esc(famille(ty.famille).un)}</small>`;
    bulle.hidden = false;
    bulle.style.left = `${Math.min(window.innerWidth - bulle.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - bulle.offsetWidth / 2))}px`;
    bulle.style.top = `${r.bottom + 8}px`;
    clearTimeout(bulle.minuteur);
    bulle.minuteur = setTimeout(cacher, 2500);
  });
  // Toucher un vide d'une colonne : noter à cette heure (ce type, ou au choix dans la dernière colonne).
  corps.addEventListener('click', (ev) => {
    const col = ev.target.classList.contains('plc') ? ev.target : null;
    if (!col) return;
    const m = tempsDe(ev.clientY);
    const ts = horodatage(new Date(m * 60000));
    if (ts > horodatage()) return toast("Cette heure n'est pas encore arrivée");
    if (!col.dataset.type) return vueNoter({ debut: ts });
    etape2(S.type(col.dataset.type), { debut: ts });
  });
}

// --- Saisie -------------------------------------------------------------------------------------

/** Fenêtre de saisie : hauteur fixe, les onglets ne rechargent que la grille. contexte.chaine : enchaîner. */
function vueNoter(contexte = {}) {
  const us = S.usages('type');
  const frequents = [...us].sort((a, b) => b[1] - a[1]).map(([id]) => S.type(id)).filter((t) => t?.visible).slice(0, 6);
  const tete = contexte.chaine ? S.note(contexte.chaine) : null;
  ouvrirFenetre(`<div class="saisie">
    <h2>${tete ? `Enchaîner <small>à ${esc(nomType(tete.type))} (${sansZero(heureDe(tete.debut))})</small>` : `Noter <small>${contexte.debut ? `à ${sansZero(heureDe(contexte.debut))}` : heureMaintenant()}</small>`}</h2>
    ${frequents.length ? `<p class="titre-choix">Les plus utilisés</p><div class="choix frequents">${frequents.map((t) => `<button class="puce type-puce" style="--c:${famille(t.famille).couleur}" data-type="${t.id}"><span class="emoji">${esc(t.icone)}</span>${esc(t.nom)}</button>`).join('')}</div>` : ''}
    <div class="onglets" role="tablist">${FAMILLES.map((f) => `<button class="${f.id === familleSaisie ? 'choisi' : ''}" style="--c:${f.couleur}" data-famille="${f.id}">${f.nom}</button>`).join('')}</div>
    <div class="saisie-corps" data-grille></div>
  </div>`, null, 'fixe');
  const fen = couche.querySelector('.fenetre');
  const grille = fen.querySelector('[data-grille]');
  const remplir = () => {
    grille.innerHTML = `<p class="aide">${famille(familleSaisie).aide}</p>
      <div class="grille-types">${S.typesVisibles(familleSaisie).map((t) => `<button class="btn-type" style="--c:${famille(t.famille).couleur}" data-type="${t.id}"><span class="emoji">${esc(t.icone)}</span>${esc(t.nom)}</button>`).join('')}
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
  if (contexte.debut) base.debut = contexte.debut;
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
  // Depuis le planning : la note se pose à l'heure touchée, la durée se tire ensuite.
  if (contexte.debut && !(s.intensite && t.echelle)) return enregistre(base, `${t.nom} noté à ${sansZero(heureDe(base.debut))}`);
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
      enregistre({ ...base, intensite: v }, `${t.nom}${v != null ? ` ${v}` : ''} noté à ${sansZero(heureDe(base.debut || horodatage()))}`);
    });
    return;
  }
  enregistre(base, `${t.nom} noté à ${sansZero(heureDe(base.debut || horodatage()))}`);
}

/**
 * Endormissement, d'après le journal de sommeil de consensus : l'heure où l'on essaie de dormir,
 * puis le temps estimé pour s'endormir. La zone en dégradé va de l'une à l'autre (30 min au moins).
 */
function etapeEndormissement(t, base) {
  const maint = horodatage();
  const hh = new Date().getHours();
  let defaut = hh >= 20 || hh < 4 ? heureDe(maint) : '23:00';
  let dateDefaut = hh < 12 && defaut === '23:00' ? ajouterJours(aujourdhui(), -1) : aujourdhui();
  if (base.debut) { defaut = heureDe(base.debut); dateDefaut = base.debut.slice(0, 10); }
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

function enregistre(champs, message, jour = jourDe(champs.debut || horodatage(), DEBUT_JOURNEE)) {
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
    <div class="actions-sec actions-fiche">
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
    if (!confirmerDeux(ev.currentTarget, 'Confirmer ?')) return;
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
      <h3>Code <small>${r.code ? (S.estChiffre() ? 'activé · données chiffrées' : 'activé') : 'aucun'}</small></h3>
      <p class="aide">6 chiffres, demandés à l'ouverture et après 5 min en arrière-plan. Le code chiffre tes données sur cet appareil et le fichier d'export : sans lui, rien ne se relit. Code oublié : seule issue, tout effacer puis restaurer un export.</p>
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
    <p class="pied">Logger v2.0.4 · les données restent sur cet appareil</p>`;
  app.querySelector('[data-f="import"]').addEventListener('change', (ev) => importer(ev.target.files[0]));
}

function vueTypes() {
  const us = S.usages('type');
  app.innerHTML = `
    ${bandeau({ retour: '#/reglages', petit: 'Réglages', titre: 'Types de notes' })}
    <p class="aide" style="margin:0 4px 10px">Toucher l'icône pour la changer. Un type masqué disparaît de la saisie, pas de l'historique. Les noms se modifient directement. Le chiffre = nombre de notes.</p>
    ${FAMILLES.map((f) => `<div class="carte" style="--c:${f.couleur}">
      <h3><span><i class="pastille-mini"></i>${f.nom}</span><small>${f.aide}</small></h3>
      ${S.get().types.filter((t) => t.famille === f.id).map((t) => `<div class="ligne-etq">
        <button class="pl-entete choix-icone" data-icone="${t.id}" aria-label="Changer l'icône">${esc(t.icone || '•')}</button>
        <input data-renommer="${t.id}" value="${esc(t.nom)}" autocomplete="off" aria-label="Nom">
        <small class="usage">${us.get(t.id) || 0}</small>
        <label class="interrupteur mini" aria-label="Afficher dans la saisie"><input type="checkbox" data-visible="${t.id}" ${t.visible ? 'checked' : ''}><i></i></label>
      </div>`).join('')}
      <button class="lien" data-f="ajouter" data-fam="${f.id}" style="align-self:flex-start">${I.plus} Ajouter un type</button>
    </div>`).join('')}`;
  app.querySelectorAll('[data-renommer]').forEach((i) => i.addEventListener('change', () => { const v = majuscule(i.value); if (v) { S.type(i.dataset.renommer).nom = v; S.enregistrer(); toast('Renommé'); } }));
  app.querySelectorAll('[data-icone]').forEach((b) => b.addEventListener('click', () => fenetreIcone(S.type(b.dataset.icone), vueTypes)));
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

/** Premier caractère visible d'un texte (un emoji composé compte pour un). */
function premierSymbole(texte) {
  const s = String(texte || '').trim();
  if (!s) return '';
  if (window.Intl?.Segmenter) return [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)][0].segment;
  return [...s][0];
}

function fenetreIcone(t, apres) {
  ouvrirFenetre(`<form class="saisie" style="--c:${famille(t.famille).couleur}">
    <h2><span class="emoji">${esc(t.icone)}</span>${esc(t.nom)} <small>icône</small></h2>
    <label class="champ"><span>N'importe quel emoji du clavier (la recherche du clavier marche)</span><input name="icone" value="${esc(t.icone)}" autocomplete="off" inputmode="text" maxlength="16"></label>
    <div class="saisie-corps">
      ${SUGGESTIONS.map(([nom, liste]) => `<p class="titre-choix">${nom}</p><div class="grille-emojis">${liste.split(' ').map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>`).join('')}
      <button class="btn btn-principal btn-large">Enregistrer</button>
    </div>
  </form>`, (fd) => {
    const e = premierSymbole(fd.get('icone'));
    if (!e) return toast('Choisis une icône');
    t.icone = e;
    S.enregistrer();
    fermer();
    toast(`Icône de « ${t.nom} » changée`);
    apres?.();
  }, 'fixe');
  const f = couche.querySelector('form');
  f.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-e]');
    if (!b) return;
    f.icone.value = b.dataset.e;
    f.querySelectorAll('[data-e]').forEach((x) => x.classList.toggle('choisi', x === b));
  });
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
      ['Planning', 'Toucher les points le déploie : une colonne par type (son icône en tête). Les colonnes ne changent jamais de place toutes seules : un nouveau type s\'ajoute à la fin, et un appui long sur une icône du haut permet de ranger sa colonne ailleurs. Les heures restent fixes à gauche, les colonnes défilent de côté. « Voir les 24 h » et la hauteur s\'y règlent.'],
      ['Gestes du planning', 'Toucher une pastille : sa fiche. Appui long : la déplacer (l\'heure s\'affiche au-dessus du doigt). Appui long sur la petite poignée sous la pastille, puis tirer : la durée ; remonter jusqu\'à la pastille l\'annule. L\'heure de fin s\'écrit au bas de la barre quand elle est assez longue. Toucher un vide d\'une colonne : noter ce type à cette heure ; la dernière colonne (+) laisse choisir le type.'],
      ['Icônes', 'Chaque type a un emoji, modifiable dans Réglages → Types (suggestions ou n\'importe quel emoji du clavier).'],
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
      ['Code à 6 chiffres', 'Verrouille l\'appli, chiffre les données sur cet appareil et le fichier d\'export. Code oublié : tout effacer, puis restaurer un export. Après 5 erreurs, une courte attente.'],
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
  S.restaurerCopie().then((ok) => { route(); toast(ok ? 'Import annulé' : 'Copie illisible'); });
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
    aide.textContent = 'Chiffrement de tes données…';
    const sel = Math.random().toString(36).slice(2, 10);
    S.reglages().code = { sel, empreinte: await V.empreinte(code, sel), longueur: V.LONGUEUR };
    await S.chiffrerAvec(code, V.LONGUEUR);
    fermer(); route();
    toast("Code enregistré : tes données sont chiffrées avec. Un export fait avant garde l'ancien code.");
  });
}

let enArrierePlan = null;

let essaisRates = 0, pauseJusqua = 0, pauseDuree = 30;

/** Écran du code. Données chiffrées : le code ouvre le coffre (ou le vérifie après une absence). */
function verrouiller() {
  const chiffre = S.estChiffre();
  const code = S.reglages().code;
  if (!chiffre && !code) return false;
  fermer(false);
  panneau.hidden = true;
  barre.hidden = true;
  app.innerHTML = '';
  verrouEl.innerHTML = '<img src="icons/icon-192.png" alt=""><h2>Logger</h2><p class="aide-verrou" data-aide></p><div data-pave></div><button class="lien" data-f="oubli">Code oublié ?</button>';
  verrouEl.hidden = false;
  const aide = verrouEl.querySelector('[data-aide]');
  V.pave(verrouEl.querySelector('[data-pave]'), async (saisi, recommencer) => {
    if (Date.now() < pauseJusqua) { aide.textContent = `Trop d'essais : attends ${Math.ceil((pauseJusqua - Date.now()) / 1000)} s.`; return recommencer(true); }
    let bon;
    if (chiffre) {
      aide.textContent = 'Ouverture…';
      bon = S.estOuvert() ? await S.verifierCode(saisi) : await S.ouvrir(saisi);
    } else {
      bon = await V.empreinte(saisi, code.sel) === code.empreinte;
    }
    if (!bon) {
      essaisRates++;
      if (essaisRates >= 5) { essaisRates = 0; pauseJusqua = Date.now() + pauseDuree * 1000; aide.textContent = `Trop d'essais : attends ${pauseDuree} s.`; pauseDuree *= 2; } else aide.textContent = '';
      return recommencer(true);
    }
    essaisRates = 0; pauseDuree = 30;
    // Un code créé avant le chiffrement : les données se chiffrent à cette ouverture.
    if (!chiffre) { aide.textContent = 'Chiffrement de tes données…'; await S.chiffrerAvec(saisi, code.longueur || V.LONGUEUR); toast('Tes données sont maintenant chiffrées avec ton code'); }
    verrouEl.hidden = true;
    verrouEl.innerHTML = '';
    route();
  }, chiffre ? S.longueurCoffre() : code.longueur || V.LONGUEUR);
  verrouEl.querySelector('[data-f="oubli"]').addEventListener('click', (ev) => {
    const b = ev.currentTarget;
    if (!b.dataset.arme) {
      b.dataset.arme = '1';
      b.textContent = "Sans le code, rien ne se relit : seule issue, tout effacer sur cet appareil, puis restaurer un export (avec le code de cet export). Toucher encore pour tout effacer.";
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

function confirmerDeux(btn, texte = 'Toucher encore pour confirmer') {
  if (btn.dataset.confirme) return true;
  btn.dataset.confirme = '1';
  const t = btn.textContent;
  btn.textContent = texte;
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
    case 'noter-ici': return vueNoter();
    case 'legende': legendeOuverte = !legendeOuverte; return vueJour();
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
    case 'supprimer-code': if (confirmerDeux(el, 'Les données ne seront plus chiffrées. Confirmer ?')) { delete S.reglages().code; S.dechiffrerTout().then(() => { route(); toast('Code supprimé : les données ne sont plus chiffrées'); }); } return;
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
