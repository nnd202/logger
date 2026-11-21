// État de Logger v2 : un seul journal de notes, gardé en JSON dans le stockage du navigateur.
import { uid, horodatage, jourDe, minutes } from './calc.js';
import { typesDeDepart, etiquettesDeDepart, DEBUT_JOURNEE, ICONES, ICONE_FAMILLE } from './catalogue.js';
import * as C from './crypto.js';

const CLE = 'logger2-etat'; // état en clair (tant qu'aucun code n'existe)
const CLE_COFFRE = 'logger2-coffre'; // état chiffré avec le code
const CLE_COPIE = 'logger2-copie';

// Coffre : { format, sel, iterations, longueur, iv, donnees }. Tant qu'il n'est pas ouvert, l'état est vide.
let coffre = lireCoffre();
let cleCoffre = null;
let etat = coffre ? vierge() : charger();
let ecritures = Promise.resolve();

function lireCoffre() {
  try { const c = JSON.parse(localStorage.getItem(CLE_COFFRE)); return c?.format === 'logger-coffre' ? c : null; } catch { return null; }
}

export function vierge() {
  return {
    version: 2,
    types: typesDeDepart(),
    notes: [],
    jours: {}, // { 'AAAA-MM-JJ': { calme: true } }
    pauses: [], // [{ id, du, au | null }]
    etiquettes: etiquettesDeDepart(),
    personnes: [], // [{ id, nom }]
    reglages: { echelleHeure: 48, planningOuvert: false },
    colonnes: {}, // { 'AAAA-MM-JJ': [id de type, …] } : ordre des colonnes du planning, fixé par l'utilisateur
  };
}

function normaliser(e) {
  const v = vierge();
  const r = { ...v, ...(e || {}) };
  r.reglages = { ...v.reglages, ...(e?.reglages || {}) };
  if (!r.colonnes || typeof r.colonnes !== 'object') r.colonnes = {};
  // Types ajoutés au catalogue après coup : on les complète sans toucher aux réglages existants.
  const ids = new Set(r.types.map((t) => t.id));
  for (const t of v.types) if (!ids.has(t.id)) r.types.push(t);
  for (const t of r.types) if (!t.icone) t.icone = ICONES[t.id] || ICONE_FAMILLE[t.famille] || '•';
  // v2.0 → v2.0.1 : les blocs deviennent des enchaînements (la plus ancienne note en tête).
  if (Array.isArray(r.blocs)) {
    for (const b of r.blocs) {
      const liste = r.notes.filter((n) => n.bloc === b.id).sort((a, c) => a.debut.localeCompare(c.debut));
      for (const n of liste.slice(1)) n.chaine = liste[0].id;
    }
    delete r.blocs;
  }
  for (const n of r.notes) { delete n.bloc; if (n.chaine === undefined) n.chaine = null; }
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
  if (!coffre) {
    try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* plein ou bloqué */ }
    return;
  }
  if (!cleCoffre) return; // coffre fermé : rien à écrire
  const instantane = JSON.stringify(etat);
  ecrirePlusTard(async () => {
    const s = await C.sceller(cleCoffre, instantane);
    localStorage.setItem(CLE_COFFRE, JSON.stringify({ ...coffre, ...s }));
  });
}

// Les écritures chiffrées sont asynchrones : on les enchaîne pour que la dernière gagne toujours.
function ecrirePlusTard(f) {
  ecritures = ecritures.then(f).catch(() => { /* plein ou bloqué */ });
  return ecritures;
}
export const ecrituresFinies = () => ecritures;

// --- Coffre (données chiffrées avec le code) -------------------------------------------------------

export const estChiffre = () => !!coffre;
export const estOuvert = () => !coffre || !!cleCoffre;
export const longueurCoffre = () => coffre?.longueur || 6;

/** Ouvre le coffre avec le code : charge l'état. Renvoie false si le code ne correspond pas. */
export async function ouvrir(code) {
  if (!coffre) return true;
  try {
    const k = await C.deriver(code, coffre.sel, coffre.iterations);
    const e = await C.desceller(k, coffre);
    etat = normaliser(e);
    cleCoffre = k;
    return true;
  } catch { return false; }
}

/** Vérifie le code sans toucher à l'état en mémoire (verrouillage après une absence). */
export async function verifierCode(code) {
  if (!coffre) return false;
  try { await C.desceller(await C.deriver(code, coffre.sel, coffre.iterations), coffre); return true; } catch { return false; }
}

/** Chiffre les données (et la copie de secours) avec ce code ; sert aussi à changer de code. */
export async function chiffrerAvec(code, longueur = 6) {
  await ecritures;
  const copie = await lireCopie();
  const sel = C.nouveauSel();
  const k = await C.deriver(code, sel);
  coffre = { format: 'logger-coffre', version: 1, kdf: 'PBKDF2-SHA-256', iterations: C.ITERATIONS, sel, longueur };
  cleCoffre = k;
  const s = await C.sceller(k, etat);
  localStorage.setItem(CLE_COFFRE, JSON.stringify({ ...coffre, ...s }));
  localStorage.removeItem(CLE);
  if (copie) await ecrireCopie(copie);
}

/** Retire le chiffrement : les données repassent en clair sur l'appareil. */
export async function dechiffrerTout() {
  await ecritures;
  const copie = await lireCopie();
  coffre = null;
  cleCoffre = null;
  localStorage.removeItem(CLE_COFFRE);
  enregistrer();
  if (copie) await ecrireCopie(copie);
}

