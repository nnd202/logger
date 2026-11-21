// État de Logger v2 : un seul journal de notes, gardé en JSON dans le stockage du navigateur.
import { uid, horodatage, jourDe, minutes, ajouterJours, ajouterMinutes } from './calc.js';
import { typesDeDepart, etiquettesDeDepart, DEBUT_JOURNEE, ICONES, ICONE_FAMILLE, ECHELLE_COPING } from './catalogue.js';
import * as C from './crypto.js';
import { ouvrirStockage } from './stockage.js';

const CLE = 'logger2-etat'; // état en clair (tant qu'aucun code n'existe)
const CLE_COFFRE = 'logger2-coffre'; // état chiffré avec le code
const CLE_COPIE = 'logger2-copie';

// Coffre : { format, sel, iterations, longueur, iv, donnees }. Tant qu'il n'est pas ouvert, l'état est vide.
// Les données sont lues une fois au démarrage (demarrer) et gardées en mémoire ; chaque écriture part
// ensuite vers le stockage de l'appareil, dans l'ordre.
const cache = new Map();
let support = null;
let coffre = null;
let cleCoffre = null;
let etat = vierge();
let ecritures = Promise.resolve();

export async function demarrer(choisi) {
  support = choisi || await ouvrirStockage();
  for (const k of [CLE, CLE_COFFRE, CLE_COPIE]) cache.set(k, await support.lire(k));
  coffre = lireCoffre();
  cleCoffre = null;
  etat = coffre ? vierge() : charger();
  return support;
}
export const stockage = () => support?.sorte || null;
export const stockageProtege = () => !!support?.persistant;

const lire = (k) => cache.get(k) ?? null;
/** Dans la file d'écriture : met à jour la mémoire et l'appareil (v = null pour effacer). */
async function persister(k, v) {
  cache.set(k, v);
  if (v == null) await support.effacer(k); else await support.ecrire(k, v);
}
const poser = (k, v) => ecrirePlusTard(() => persister(k, v));
// Une écriture refusée (stockage plein) ne doit jamais passer inaperçue.
let alerte = () => {};
export const surErreurEcriture = (f) => { alerte = f; };

function lireCoffre() {
  try { const c = JSON.parse(lire(CLE_COFFRE)); return c?.format === 'logger-coffre' ? c : null; } catch { return null; }
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
    reglages: { echelleHeure: 48, planningOuvert: true, rythme: rythmeDeDepart() },
    questionnaires: [], // [{ id, q, le, reponses, score }]
    colonnes: {}, // { 'AAAA-MM-JJ': [id de type, …] } : ordre des colonnes du planning, fixé par l'utilisateur
  };
}

function normaliser(e) {
  const v = vierge();
  const r = { ...v, ...(e || {}) };
  r.reglages = { ...v.reglages, ...(e?.reglages || {}) };
  if (!r.colonnes || typeof r.colonnes !== 'object') r.colonnes = {};
  if (!Array.isArray(r.questionnaires)) r.questionnaires = [];
  if (!r.reglages.rythme?.types?.length) r.reglages.rythme = rythmeDeDepart();
  // Types ajoutés au catalogue après coup : on les complète sans toucher aux réglages existants.
  const ids = new Set(r.types.map((t) => t.id));
  for (const t of v.types) if (!ids.has(t.id)) r.types.push(t);
  for (const t of r.types) if (!t.icone) t.icone = ICONES[t.id] || ICONE_FAMILLE[t.famille] || '•';
  // v2.0.5 : le coping a lui aussi son intensité.
  for (const t of r.types) if (t.famille === 'coping' && !t.echelle) t.echelle = { ...ECHELLE_COPING };
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
    const brut = lire(CLE);
    if (brut) return normaliser(JSON.parse(brut));
  } catch { /* stockage indisponible */ }
  return vierge();
}

export function enregistrer() {
  if (!coffre) {
    poser(CLE, JSON.stringify(etat));
    return;
  }
  if (!cleCoffre) return; // coffre fermé : rien à écrire
  const instantane = JSON.stringify(etat);
  ecrirePlusTard(async () => {
    const s = await C.sceller(cleCoffre, instantane);
    await persister(CLE_COFFRE, JSON.stringify({ ...coffre, ...s }));
  });
}

// Les écritures chiffrées sont asynchrones : on les enchaîne pour que la dernière gagne toujours.
function ecrirePlusTard(f) {
  ecritures = ecritures.then(f).catch(() => alerte());
  return ecritures;
}
export async function ecrituresFinies() {
  let p;
  do { p = ecritures; await p; } while (p !== ecritures);
}

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
  await ecrituresFinies();
  const copie = await lireCopie();
  const sel = C.nouveauSel();
  const k = await C.deriver(code, sel);
  coffre = { format: 'logger-coffre', version: 1, kdf: 'PBKDF2-SHA-256', iterations: C.ITERATIONS, sel, longueur };
  cleCoffre = k;
  const s = await C.sceller(k, etat);
  await poser(CLE_COFFRE, JSON.stringify({ ...coffre, ...s }));
  await poser(CLE, null);
  if (copie) await ecrireCopie(copie);
  await ecrituresFinies();
}

