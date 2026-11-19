// Analyses : uniquement des faits comptés, avec un repère « d'habitude » pour juger.
// Aucun modèle caché : chaque chiffre affiché se recompte à la main.
import { ajouterJours, ecartJours, jourSemaine, minutesDe } from './calc.js';

export const PERIODES = [
  { id: '7', nom: '7 j', jours: 7 },
  { id: '30', nom: '30 j', jours: 30 },
  { id: '90', nom: '3 mois', jours: 91 },
  { id: '365', nom: '1 an', jours: 365 },
  { id: 'tout', nom: 'Tout' },
  { id: 'dates', nom: 'Dates…' },
];

/** Bornes de la période, jamais avant le début du suivi ni après aujourd'hui. */
export function bornes(debut, periode, auj) {
  let du = debut, au = auj;
  const p = PERIODES.find((x) => x.id === periode.id);
  if (p?.jours) du = ajouterJours(auj, -(p.jours - 1));
  if (periode.id === 'dates') { du = periode.du || debut; au = periode.au || auj; }
  if (du < debut) du = debut;
  if (au > auj) au = auj;
  return { du, au, vide: du > au };
}

export function listeJours(du, au) {
  const l = [];
  for (let d = du; d <= au; d = ajouterJours(d, 1)) l.push(d);
  return l;
}

const moyenne = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
function quantile(l, q) {
  if (!l.length) return null;
  const t = [...l].sort((a, b) => a - b);
  const p = (t.length - 1) * q, i = Math.floor(p);
  return t[i] + (t[Math.min(i + 1, t.length - 1)] - t[i]) * (p - i);
}

/** Écart à la proportion attendue (approximation normale de la loi binomiale). */
function z(observes, n, p) {
  if (!n || p <= 0 || p >= 1) return 0;
  return (observes - n * p) / Math.sqrt(n * p * (1 - p));
}

/** Découpage pour les graphiques dans le temps : semaines si la période est courte, sinon mois. */
function decoupage(jours) {
  const parSemaine = jours.length <= 70;
  const groupes = new Map();
  for (const d of jours) {
    const cle = parSemaine ? ajouterJours(d, -jourSemaine(d)) : d.slice(0, 7);
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(d);
  }
  return { parSemaine, groupes };
}

