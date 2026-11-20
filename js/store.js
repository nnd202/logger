// État de Logger v2 : un seul journal de notes, gardé en JSON dans le stockage du navigateur.
import { uid, horodatage, jourDe, minutes } from './calc.js';
import { typesDeDepart, etiquettesDeDepart, FAMILLES, DEBUT_JOURNEE } from './catalogue.js';

const CLE = 'logger2-etat';
const CLE_COPIE = 'logger2-copie';

let etat = charger();

export function vierge() {
  return {
    version: 2,
    types: typesDeDepart(),
    notes: [],
    blocs: [],
    jours: {}, // { 'AAAA-MM-JJ': { calme: true } }
    pauses: [], // [{ id, du, au | null }]
    etiquettes: etiquettesDeDepart(),
    personnes: [], // [{ id, nom }]
    reglages: { ecartEpisode: 45, calques: FAMILLES.map((f) => f.id), echelleHeure: 48 },
  };
}

function normaliser(e) {
  const v = vierge();
  const r = { ...v, ...(e || {}) };
  r.reglages = { ...v.reglages, ...(e?.reglages || {}) };
  // Types ajoutés au catalogue après coup : on les complète sans toucher aux réglages existants.
  const ids = new Set(r.types.map((t) => t.id));
  for (const t of v.types) if (!ids.has(t.id)) r.types.push(t);
  return r;
}

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return normaliser(JSON.parse(brut));
  } catch { /* stockage indisponible */ }
  return vierge();
}

export function enregistrer() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* plein ou bloqué */ }
}

export const get = () => etat;
export const reglages = () => etat.reglages;
export const type = (id) => etat.types.find((t) => t.id === id) || null;
export const typesVisibles = (fam) => etat.types.filter((t) => t.visible && (!fam || t.famille === fam));
export const note = (id) => etat.notes.find((n) => n.id === id) || null;
export const bloc = (id) => etat.blocs.find((b) => b.id === id) || null;
export const etiquette = (id) => etat.etiquettes.find((e) => e.id === id) || null;
export const personne = (id) => etat.personnes.find((p) => p.id === id) || null;

const parDebut = (a, b) => a.debut.localeCompare(b.debut);
export const notesTriees = () => [...etat.notes].sort(parDebut);
export const notesDuJour = (date) => etat.notes.filter((n) => jourDe(n.debut, DEBUT_JOURNEE) === date).sort(parDebut);
export const enCours = () => etat.notes.filter((n) => n.enCours).sort(parDebut);

// --- Notes --------------------------------------------------------------------------

export function ajouterNote(champs) {
  const n = {
    id: uid('n'), type: null, debut: horodatage(), fin: null, enCours: false, precision: 'exacte',
    intensite: null, issue: null, quantite: '', aide: null, motif: null,
    activite: '', plaisir: null, maitrise: null, facettes: [],
    avecQui: [], personnes: [], etiquettes: [], phrase: '', bloc: null, cree: Date.now(),
    ...champs,
  };
  etat.notes.push(n);
  enregistrer();
  return n;
}

export function modifierNote(n, champs) {
  Object.assign(n, champs);
  if (n.fin && n.fin < n.debut) [n.debut, n.fin] = [n.fin, n.debut];
  enregistrer();
}

export function supprimerNote(id) {
  const n = note(id);
  etat.notes = etat.notes.filter((x) => x.id !== id);
  if (n?.bloc) nettoyerBlocs();
  enregistrer();
  return n;
}

export function remettreNote(n) {
  etat.notes.push(n);
  enregistrer();
}

export function arreter(n, fin = horodatage()) {
  n.enCours = false;
  n.fin = fin < n.debut ? n.debut : fin;
  enregistrer();
}

/** « Encore » : la dernière note répétée maintenant (même type, intensité, étiquettes, entourage). */
export function derniere() {
  return [...etat.notes].sort((a, b) => b.cree - a.cree)[0] || null;
}