/** Retire le chiffrement : les données repassent en clair sur l'appareil. */
export async function dechiffrerTout() {
  await ecrituresFinies();
  const copie = await lireCopie();
  coffre = null;
  cleCoffre = null;
  poser(CLE_COFFRE, null);
  enregistrer();
  if (copie) await ecrireCopie(copie);
  await ecrituresFinies();
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

// --- Envies : cédée ou traversée, déduit ---------------------------------------------------------

/** Une envie et un coping parlent du même sujet : paire du catalogue (e-x / c-x), même nom ou même icône. */
export function memeSujet(envie, coping) {
  if (!envie || !coping) return false;
  if (envie.id.startsWith('e-') && coping.id === `c-${envie.id.slice(2)}`) return true;
  return envie.nom.trim().toLowerCase() === coping.nom.trim().toLowerCase() || (!!envie.icone && envie.icone === coping.icone);
}

/**
 * Issue d'une envie, jamais demandée : « cede » si un coping du même sujet suit, le même jour, avant la
 * prochaine envie du même sujet ; sinon « traversee » une fois la journée finie ; « attente » aujourd'hui.
 */
export function issueEnvie(n, aujourdhui) {
  const t = type(n.type);
  if (t?.famille !== 'envie') return null;
  const jour = jourDe(n.debut, DEBUT_JOURNEE);
  const duJour = notesDuJour(jour).filter((x) => x.debut >= n.debut && x.id !== n.id);
  const prochaine = duJour.find((x) => x.type === n.type && x.debut > n.debut);
  const coping = duJour.find((x) => type(x.type)?.famille === 'coping' && memeSujet(t, type(x.type)) && (!prochaine || x.debut < prochaine.debut));
  if (coping) return { issue: 'cede', coping };
  return { issue: jour < aujourdhui ? 'traversee' : 'attente' };
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

/** Renseigné : au moins une note, un débrief, un bilan, ou « journée calme ». */
export function statutJour(date) {
  if (notesDuJour(date).length || etat.jours[date]?.nuit || etat.jours[date]?.bilan) return 'renseigne';
  if (etat.jours[date]?.calme) return 'calme';
  if (enPause(date)) return 'pause';
  return 'vide';
}

export function basculerCalme(date) {
  if (etat.jours[date]?.calme) delete jour(date).calme;
  else jour(date).calme = true;
  nettoyerJour(date);
  enregistrer();
}

// --- Jours : type, nuit, bilan -----------------------------------------------------------------------

const jour = (d) => (etat.jours[d] ||= {});
function nettoyerJour(d) { if (etat.jours[d] && !Object.keys(etat.jours[d]).length) delete etat.jours[d]; }

/** Types de jour et heures visées. coucher / lever : la nuit qui mène à un jour de ce type. semaine[0] = dimanche. */
export function rythmeDeDepart() {
  const t = (id, nom, icone) => ({ id, nom, icone, coucher: null, lever: null });
  return {
    types: [t('travail', 'Travail', '💼'), t('teletravail', 'Télétravail', '🏠'), t('conge', 'Congé', '🌴'), t('weekend', 'Week-end', '🌿')],
    semaine: ['weekend', 'travail', 'travail', 'travail', 'travail', 'travail', 'weekend'],
  };
}
export const rythme = () => etat.reglages.rythme;
const typeParId = (id) => etat.reglages.rythme.types.find((t) => t.id === id);
const typeDeLaSemaine = (date) => typeParId(etat.reglages.rythme.semaine[new Date(`${date}T12:00`).getDay()]) || etat.reglages.rythme.types[0];

/** Type d'un jour : celui choisi pour ce jour, sinon celui de la semaine type. */
export const typeJour = (date) => typeParId(etat.jours[date]?.typeJour) || typeDeLaSemaine(date);
export const typeJourChoisi = (date) => !!typeParId(etat.jours[date]?.typeJour);

export function fixerTypeJour(date, id) {
  if (!id || id === typeDeLaSemaine(date).id) delete jour(date).typeJour; else jour(date).typeJour = id;
  nettoyerJour(date);
  enregistrer();
}

export function ajouterTypeJour(nom, icone = '📅') {
  const t = { id: uid('tj'), nom, icone, coucher: null, lever: null };
  etat.reglages.rythme.types.push(t);
  enregistrer();
  return t;
}

export function supprimerTypeJour(id) {
  const r = etat.reglages.rythme;
  if (r.types.length <= 1 || r.semaine.includes(id)) return false;
  r.types = r.types.filter((t) => t.id !== id);
  for (const [d, j] of Object.entries(etat.jours)) if (j.typeJour === id) { delete j.typeJour; nettoyerJour(d); }
  enregistrer();
  return true;
}

export const nuit = (d) => etat.jours[d]?.nuit || null;
export const bilan = (d) => etat.jours[d]?.bilan || null;

export function enregistrerNuit(d, n) {
  jour(d).nuit = { ...n, le: horodatage() };
  enregistrer();
}
export function enregistrerBilan(d, b) {
  jour(d).bilan = { ...b, le: horodatage() };
  enregistrer();
}
export function effacerNuit(d) { delete jour(d).nuit; nettoyerJour(d); enregistrer(); }
export function effacerBilan(d) { delete jour(d).bilan; nettoyerJour(d); enregistrer(); }

/** Une carte (débrief, bilan) fermée sans être remplie : elle ne revient pas ce jour-là. */
export const carteFermee = (d, quoi) => !!etat.jours[d]?.fermes?.[quoi];
export function fermerCarte(d, quoi) {
  jour(d).fermes = { ...(jour(d).fermes || {}), [quoi]: true };
  enregistrer();
}

/** Endormissement de la nuit qui mène au jour d (noté entre la veille midi et ce jour midi). */
export function endormissementAvant(d) {
  const a = `${ajouterJours(d, -1)}T12:00`, b = `${d}T12:00`;
  return etat.notes.filter((n) => type(n.type)?.endormissement && n.debut >= a && n.debut < b).sort(parDebut)[0] || null;
}

/** Réveils notés avec une heure pendant la nuit qui mène au jour d. */
export function reveilsNotes(d) {
  const e = endormissementAvant(d);
  const a = e ? e.debut : `${ajouterJours(d, -1)}T20:00`, b = `${d}T12:00`;
  return etat.notes.filter((n) => n.type === 'reveil' && n.debut > a && n.debut < b);
}

/** Heures visées pour la nuit qui mène au jour d, selon le type de ce jour. */
export function nuitVisee(d) {
  const t = typeJour(d);
  if (!t.coucher || !t.lever) return null;
  return { coucher: t.coucher >= '12:00' ? `${ajouterJours(d, -1)}T${t.coucher}` : `${d}T${t.coucher}`, lever: `${d}T${t.lever}` };
}

/** Temps passé éveillé pendant la nuit, en minutes, pour chaque choix du débrief. */
export const EVEILLE = [
  { min: 10, nom: 'Moins de 15 min' },
  { min: 22, nom: '15 à 30 min' },
  { min: 45, nom: '30 min à 1 h' },
  { min: 80, nom: "Plus d'1 h" },
];

/**
 * La nuit qui mène au jour d : endormi (essai + temps pour s'endormir) → réveil final (débrief).
 * À défaut, les heures visées complètent ; fin = null si le réveil est inconnu. null si on ne sait rien.
 */
export function nuitDe(d) {
  const e = endormissementAvant(d);
  const v = nuitVisee(d);
  const n = nuit(d);
  const debut = e ? ajouterMinutes(e.debut, e.latence ?? 0) : v?.coucher || null;
  let fin = n?.reveil ? `${d}T${n.reveil}` : v?.lever || null;
  if (!debut) return null;
  if (fin && fin <= debut) fin = null;
  const sommeil = fin ? minutes(fin) - minutes(debut) - (n?.eveille || 0) : null;
  return { debut, fin, debutReel: !!e, finReelle: !!n?.reveil, sommeil, reveils: n?.reveils ?? null, qualite: n?.qualite ?? null };
}

// --- Questionnaires --------------------------------------------------------------------------------

export const passages = (q) => etat.questionnaires.filter((x) => !q || x.q === q).sort((a, b) => a.le.localeCompare(b.le));
export function enregistrerPassage(q, reponses, score) {
  const p = { id: uid('q'), q, le: horodatage(), reponses, score };
  etat.questionnaires.push(p);
  enregistrer();
  return p;
}
export function supprimerPassage(id) {
  etat.questionnaires = etat.questionnaires.filter((x) => x.id !== id);
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
    await persister(CLE_COPIE, JSON.stringify({ le, ...corps }));
  });
}

async function lireCopie() {
  let c;
  try { c = JSON.parse(lire(CLE_COPIE)); } catch { return null; }
  if (!c) return null;
  if (c.etat) return c;
  if (!cleCoffre) return null;
  try { return { le: c.le, etat: await C.desceller(cleCoffre, c) }; } catch { return null; }
}

function copieDeSecours() {
  ecrireCopie({ le: Date.now(), etat: JSON.stringify(etat) });
}

export function copieDisponible() {
  try { return JSON.parse(lire(CLE_COPIE))?.le || null; } catch { return null; }
}

export async function restaurerCopie() {
  await ecrituresFinies();
  const c = await lireCopie();
  if (!c) return false;
  const code = etat.reglages.code;
  etat = normaliser(c.etat);
  if (code) etat.reglages.code = code; else delete etat.reglages.code;
  poser(CLE_COPIE, null);
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
    for (const cle of ['types', 'notes', 'pauses', 'etiquettes', 'personnes', 'questionnaires']) ajoute(cle);
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
  for (const k of [CLE_COFFRE, CLE_COPIE]) poser(k, null);
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
