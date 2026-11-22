// Courbe des crises : un signal plat au repos, qui monte quand on signale une intensité (0–10),
// tient un moment, puis redescend tout seul. Aucune fin n'est jamais déclarée : une nouvelle saisie
// remet la courbe à ce niveau et repousse la descente.
//
// Réglages (minutes) : montee = temps de montée avant un signal (rien ne vient d'un coup) ;
// maintien = le niveau tient après la dernière saisie ; descente = retour progressif au calme.

export const COURBE_DEFAUT = { montee: 15, maintien: 30, descente: 60 };

/** 0 → 1 sans à-coup (ni au départ ni à l'arrivée). */
const doux = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/**
 * Niveau à l'instant t (minutes depuis l'époque, locales). points : [{ m, v }] triés par m.
 */
export function niveau(t, points, p = COURBE_DEFAUT) {
  let i = -1;
  for (let k = 0; k < points.length && points[k].m <= t; k++) i = k;
  const tenu = (k, x) => {
    if (k < 0) return 0;
    const dt = x - points[k].m;
    if (dt <= p.maintien) return points[k].v;
    return points[k].v * (1 - doux((dt - p.maintien) / p.descente));
  };
  let base = tenu(i, t);
  const j = i + 1;
  if (j < points.length) {
    const ecart = i >= 0 ? points[j].m - points[i].m : Infinity;
    // Deux saisies rapprochées : on passe de l'une à l'autre en douceur sur tout l'intervalle ;
    // plus espacées : le niveau tient, redescend, puis remonte juste avant la saisie suivante.
    const r = ecart <= p.maintien ? ecart : Math.min(p.montee, ecart);
    const debut = points[j].m - r;
    if (t >= debut && r > 0) {
      const depart = tenu(i, debut);
      base = depart + (points[j].v - depart) * doux((t - debut) / r);
    }
  }
  return base;
}

/** Valeurs échantillonnées de a à b (minutes), pas en minutes. */
export function echantillons(a, b, points, p = COURBE_DEFAUT, pas = 5) {
  const r = [];
  for (let t = a; t <= b; t += pas) r.push({ m: t, v: niveau(t, points, p) });
  return r;
}

/**
 * Crises : périodes où la courbe sort du calme. Début = premier signal (> 0) ; dernière trace = dernier
 * signal ; fin estimée = dernière trace + maintien + descente, si aucun signal ne relance avant.
 */
export function crises(points, p = COURBE_DEFAUT) {
  const r = [];
  let c = null;
  for (const pt of points) {
    const finPrec = c ? c.derniere + p.maintien + p.descente : -Infinity;
    if (!c || pt.m > finPrec) {
      if (pt.v <= 0) continue; // un « calme » hors crise ne crée rien
      c = { debut: pt.m, derniere: pt.m, pic: pt.v, points: [pt] };
      r.push(c);
    } else {
      c.derniere = pt.m;
      c.pic = Math.max(c.pic, pt.v);
      c.points.push(pt);
    }
  }
  for (const x of r) {
    x.finTenue = x.derniere + p.maintien;
    x.fin = x.derniere + p.maintien + p.descente;
  }
  return r;
}