export function encore() {
  const d = derniere();
  if (!d) return null;
  const { type: ty, intensite, etiquettes, avecQui, personnes } = d;
  return ajouterNote({ type: ty, intensite, etiquettes: [...etiquettes], avecQui: [...avecQui], personnes: [...personnes] });
}

// --- Blocs : regroupements faits à la main ------------------------------------------------

export function creerBloc(ids, nom = '') {
  const b = { id: uid('b'), nom };
  etat.blocs.push(b);
  for (const n of etat.notes) if (ids.includes(n.id)) n.bloc = b.id;
  nettoyerBlocs();
  enregistrer();
  return b;
}

export function definirMembres(blocId, ids) {
  for (const n of etat.notes) {
    if (ids.includes(n.id)) n.bloc = blocId;
    else if (n.bloc === blocId) n.bloc = null;
  }
  nettoyerBlocs();
  enregistrer();
}

export function defaireBloc(blocId) {
  for (const n of etat.notes) if (n.bloc === blocId) n.bloc = null;
  etat.blocs = etat.blocs.filter((b) => b.id !== blocId);
  enregistrer();
}

/** Un bloc vide disparaît. */
function nettoyerBlocs() {
  const utilises = new Set(etat.notes.map((n) => n.bloc).filter(Boolean));
  etat.blocs = etat.blocs.filter((b) => utilises.has(b.id));
}

// --- Jours renseignés et pauses ------------------------------------------------------------

export function enPause(date) {
  return etat.pauses.find((p) => p.du <= date && (!p.au || date <= p.au)) || null;
}

/** Renseigné : au moins une note, ou « journée calme ». */
export function statutJour(date) {
  if (notesDuJour(date).length) return 'renseigne';
  if (etat.jours[date]?.calme) return 'calme';
  if (enPause(date)) return 'pause';
  return 'vide';
}

export function basculerCalme(date) {
  if (etat.jours[date]?.calme) delete etat.jours[date];
  else etat.jours[date] = { calme: true };
  enregistrer();
}

export function commencerPause(du) {
  etat.pauses.push({ id: uid('p'), du, au: null });
  enregistrer();
}

export function finirPause(p, au) {
  p.au = au < p.du ? p.du : au;
  enregistrer();
}

export function supprimerPause(id) {
  etat.pauses = etat.pauses.filter((p) => p.id !== id);
  enregistrer();
}

// --- Bibliothèques : types, étiquettes, personnes ------------------------------------------------

export function ajouterType(famille, nom) {
  const ref = etat.types.find((t) => t.famille === famille);
  const t = { id: uid('ty'), famille, nom, visible: true, echelle: ref?.echelle ? { ...ref.echelle, bas: 'à peine', haut: 'très fort' } : null, perso: true };
  etat.types.push(t);
  enregistrer();
  return t;
}

export function ajouterEtiquette(nom) {
  const deja = etat.etiquettes.find((e) => e.nom.toLowerCase() === nom.toLowerCase());
  if (deja) { deja.archive = false; enregistrer(); return deja; }
  const e = { id: uid('t'), nom, archive: false };
  etat.etiquettes.push(e);
  enregistrer();
  return e;
}

/** Fusionne l'étiquette « de » dans « vers » : les notes suivent, « de » disparaît. */
export function fusionnerEtiquettes(de, vers) {
  for (const n of etat.notes) {
    if (n.etiquettes.includes(de)) n.etiquettes = [...new Set(n.etiquettes.map((x) => (x === de ? vers : x)))];
  }
  etat.etiquettes = etat.etiquettes.filter((e) => e.id !== de);
  enregistrer();
}

export function ajouterPersonne(nom) {
  const deja = etat.personnes.find((p) => p.nom.toLowerCase() === nom.toLowerCase());
  if (deja) return deja;
  const p = { id: uid('pe'), nom };
  etat.personnes.push(p);
  enregistrer();
  return p;
}

