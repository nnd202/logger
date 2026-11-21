// Exemple inventé (aucune donnée réelle) : trois semaines de notes, pour tester la vue jour.
import { ajouterJours, aujourdhui } from './calc.js';

function graine(n) {
  return () => { n = (n * 1664525 + 1013904223) % 4294967296; return n / 4294967296; };
}

const hm = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function exemple(auj = aujourdhui()) {
  const r = graine(7);
  const notes = [];
  const personnes = [{ id: 'ex-p1', nom: 'Léa', exemple: true }, { id: 'ex-p2', nom: 'Sam', exemple: true }];
  let i = 0;
  // Une heure « m » (en minutes depuis minuit) d'un jour « d » ; au-delà de 24 h, on passe au lendemain.
  const ts = (d, m) => `${m >= 1440 ? ajouterJours(d, 1) : d}T${hm(m)}`;
  const n = (d, m, type, extra = {}) => {
    const x = { id: `ex-${i++}`, type, debut: ts(d, m), fin: null, enCours: false, precision: 'exacte', intensite: null, issue: null, quantite: '', aide: null, motif: null, activite: '', plaisir: null, maitrise: null, facettes: [], avecQui: [], personnes: [], etiquettes: [], phrase: '', chaine: null, cree: 0, exemple: true, ...extra };
    if (extra.duree) { x.fin = ts(d, m + extra.duree); delete x.duree; }
    notes.push(x);
    return x;
  };
  for (let k = 20; k >= 0; k--) {
    const d = ajouterJours(auj, -k);
    const semaine = new Date(`${d}T12:00`).getDay() % 6 !== 0;
    if (semaine) n(d, 9 * 60 + Math.floor(r() * 30), 'travail', { duree: 480, plaisir: 3 + Math.floor(r() * 3), maitrise: 5 + Math.floor(r() * 3), facettes: ['subie', 'ecran'], avecQui: ['collegues'], activite: r() < 0.3 ? 'Télétravail' : '' });
    if (r() < 0.35) n(d, 18 * 60 + 30, 'loisir', { duree: 80, activite: 'PWA avec Claude', plaisir: 8, maitrise: 8 + Math.floor(r() * 2), facettes: ['choisie', 'ecran', 'creatif'], avecQui: ['seul'] });
    if (r() < 0.25) n(d, 19 * 60, 'sortie', { duree: 150, activite: 'Dîner', plaisir: 7, maitrise: 5, facettes: ['choisie', 'dehors'], avecQui: ['amis'], personnes: [r() < 0.5 ? 'ex-p1' : 'ex-p2'] });
    if (r() < 0.6) {
      // Une soirée : déclencheur, agitation, mal-être, fatigue, envie, coping, action aidante.
      const t0 = 20 * 60 + 40 + Math.floor(r() * 40);
      const ch = [];
      ch.push(n(d, t0, 'declencheur', { etiquettes: [r() < 0.5 ? 't6' : 't5'], phrase: r() < 0.3 ? 'Mail du chef en fin de journée' : '' }));
      ch.push(n(d, t0 + 10, 'agitation', { intensite: 5 + Math.floor(r() * 3), etiquettes: ['t7', 't8'] }));
      ch.push(n(d, t0 + 15, 'maletre', { intensite: 5 + Math.floor(r() * 3) }));
      ch.push(n(d, t0 + 35, 'fatigue', { intensite: 4 + Math.floor(r() * 3) }));
      ch.push(n(d, t0 + 50, 'agitation', { intensite: 7 + Math.floor(r() * 3) }));
      ch.push(n(d, t0 + 55, 'maletre', { intensite: 7 + Math.floor(r() * 2) }));
      const cede = r() < 0.6;
      ch.push(n(d, t0 + 70, 'e-ecrans', { intensite: 6 + Math.floor(r() * 4) }));
      if (cede) ch.push(n(d, t0 + 75, 'c-ecrans', { duree: 40 + Math.floor(r() * 30), intensite: 3 + Math.floor(r() * 7) }));
      ch.push(n(d, t0 + 100, 'fatigue', { intensite: 7 + Math.floor(r() * 3) }));
      if (r() < 0.7) ch.push(n(d, t0 + 150, r() < 0.5 ? 'coucher' : 'respiration', { aide: r() < 0.7 ? 'oui' : 'unpeu' }));
    }
    if (r() < 0.25) n(d, 14 * 60 + 30, 'c-reverie', { duree: 45, etiquettes: ['t13'] });
    if (r() < 0.2) n(d, 15 * 60, 'c-dormir', { duree: 70, motif: r() < 0.6 ? 'pour fuir' : 'pour récupérer' });
    if (r() < 0.15) n(d, 11 * 60 + Math.floor(r() * 120), r() < 0.5 ? 'tete' : 'ventre', { intensite: 3 + Math.floor(r() * 5) });
    if (r() < 0.2) n(d, 3 * 60 + Math.floor(r() * 60), 'reveil', { precision: 'vers' });
    if (k > 0) n(d, 23 * 60 + 10 + Math.floor(r() * 50), 'endormissement', { duree: [30, 30, 45, 90][Math.floor(r() * 4)], intensite: 2 + Math.floor(r() * 7), precision: 'vers' });
  }
  // Rien après l'heure actuelle aujourd'hui.
  const maintenant = `${auj}T${hm(new Date().getHours() * 60 + new Date().getMinutes())}`;
  const passees = notes.filter((x) => x.debut <= maintenant);
  for (const x of passees) {
    if (x.fin && x.fin > maintenant) x.fin = maintenant;
    if (x.chaine && !passees.some((y) => y.id === x.chaine)) x.chaine = null;
  }
  return { notes: passees, personnes };
}
