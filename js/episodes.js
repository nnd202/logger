// Épisodes (calculés) et blocs (faits à la main).
// Épisode : des notes séparées de moins de « ecart » minutes, au moins deux. Simple proposition :
// l'utilisateur peut le figer en bloc, puis en ajouter ou retirer des notes.
import { minutes } from './calc.js';

const fin = (n, maintenant) => (n.enCours ? maintenant : n.fin ? minutes(n.fin) : minutes(n.debut));

function resume(liste, base, maintenant) {
  const notes = [...liste].sort((a, b) => a.debut.localeCompare(b.debut));
  const d = minutes(notes[0].debut);
  const f = Math.max(...notes.map((n) => fin(n, maintenant)));
  const types = [];
  for (const n of notes) if (!types.includes(n.type)) types.push(n.type);
  const ints = notes.map((n) => n.intensite).filter((v) => v != null);
  return { ...base, notes, debutMin: d, finMin: f, duree: f - d, pic: ints.length ? Math.max(...ints) : null, types };
}

/**
 * notes : toutes les notes (triées ou non). Renvoie les blocs et les épisodes, triés par début.
 * Les notes d'un bloc ne comptent pas dans les épisodes calculés, ni celles que « horsEpisode » écarte
 * (activités et sommeil : du contexte, pas des maillons ; elles peuvent entrer dans un bloc à la main).
 */
export function regroupements(notes, ecart = 45, maintenant = Math.round(Date.now() / 60000), blocs = [], horsEpisode = () => false) {
  const res = [];
  const parBloc = new Map();
  for (const n of notes) if (n.bloc) { if (!parBloc.has(n.bloc)) parBloc.set(n.bloc, []); parBloc.get(n.bloc).push(n); }
  for (const [id, liste] of parBloc) {
    const b = blocs.find((x) => x.id === id);
    res.push(resume(liste, { id, sorte: 'bloc', nom: b?.nom || '' }, maintenant));
  }
  const libres = notes.filter((n) => !n.bloc && !horsEpisode(n)).sort((a, b) => a.debut.localeCompare(b.debut));
  let groupe = [], finGroupe = -Infinity;
  const clore = () => {
    if (groupe.length >= 2) res.push(resume(groupe, { id: `ep-${groupe[0].id}`, sorte: 'episode', nom: '' }, maintenant));
    groupe = [];
  };
  for (const n of libres) {
    const d = minutes(n.debut);
    if (groupe.length && d - finGroupe > ecart) clore();
    if (!groupe.length) finGroupe = -Infinity;
    groupe.push(n);
    finGroupe = Math.max(finGroupe, fin(n, maintenant));
  }
  clore();
  return res.sort((a, b) => a.debutMin - b.debutMin);
}

/** Notes voisines d'un regroupement (± fenêtre en minutes), pour étendre ou réduire un bloc. */
export function voisines(notes, g, fenetre = 180) {
  return notes
    .filter((n) => minutes(n.debut) >= g.debutMin - fenetre && minutes(n.debut) <= g.finMin + fenetre)
    .sort((a, b) => a.debut.localeCompare(b.debut));
}
