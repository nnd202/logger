// Exemple inventé (aucune donnée réelle) : trois calendriers sur quatre mois, pour voir les stats.
import { ajouterJours, aujourdhui, jourSemaine } from './calc.js';

function graine(n) {
  return () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };
}

export function exemple(auj = aujourdhui()) {
  const r = graine(42);
  const debut = ajouterJours(auj, -120);
  const id = (p, i) => `ex-${p}-${i}`;
  const fatigue = {
    id: 'ex-fatigue', nom: 'Fatigue KO', couleur: '#c2416b', debut, exemple: true, saisie: 'jour',
    echelle: { nom: 'Intensité', min: 1, max: 10, bas: 'un peu las', haut: 'KO total' },
    etiquettes: [{ id: 'f1', nom: 'mal dormi' }, { id: 'f2', nom: 'journée chargée' }, { id: 'f3', nom: 'après sport' }],
    note: true, loupes: [],
  };
  const stress = {
    id: 'ex-stress', nom: 'Stress', couleur: '#6f8fd0', debut, exemple: true, saisie: 'heure',
    echelle: { nom: 'Niveau', min: 1, max: 5, bas: 'léger', haut: 'fort' },
    etiquettes: [{ id: 's1', nom: 'travail' }, { id: 's2', nom: 'transport' }, { id: 's3', nom: 'famille' }],
    note: true, loupes: [],
  };
  const cles = {
    id: 'ex-cles', nom: 'Clés oubliées', couleur: '#c9a35e', debut, exemple: true, saisie: 'les-deux',
    echelle: null, etiquettes: [], note: true, loupes: [],
  };
  const saisies = [];
  const joursStress = new Set();
  let i = 0;
  for (let d = debut; d < auj; d = ajouterJours(d, 1)) {
    const j = jourSemaine(d);
    // Stress : plus fréquent en semaine, vers 9 h et 17 h.
    const pS = j < 5 ? (j === 0 ? 0.55 : 0.32) : 0.08;
    if (r() < pS) {
      joursStress.add(d);
      const n = r() < 0.25 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const soir = r() < 0.45;
        const h = soir ? 16 + Math.floor(r() * 3) : 8 + Math.floor(r() * 2);
        saisies.push({ id: id('s', i++), cal: stress.id, date: d, heure: `${String(h).padStart(2, '0')}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, valeur: 1 + Math.floor(r() * 5), etiquettes: [soir ? 's2' : 's1'].concat(r() < 0.15 ? ['s3'] : []), note: '', cree: 0 });
      }
    }
    // Fatigue : plus probable le lendemain d'un stress, et le lundi.
    const veille = ajouterJours(d, -1);
    const pF = 0.1 + (joursStress.has(veille) ? 0.35 : 0) + (j === 0 ? 0.15 : 0);
    if (r() < pF) {
      const tags = [];
      if (joursStress.has(veille) && r() < 0.6) tags.push('f1');
      if (j < 5 && r() < 0.4) tags.push('f2');
      if (r() < 0.2) tags.push('f3');
      saisies.push({ id: id('f', i++), cal: fatigue.id, date: d, heure: null, valeur: Math.min(10, 4 + Math.floor(r() * 5) + (tags.includes('f1') ? 2 : 0)), etiquettes: tags, note: '', cree: 0 });
    }
    if (r() < 0.05) saisies.push({ id: id('c', i++), cal: cles.id, date: d, heure: r() < 0.5 ? null : `0${7 + Math.floor(r() * 2)}:${String(Math.floor(r() * 60)).padStart(2, '0')}`, valeur: null, etiquettes: [], note: '', cree: 0 });
    if (r() < 0.03) fatigue.loupes.push(d);
  }
  fatigue.loupes = fatigue.loupes.filter((d) => !saisies.some((s) => s.cal === fatigue.id && s.date === d));
  return { calendriers: [fatigue, stress, cles], saisies, liens: [{ id: 'ex-lien', a: fatigue.id, b: stress.id }] };
}