export function analyser(cal, toutes, du, au, auj) {
  const saisies = toutes.filter((s) => s.date >= du && s.date <= au);
  const jours = listeJours(du, au);
  const N = jours.length;
  const parJour = new Map();
  for (const s of saisies) { if (!parJour.has(s.date)) parJour.set(s.date, []); parJour.get(s.date).push(s); }
  const coches = jours.filter((d) => parJour.has(d));
  const loupes = (cal.loupes || []).filter((d) => d >= du && d <= au && !parJour.has(d));
  const taux = N ? coches.length / N : 0;

  // Rythme : écarts entre deux jours cochés, séries.
  const ecarts = coches.slice(1).map((d, i) => ecartJours(coches[i], d));
  let serie = 0, plusLongueSerie = 0, absence = 0, plusLongueAbsence = 0;
  for (const d of jours) {
    if (parJour.has(d)) { serie++; absence = 0; } else { absence++; serie = 0; }
    plusLongueSerie = Math.max(plusLongueSerie, serie);
    plusLongueAbsence = Math.max(plusLongueAbsence, absence);
  }
  const dernier = coches[coches.length - 1] || null;
  const rythme = {
    ecartMoyen: moyenne(ecarts), ecartMedian: quantile(ecarts, 0.5),
    q1: quantile(ecarts, 0.25), q3: quantile(ecarts, 0.75),
    plusLongueSerie, plusLongueAbsence, serieEnCours: au === auj ? serie : null,
    dernier, depuisDernier: dernier ? ecartJours(dernier, auj) : null,
    prochain: null,
  };
  if (ecarts.length >= 4 && dernier) {
    rythme.prochain = {
      date: ajouterJours(dernier, Math.round(rythme.ecartMedian)),
      du: ajouterJours(dernier, Math.round(rythme.q1)),
      au: ajouterJours(dernier, Math.round(rythme.q3)),
    };
  }

  // Jours de la semaine : part des lundis cochés, etc., comparée à la part globale.
  const semaine = Array.from({ length: 7 }, (_, j) => ({ j, jours: 0, coches: 0, saisies: 0 }));
  for (const d of jours) { const j = jourSemaine(d); semaine[j].jours++; if (parJour.has(d)) { semaine[j].coches++; semaine[j].saisies += parJour.get(d).length; } }
  for (const x of semaine) {
    x.taux = x.jours ? x.coches / x.jours : 0;
    x.z = z(x.coches, x.jours, taux);
    x.ressort = x.z >= 1.96 && x.coches >= 3 ? 'plus' : x.z <= -1.96 && x.jours * taux >= 3 ? 'moins' : null;
  }

  // Heures.
  const avecHeure = saisies.filter((s) => s.heure);
  const heures = Array(24).fill(0);
  const grille = Array.from({ length: 7 }, () => Array(24).fill(0));
  let sx = 0, sy = 0;
  for (const s of avecHeure) {
    const m = minutesDe(s.heure), h = Math.floor(m / 60);
    heures[h]++;
    grille[jourSemaine(s.date)][h]++;
    const a = (m / 1440) * 2 * Math.PI;
    sx += Math.cos(a); sy += Math.sin(a);
  }
  const nH = avecHeure.length;
  let heureMoyenne = null, concentration = 0;
  if (nH) {
    concentration = Math.hypot(sx, sy) / nH;
    heureMoyenne = ((Math.atan2(sy, sx) / (2 * Math.PI)) * 1440 + 1440) % 1440;
  }
  const classement = heures.map((n, h) => ({ h, n })).filter((x) => x.n).sort((a, b) => b.n - a.n || a.h - b.h);
  const TRANCHES = [['la nuit', 0, 6], ['le matin', 6, 12], ["l'après-midi", 12, 18], ['le soir', 18, 24]];
  const tranches = TRANCHES.map(([nom, a, b]) => ({ nom, n: heures.slice(a, b).reduce((x, y) => x + y, 0) }));

  // Dans le temps.
  const { parSemaine, groupes } = decoupage(jours);
  const temps = [...groupes].map(([cle, js]) => {
    const ss = js.flatMap((d) => parJour.get(d) || []);
    const vals = ss.map((s) => s.valeur).filter((v) => v != null);
    return { cle, jours: js.length, coches: js.filter((d) => parJour.has(d)).length, saisies: ss.length, moyenne: moyenne(vals) };
  });

  // Tendance : derniers jours comparés aux mêmes nombre de jours juste avant.
  let tendance = null;
  const fen = N >= 60 ? 30 : N >= 14 ? 7 : 0;
  if (fen) {
    const compte = (a, b) => jours.slice(a, b).filter((d) => parJour.has(d)).length;
    tendance = { fenetre: fen, recent: compte(N - fen, N), avant: compte(N - 2 * fen, N - fen) };
  }

  // Échelle.
  let echelle = null;
  if (cal.echelle) {
    const vals = saisies.map((s) => s.valeur).filter((v) => v != null);
    const { min, max } = cal.echelle;
    const distribution = [];
    if (max - min <= 20) for (let v = min; v <= max; v++) distribution.push({ v, n: vals.filter((x) => Math.round(x) === v).length });
    const parJourSemaine = Array.from({ length: 7 }, (_, j) => moyenne(saisies.filter((s) => s.valeur != null && jourSemaine(s.date) === j).map((s) => s.valeur)));
    echelle = { n: vals.length, moyenne: moyenne(vals), mediane: quantile(vals, 0.5), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null, distribution, parJourSemaine };
  }

  // Étiquettes.
  const ids = new Set(cal.etiquettes.map((e) => e.id));
  const etiquettes = cal.etiquettes.map((e) => {
    const avec = saisies.filter((s) => s.etiquettes?.includes(e.id));
    const sans = saisies.filter((s) => !s.etiquettes?.includes(e.id));
    return {
      id: e.id, nom: e.nom, n: avec.length, part: saisies.length ? avec.length / saisies.length : 0,
      moyAvec: moyenne(avec.map((s) => s.valeur).filter((v) => v != null)),
      moySans: moyenne(sans.map((s) => s.valeur).filter((v) => v != null)),
    };
  }).sort((a, b) => b.n - a.n);
  const paires = new Map();
  for (const s of saisies) {
    const t = (s.etiquettes || []).filter((x) => ids.has(x)).sort();
    for (let i = 0; i < t.length; i++) for (let k = i + 1; k < t.length; k++) { const c = `${t[i]}|${t[k]}`; paires.set(c, (paires.get(c) || 0) + 1); }
  }
  const nom = (id) => cal.etiquettes.find((e) => e.id === id)?.nom;
  const combinaisons = [...paires].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, n]) => ({ noms: c.split('|').map(nom), n }));
  const sansEtiquette = saisies.filter((s) => !(s.etiquettes || []).some((x) => ids.has(x))).length;

  return {
    du, au, N, saisies, parJour, coches: coches.length, loupes, taux, nbSaisies: saisies.length,
    parSemaineMoy: N ? saisies.length / (N / 7) : 0,
    rythme, semaine, heures: { n: nH, compte: heures, classement, tranches, heureMoyenne, concentration, grille },
    temps, parSemaine, tendance, echelle, etiquettes, combinaisons, sansEtiquette,
  };
}

// --- Croisements entre deux calendriers ------------------------------------------------

/**
 * Autour de chaque jour où X est coché, regarde si Y l'est aussi : 3 jours avant, la veille,
 * le même jour, le lendemain, dans les 3 jours après. Repère : part des jours (ou des fenêtres
 * de 3 jours) où Y est coché sur toute la période commune.
 */