/** Combien de fois chaque étiquette / type a servi (pour trier par usage). */
export function usages(champ) {
  const c = new Map();
  for (const n of etat.notes) {
    const v = n[champ];
    for (const x of Array.isArray(v) ? v : [v]) if (x) c.set(x, (c.get(x) || 0) + 1);
  }
  return c;
}

/** Noms d'activités déjà utilisés, du plus fréquent au moins fréquent. */
export function nomsActivites() {
  const c = new Map();
  for (const n of etat.notes) if (n.activite) c.set(n.activite, (c.get(n.activite) || 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1]).map(([nom]) => nom);
}

// --- Export, import, copie -------------------------------------------------------------------

/** Données à exporter : tout sauf le code de l'appareil. */
export function donneesExport() {
  const { code, ...reglagesSansCode } = etat.reglages;
  void code;
  return { ...etat, reglages: reglagesSansCode };
}

export function noterExport(date) {
  etat.reglages.dernierExport = date;
  enregistrer();
}

function copieDeSecours() {
  try { localStorage.setItem(CLE_COPIE, JSON.stringify({ le: Date.now(), etat })); } catch { /* plein */ }
}

export function copieDisponible() {
  try { return JSON.parse(localStorage.getItem(CLE_COPIE))?.le || null; } catch { return null; }
}

export function restaurerCopie() {
  const c = JSON.parse(localStorage.getItem(CLE_COPIE));
  const code = etat.reglages.code;
  etat = normaliser(c.etat);
  if (code) etat.reglages.code = code; else delete etat.reglages.code;
  localStorage.removeItem(CLE_COPIE);
  enregistrer();
}

/** mode : 'remplacer' (tout) ou 'fusionner' (ajoute ce qui manque, par identifiant). */
export function importer(d, mode) {
  if (d?.version !== 2 || !Array.isArray(d.notes) || !Array.isArray(d.types)) throw new Error("Ce fichier n'est pas un export Logger v2");
  copieDeSecours();
  const code = etat.reglages.code;
  if (mode === 'remplacer') {
    etat = normaliser(d);
  } else {
    const ajoute = (cle) => {
      const ids = new Set(etat[cle].map((x) => x.id));
      etat[cle].push(...(d[cle] || []).filter((x) => !ids.has(x.id)));
    };
    for (const cle of ['types', 'notes', 'blocs', 'pauses', 'etiquettes', 'personnes']) ajoute(cle);
    etat.jours = { ...(d.jours || {}), ...etat.jours };
  }
  if (code) etat.reglages.code = code; else delete etat.reglages.code;
  enregistrer();
}

export function toutEffacer() {
  const code = etat.reglages.code;
  etat = vierge();
  if (code) etat.reglages.code = code;
  enregistrer();
}

export function effacerAvecCode() {
  etat = vierge();
  enregistrer();
}

// --- Exemple -----------------------------------------------------------------------------------

export function chargerExemple(ex) {
  etat.notes.push(...ex.notes);
  etat.blocs.push(...ex.blocs);
  for (const p of ex.personnes) if (!etat.personnes.some((x) => x.id === p.id)) etat.personnes.push(p);
  enregistrer();
}

export const aDesExemples = () => etat.notes.some((n) => n.exemple);

export function retirerExemples() {
  const blocsEx = new Set(etat.notes.filter((n) => n.exemple && n.bloc).map((n) => n.bloc));
  etat.notes = etat.notes.filter((n) => !n.exemple);
  etat.blocs = etat.blocs.filter((b) => !blocsEx.has(b.id));
  etat.personnes = etat.personnes.filter((p) => !p.exemple);
  enregistrer();
}

/** Pour les tests : remplace l'état en mémoire. */
export function _remplacer(e) { etat = normaliser(e); }

export const _minutes = minutes;