export const get = () => etat;
export const reglages = () => etat.reglages;
export const type = (id) => etat.types.find((t) => t.id === id) || null;
export const typesVisibles = (fam) => etat.types.filter((t) => t.visible && (!fam || t.famille === fam));
export const note = (id) => etat.notes.find((n) => n.id === id) || null;
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
    avecQui: [], personnes: [], etiquettes: [], phrase: '', chaine: null, cree: Date.now(),
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
  // Une tête d'enchaînement supprimée : la suivante devient la tête.
  const suites = suitesDe(id);
  if (suites.length) {
    suites[0].chaine = null;
    for (const s of suites.slice(1)) s.chaine = suites[0].id;
  }
  enregistrer();
  return n;
}

/** Notes enchaînées à une tête, dans l'ordre. */
export const suitesDe = (id) => etat.notes.filter((x) => x.chaine === id).sort(parDebut);

export function detacher(n) {
  n.chaine = null;
  enregistrer();
}

/** Plages commencées un jour précédent et encore en cours ce jour-là (endormissement après minuit). */
export function plagesTraversantes(date) {
  const debutJour = `${date}T${String(DEBUT_JOURNEE).padStart(2, '0')}:00`;
  return etat.notes.filter((n) => n.debut < debutJour && ((n.fin && n.fin > debutJour) || n.enCours)).sort(parDebut);
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
  const t = { id: uid('ty'), famille, nom, visible: true, icone: ICONE_FAMILLE[famille], echelle: ref?.echelle ? { ...ref.echelle, bas: 'à peine', haut: 'très fort' } : null, perso: true };
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

// Copie de secours : { le, etat } en clair, ou { le, iv, donnees } chiffrée avec la clé du coffre.
function ecrireCopie({ le, etat: e }) {
  const texte = typeof e === 'string' ? e : JSON.stringify(e);
  return ecrirePlusTard(async () => {
    const corps = coffre && cleCoffre ? await C.sceller(cleCoffre, texte) : { etat: JSON.parse(texte) };
    localStorage.setItem(CLE_COPIE, JSON.stringify({ le, ...corps }));
  });
}

async function lireCopie() {
  let c;
  try { c = JSON.parse(localStorage.getItem(CLE_COPIE)); } catch { return null; }
  if (!c) return null;
  if (c.etat) return c;
  if (!cleCoffre) return null;
  try { return { le: c.le, etat: await C.desceller(cleCoffre, c) }; } catch { return null; }
}

function copieDeSecours() {
  ecrireCopie({ le: Date.now(), etat: JSON.stringify(etat) });
}

export function copieDisponible() {
  try { return JSON.parse(localStorage.getItem(CLE_COPIE))?.le || null; } catch { return null; }
}

export async function restaurerCopie() {
  await ecritures;
  const c = await lireCopie();
  if (!c) return false;
  const code = etat.reglages.code;
  etat = normaliser(c.etat);
  if (code) etat.reglages.code = code; else delete etat.reglages.code;
  localStorage.removeItem(CLE_COPIE);
  enregistrer();
  return true;
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
    for (const cle of ['types', 'notes', 'pauses', 'etiquettes', 'personnes']) ajoute(cle);
    etat.jours = { ...(d.jours || {}), ...etat.jours };
    etat.colonnes = { ...(d.colonnes || {}), ...etat.colonnes };
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

/** Code oublié : tout est effacé sur l'appareil, coffre et copie compris. */
export function effacerAvecCode() {
  coffre = null;
  cleCoffre = null;
  etat = vierge();
  for (const k of [CLE_COFFRE, CLE_COPIE]) localStorage.removeItem(k);
  enregistrer();
}

// --- Ordre des colonnes du planning ----------------------------------------------------------------

/**
 * Ordre des colonnes d'un jour : celui que l'utilisateur a fixé. Un type qui apparaît s'ajoute à la fin
 * (à la première vue d'un jour, les types sont rangés par heure de leur première note) ; un type qui n'a
 * plus de note ce jour-là sort de la liste. Rien ne bouge tout seul.
 */
export function ordreColonnes(date, notes) {
  const premier = new Map();
  for (const n of [...notes].sort(parDebut)) if (!premier.has(n.type)) premier.set(n.type, n.debut);
  const avant = etat.colonnes[date] || [];
  const garde = avant.filter((t) => premier.has(t));
  const ordre = [...garde, ...[...premier.keys()].filter((t) => !garde.includes(t))];
  if (ordre.join() !== avant.join()) {
    if (ordre.length) etat.colonnes[date] = ordre; else delete etat.colonnes[date];
    enregistrer();
  }
  return ordre;
}

export function ordonnerColonnes(date, ordre) {
  etat.colonnes[date] = ordre;
  enregistrer();
}

// --- Exemple -----------------------------------------------------------------------------------

export function chargerExemple(ex) {
  etat.notes.push(...ex.notes);
  for (const p of ex.personnes) if (!etat.personnes.some((x) => x.id === p.id)) etat.personnes.push(p);
  enregistrer();
}

export const aDesExemples = () => etat.notes.some((n) => n.exemple);

export function retirerExemples() {
  etat.notes = etat.notes.filter((n) => !n.exemple);
  etat.personnes = etat.personnes.filter((p) => !p.exemple);
  enregistrer();
}

/** Pour les tests : remplace l'état en mémoire. */
export function _remplacer(e) { etat = normaliser(e); }

export const _minutes = minutes;