function autour(DX, DY, jours, du, au) {
  const N = jours.length;
  const fenetre = (d, a, b) => { for (let k = a; k <= b; k++) if (DY.has(ajouterJours(d, k))) return true; return false; };
  const dansPeriode = (d, a, b) => ajouterJours(d, a) >= du && ajouterJours(d, b) <= au;
  const base1 = N ? DY.size / N : 0;
  // Repère des fenêtres de 3 jours : part des jours de la période dont la fenêtre contient Y.
  const base3 = (a, b) => { const ok = jours.filter((d) => dansPeriode(d, a, b)); return ok.length ? ok.filter((d) => fenetre(d, a, b)).length / ok.length : 0; };
  const cas = [
    { id: 'avant3', nom: 'dans les 3 jours avant', a: -3, b: -1, base: base3(-3, -1) },
    { id: 'veille', nom: 'la veille', a: -1, b: -1, base: base1 },
    { id: 'meme', nom: 'le même jour', a: 0, b: 0, base: base1 },
    { id: 'lendemain', nom: 'le lendemain', a: 1, b: 1, base: base1 },
    { id: 'apres3', nom: 'dans les 3 jours après', a: 1, b: 3, base: base3(1, 3) },
  ];
  return cas.map((c) => {
    const js = [...DX].filter((d) => dansPeriode(d, c.a, c.b));
    const n = js.filter((d) => fenetre(d, c.a, c.b)).length;
    const part = js.length ? n / js.length : 0;
    const ratio = c.base ? part / c.base : null;
    const attendu = js.length * c.base;
    const fort = ratio != null && ((ratio >= 1.5 && n >= 3) || (ratio <= 0.67 && attendu >= 3));
    return { ...c, n, sur: js.length, part, ratio, fort, sens: ratio == null ? 0 : ratio > 1 ? 1 : ratio < 1 ? -1 : 0 };
  });
}

export function croiser(A, B, sA, sB, auj) {
  const du = A.debut > B.debut ? A.debut : B.debut;
  const au = auj;
  const jours = du <= au ? listeJours(du, au) : [];
  const dans = (s) => s.date >= du && s.date <= au;
  const a = sA.filter(dans), b = sB.filter(dans);
  const DA = new Set(a.map((s) => s.date)), DB = new Set(b.map((s) => s.date));
  const assez = DA.size >= 3 && DB.size >= 3;
  const res = { du, au, N: jours.length, nA: DA.size, nB: DB.size, assez };
  if (!assez) return res;
  res.autourA = autour(DA, DB, jours, du, au); // autour d'un jour A, présence de B
  res.autourB = autour(DB, DA, jours, du, au);

  // Ordre dans la journée, quand les deux ont une heure le même jour.
  const premiere = (l, d) => l.filter((s) => s.date === d && s.heure).map((s) => minutesDe(s.heure)).sort((x, y) => x - y)[0];
  const ordre = { aAvant: 0, bAvant: 0, ecartsA: [], ecartsB: [] };
  for (const d of DA) {
    if (!DB.has(d)) continue;
    const ha = premiere(a, d), hb = premiere(b, d);
    if (ha == null || hb == null) continue;
    if (ha < hb) { ordre.aAvant++; ordre.ecartsA.push(hb - ha); } else if (hb < ha) { ordre.bAvant++; ordre.ecartsB.push(ha - hb); }
  }
  ordre.ecartA = quantile(ordre.ecartsA, 0.5);
  ordre.ecartB = quantile(ordre.ecartsB, 0.5);
  res.ordre = ordre;

  // Échelle : moyenne les jours où l'autre est coché, et les autres jours.
  const moyEchelle = (cal, l, autre) => {
    if (!cal.echelle) return null;
    const avec = l.filter((s) => s.valeur != null && autre.has(s.date)).map((s) => s.valeur);
    const sans = l.filter((s) => s.valeur != null && !autre.has(s.date)).map((s) => s.valeur);
    return avec.length >= 2 && sans.length >= 2 ? { avec: moyenne(avec), nAvec: avec.length, sans: moyenne(sans), nSans: sans.length } : null;
  };
  res.echelleA = moyEchelle(A, a, DB);
  res.echelleB = moyEchelle(B, b, DA);

  // Dernières fois où les deux se sont suivis de près (même jour ou jour d'écart).
  const proches = [];
  for (const d of [...DA].sort().reverse()) {
    for (const k of [0, -1, 1]) {
      const e = ajouterJours(d, k);
      if (DB.has(e)) { proches.push({ a: d, b: e }); break; }
    }
    if (proches.length >= 5) break;
  }
  res.proches = proches;

  // Le fait le plus marquant, toutes directions confondues.
  const tous = [...res.autourA.map((x) => ({ ...x, centre: 'A' })), ...res.autourB.map((x) => ({ ...x, centre: 'B' }))]
    .filter((x) => x.fort && x.sens > 0 && x.id !== 'avant3' && x.id !== 'apres3');
  res.marquant = tous.sort((x, y) => y.ratio - x.ratio)[0] || null;
  return res;
}
