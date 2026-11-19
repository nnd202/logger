// Contrôles : fichiers du service worker, moteur d'analyse, export / import.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
let ok = 0, ko = 0;
const verifier = (nom, cond) => { if (cond) ok++; else { ko++; console.log('ÉCHEC :', nom); } };

// 1. Tout fichier js/css/icône est dans CORE, et tout CORE existe.
const sw = readFileSync(join(racine, 'sw.js'), 'utf8');
const bloc = sw.match(/const CORE = \[([\s\S]*?)\]/)[1];
const core = [...bloc.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
for (const f of core) verifier(`CORE existe : ${f}`, existsSync(join(racine, f)));
for (const dossier of ['js', 'css', 'icons']) {
  for (const f of readdirSync(join(racine, dossier))) verifier(`dans CORE : ${dossier}/${f}`, core.includes(`${dossier}/${f}`));
}

// 2. Moteur.
const imp = (f) => import(pathToFileURL(join(racine, 'js', f)).href);
const C = await imp('calc.js');
const A = await imp('analyse.js');
const { exemple } = await imp('demo.js');

verifier('ajouterJours fin de mois', C.ajouterJours('2026-01-31', 1) === '2026-02-01');
verifier('jourSemaine lundi = 0', C.jourSemaine('2026-11-16') === 0);
verifier('ecartJours', C.ecartJours('2026-03-28', '2026-03-31') === 3);

const cal = { id: 'c', debut: '2026-11-01', loupes: ['2026-11-04'], echelle: { nom: 'I', min: 0, max: 10 }, etiquettes: [{ id: 't', nom: 'x' }] };
const s = (date, heure = null, valeur = null, etiquettes = []) => ({ cal: 'c', date, heure, valeur, etiquettes });
const saisies = [s('2026-11-02', '09:00', 4, ['t']), s('2026-11-02', '10:00', 6), s('2026-11-05', null, 8, ['t']), s('2026-11-09', '23:30'), s('2026-11-10', '00:30')];
const r = A.analyser(cal, saisies, '2026-11-01', '2026-11-10', '2026-11-10');
verifier('nombre de jours', r.N === 10);
verifier('jours cochés', r.coches === 4);
verifier('saisies', r.nbSaisies === 5);
verifier('loupés', r.loupes.length === 1);
verifier('écarts', r.rythme.ecartMedian === 3);
verifier('série', r.rythme.plusLongueSerie === 2 && r.rythme.serieEnCours === 2);
verifier('heures', r.heures.compte[9] === 1 && r.heures.compte[23] === 1 && r.heures.n === 4);
verifier('heure moyenne circulaire (23:30 et 00:30 → minuit)', (() => { const x = A.analyser(cal, [s('2026-11-09', '23:30'), s('2026-11-10', '00:30')], '2026-11-01', '2026-11-10', '2026-11-10').heures.heureMoyenne; return Math.min(x, 1440 - x) < 1; })());
verifier('échelle moyenne', r.echelle.moyenne === 6);
verifier('étiquette', r.etiquettes[0].n === 2 && r.etiquettes[0].moyAvec === 6);
verifier('bornes : jamais avant le début', A.bornes('2026-11-01', { id: '30' }, '2026-11-10').du === '2026-11-01');

// 3. Croisement : l'exemple contient « fatigue le lendemain d'un stress ».
const ex = exemple('2026-11-19');
const [f, st] = ex.calendriers;
const x = A.croiser(f, st, ex.saisies.filter((y) => y.cal === f.id), ex.saisies.filter((y) => y.cal === st.id), '2026-11-19');
verifier('croisement calculé', x.assez && x.autourA.length === 5);
verifier('fatigue : stress la veille ressort', x.autourA.find((y) => y.id === 'veille').fort && x.autourA.find((y) => y.id === 'veille').sens > 0);

// 4. Export / import (stockage simulé).
const memoire = new Map();
globalThis.localStorage = { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, String(v)), removeItem: (k) => memoire.delete(k) };
const S = await imp('store.js');
S.chargerExemple(exemple('2026-11-19'));
S.get().reglages.code = { sel: 'a', empreinte: 'b' };
const texte = S.contenuExport();
const d = S.lireExport(texte);
verifier('export : tout est là', d.calendriers.length === 3 && d.saisies.length === S.get().saisies.length && d.liens.length === 1);
verifier("export : sans le code de l'appareil", !d.reglages.code);
S.toutEffacer();
S.get().reglages.code = { sel: 'a', empreinte: 'b' };
S.importer(d, 'remplacer');
verifier('import remplacer', S.calendriers().length === 3 && S.get().reglages.code?.sel === 'a');
verifier('import ajouter : rien en double', S.importer(d, 'ajouter') === 0 && S.calendriers().length === 3);
S.restaurerCopie();
verifier('annuler import', S.calendriers().length === 3);
let refuse = false; try { S.lireExport('{"a":1}'); } catch { refuse = true; }
verifier('fichier étranger refusé', refuse);

console.log(`${ok} contrôles réussis, ${ko} échec${ko > 1 ? 's' : ''}`);
process.exit(ko ? 1 : 0);
