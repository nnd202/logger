// État de l'appli, gardé en JSON dans le stockage local du navigateur.
import { uid, aujourdhui } from './calc.js';

const CLE = 'logger-etat';
const CLE_COPIE = 'logger-copie';

export const COULEURS = ['#c2416b', '#e0794f', '#c9a35e', '#83aa72', '#4fa8a0', '#5fa3c4', '#6f8fd0', '#9a88c8', '#b58fb8', '#8f9db0'];

let etat = charger();

function vierge() {
  return { version: 1, calendriers: [], saisies: [], liens: [], reglages: {} };
}

function normaliser(e) {
  const v = { ...vierge(), ...(e || {}) };
  v.calendriers = (v.calendriers || []).map(normaliserCal);
  v.saisies = v.saisies || [];
  v.liens = v.liens || [];
  v.reglages = v.reglages || {};
  return v;
}

function normaliserCal(c) {
  return { saisie: 'les-deux', echelle: null, etiquettes: [], note: true, loupes: [], couleur: COULEURS[0], ...c };
}

function charger() {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return normaliser(JSON.parse(brut));
  } catch { /* stockage indisponible ou illisible */ }
  return vierge();
}

export function enregistrer() {
  try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* plein ou bloqué */ }
}

export const get = () => etat;
export const calendriers = () => etat.calendriers;
export const calendrier = (id) => etat.calendriers.find((c) => c.id === id) || null;
export const saisie = (id) => etat.saisies.find((s) => s.id === id) || null;

/** Saisies d'un calendrier, triées par date puis heure (la journée avant les heures). */
export function saisiesDe(calId) {
  return etat.saisies
    .filter((s) => s.cal === calId)
    .sort((a, b) => (a.date + (a.heure || '')).localeCompare(b.date + (b.heure || '')));
}

export function saisiesDuJour(calId, date) {
  return saisiesDe(calId).filter((s) => s.date === date);
}

// --- Calendriers -------------------------------------------------------------------

export function couleurLibre() {
  const prises = new Set(etat.calendriers.map((c) => c.couleur));
  return COULEURS.find((c) => !prises.has(c)) || COULEURS[etat.calendriers.length % COULEURS.length];
}

export function creerCalendrier(nom) {
  const c = normaliserCal({ id: uid('c'), nom, debut: aujourdhui(), cree: Date.now(), couleur: couleurLibre() });
  etat.calendriers.push(c);
  enregistrer();
  return c;
}

export function supprimerCalendrier(id) {
  etat.calendriers = etat.calendriers.filter((c) => c.id !== id);
  etat.saisies = etat.saisies.filter((s) => s.cal !== id);
  etat.liens = etat.liens.filter((l) => l.a !== id && l.b !== id);
  enregistrer();
}

export function deplacerCalendrier(id, pas) {
  const l = etat.calendriers;
  const i = l.findIndex((c) => c.id === id);
  const j = i + pas;
  if (i < 0 || j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]];
  enregistrer();
}

/** Une saisie ou un jour loupé avant le début du suivi recule ce début. */
function reculerDebut(c, date) {
  if (date < c.debut) c.debut = date;
}

// --- Saisies -----------------------------------------------------------------------

export function ajouterSaisie(c, champs) {
  const s = { id: uid('s'), cal: c.id, date: aujourdhui(), heure: null, valeur: null, etiquettes: [], note: '', cree: Date.now(), ...champs };
  etat.saisies.push(s);
  reculerDebut(c, s.date);
  // Un jour saisi n'est plus « loupé ».
  c.loupes = c.loupes.filter((d) => d !== s.date);
  enregistrer();
  return s;
}

export function modifierSaisie(s, champs) {
  Object.assign(s, champs);
  const c = calendrier(s.cal);
  if (c) { reculerDebut(c, s.date); c.loupes = c.loupes.filter((d) => d !== s.date); }
  enregistrer();
}

export function supprimerSaisie(id) {
  etat.saisies = etat.saisies.filter((s) => s.id !== id);
  enregistrer();
}

export function basculerLoupe(c, date) {
  if (c.loupes.includes(date)) c.loupes = c.loupes.filter((d) => d !== date);
  else { c.loupes = [...c.loupes, date].sort(); reculerDebut(c, date); }
  enregistrer();
}

// --- Liens entre calendriers -------------------------------------------------------

export function lier(a, b) {
  if (a === b || etat.liens.some((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return null;
  const l = { id: uid('l'), a, b };
  etat.liens.push(l);
  enregistrer();
  return l;
}

export function delier(id) {
  etat.liens = etat.liens.filter((l) => l.id !== id);
  enregistrer();
}

export const liensDe = (calId) => etat.liens.filter((l) => l.a === calId || l.b === calId);

// --- Export, import, copie de secours ------------------------------------------------

export function contenuExport() {
  const { code, ...reglages } = etat.reglages; // le code reste sur l'appareil
  void code;
  return JSON.stringify({
    format: 'logger-export', version: 1, application: 'Logger', le: new Date().toISOString(),
    calendriers: etat.calendriers, saisies: etat.saisies, liens: etat.liens, reglages,
  }, null, 1);
}

export function noterExport() {
  etat.reglages.dernierExport = aujourdhui();
  enregistrer();
}

/** Lit un export : renvoie les données ou lève une erreur lisible. */
export function lireExport(texte) {
  let d;
  try { d = JSON.parse(texte); } catch { throw new Error("Ce fichier n'est pas un export Logger"); }
  if (d?.format !== 'logger-export' || !Array.isArray(d.calendriers) || !Array.isArray(d.saisies)) throw new Error("Ce fichier n'est pas un export Logger");
  return d;
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
  if (code) etat.reglages.code = code;
  localStorage.removeItem(CLE_COPIE);
  enregistrer();
}

/** mode : 'ajouter' (calendriers absents seulement) ou 'remplacer'. Renvoie le nombre de calendriers ajoutés. */
export function importer(d, mode) {
  copieDeSecours();
  const code = etat.reglages.code;
  if (mode === 'remplacer') {
    etat = normaliser({ calendriers: d.calendriers, saisies: d.saisies, liens: d.liens || [], reglages: { ...(d.reglages || {}) } });
    if (code) etat.reglages.code = code; else delete etat.reglages.code;
    enregistrer();
    return etat.calendriers.length;
  }
  const presents = new Set(etat.calendriers.map((c) => c.id));
  const nouveaux = d.calendriers.filter((c) => !presents.has(c.id));
  const ids = new Set(nouveaux.map((c) => c.id));
  etat.calendriers.push(...nouveaux.map(normaliserCal));
  etat.saisies.push(...d.saisies.filter((s) => ids.has(s.cal)));
  const tous = new Set(etat.calendriers.map((c) => c.id));
  for (const l of d.liens || []) {
    if ((ids.has(l.a) || ids.has(l.b)) && tous.has(l.a) && tous.has(l.b) && !etat.liens.some((x) => x.id === l.id)) etat.liens.push(l);
  }
  enregistrer();
  return nouveaux.length;
}

export function toutEffacer() {
  etat = vierge();
  enregistrer();
}

// --- Exemple -------------------------------------------------------------------------

export function chargerExemple(exemple) {
  etat.calendriers.push(...exemple.calendriers.map(normaliserCal));
  etat.saisies.push(...exemple.saisies);
  etat.liens.push(...exemple.liens);
  enregistrer();
}

export const aDesExemples = () => etat.calendriers.some((c) => c.exemple);

export function retirerExemples() {
  for (const c of etat.calendriers.filter((x) => x.exemple)) supprimerCalendrier(c.id);
}
