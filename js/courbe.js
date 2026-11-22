// Courbe des crises. 0 = rien à signaler (pas « tout va bien ») ; au-dessus, une perturbation d'intensité N.
//
// La courbe passe exactement par chaque signal et reste lisse partout, sans angle ni plateau :
// - elle monte en douceur pendant `montee` minutes avant un premier signal ;
// - après un signal, elle commence aussitôt à redescendre, lentement d'abord, et revient à 0 en `retour` minutes ;
// - si un nouveau signal arrive pendant la descente, la remontée part de là où la courbe en était :
//   la valeur de la descente à ce moment devient un point d'appui, puis la courbe rejoint le nouveau signal.
// Le tracé est une interpolation cubique monotone (Fritsch–Carlson) : pas de dépassement, jamais sous 0.

export const COURBE_DEFAUT = { montee: 20, retour: 90 };

/** Réglages complets, y compris d'anciens réglages (maintien + descente). */
export function reglagesCourbe(r = {}) {
  const retour = r.retour ?? (r.maintien != null || r.descente != null ? (r.maintien ?? 30) + (r.descente ?? 60) : COURBE_DEFAUT.retour);
  return { montee: COURBE_DEFAUT.montee, retour };
}

// --- Interpolation cubique monotone ---------------------------------------------------------------

function pentes(xs, ys) {
  const n = xs.length;
  const d = new Array(n).fill(0);
  if (n < 2) return d;
  const del = [];
  for (let k = 0; k < n - 1; k++) del.push((ys[k + 1] - ys[k]) / (xs[k + 1] - xs[k]));
  for (let k = 1; k < n - 1; k++) {
    if (del[k - 1] * del[k] <= 0) d[k] = 0;
    else {
      const w1 = 2 * (xs[k + 1] - xs[k]) + (xs[k] - xs[k - 1]);
      const w2 = (xs[k + 1] - xs[k]) + 2 * (xs[k] - xs[k - 1]);
      d[k] = (w1 + w2) / (w1 / del[k - 1] + w2 / del[k]);
    }
  }
  // Aux extrémités (au repos, à 0) : départ et arrivée à plat, en douceur.
  d[0] = 0;
  d[n - 1] = 0;
  return d;
}

function hermite(xs, ys, d, t) {
  let k = 0;
  while (k < xs.length - 2 && t > xs[k + 1]) k++;
  const h = xs[k + 1] - xs[k];
  const s = (t - xs[k]) / h;
  const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
  return h00 * ys[k] + h10 * h * d[k] + h01 * ys[k + 1] + h11 * h * d[k + 1];
}

/** Valeur d'une descente seule après un signal (sans signal suivant), à dt minutes. */
function descente(v, dt, p) {
  if (dt <= 0) return v;
  if (dt >= p.retour) return 0;
  return hermite([0, p.retour], [v, 0], [0, 0], dt);
}

/**
 * Points d'appui de la courbe, triés : chaque signal, plus les appuis à 0 (avant une montée, après un retour
 * au calme) et, quand un signal arrive pendant une descente, la valeur de la descente au début de la remontée.
 */
export function appuis(liste, p = COURBE_DEFAUT) {
  // Deux signaux à la même minute : le dernier saisi compte.
  const points = [];
  for (const x of [...liste].sort((a, b) => a.m - b.m)) {
    if (points.length && points[points.length - 1].m === x.m) points[points.length - 1] = x; else points.push(x);
  }
  const r = [];
  for (let k = 0; k < points.length; k++) {
    const pt = points[k];
    const prec = points[k - 1];
    if (!prec) r.push({ m: pt.m - p.montee, v: 0 });
    else {
      const ecart = pt.m - prec.m;
      if (ecart > p.retour + p.montee) {
        r.push({ m: prec.m + p.retour, v: 0 }, { m: pt.m - p.montee, v: 0 });
      } else if (ecart > p.montee * 1.5) {
        const m = pt.m - p.montee;
        r.push({ m, v: descente(prec.v, m - prec.m, p) });
      }
    }
    r.push({ m: pt.m, v: pt.v, signal: true });
  }
  if (points.length) r.push({ m: points[points.length - 1].m + p.retour, v: 0 });
  return r;
}

/** Une courbe prête à évaluer : niveau(t). */
export function courbe(points, p = COURBE_DEFAUT) {
  const a = appuis(points, p);
  const xs = a.map((x) => x.m), ys = a.map((x) => x.v);
  const d = pentes(xs, ys);
  return (t) => {
    if (!a.length || t <= xs[0] || t >= xs[xs.length - 1]) return 0;
    return Math.max(0, Math.min(10, hermite(xs, ys, d, t)));
  };
}

export function niveau(t, points, p = COURBE_DEFAUT) {
  return courbe(points, p)(t);
}

/** Valeurs échantillonnées de a à b (minutes), pas en minutes. */
export function echantillons(a, b, points, p = COURBE_DEFAUT, pas = 3) {
  const f = courbe(points, p);
  const r = [];
  for (let t = a; t < b; t += pas) r.push({ m: t, v: f(t) });
  r.push({ m: b, v: f(b) });
  return r;
}

/**
 * Crises : périodes hors du calme. Début = premier signal (> 0) ; dernière trace = dernier signal ;
 * fin = retour à 0, si aucun signal ne relance avant.
 */
export function crises(points, p = COURBE_DEFAUT) {
  const r = [];
  let c = null;
  for (const pt of points) {
    if (!c || pt.m >= c.derniere + p.retour) {
      if (pt.v <= 0) { c = null; continue; }
      c = { debut: pt.m, derniere: pt.m, pic: pt.v, points: [pt] };
      r.push(c);
    } else {
      c.derniere = pt.m;
      c.pic = Math.max(c.pic, pt.v);
      c.points.push(pt);
    }
  }
  for (const x of r) x.fin = x.derniere + p.retour;
  return r;
}
