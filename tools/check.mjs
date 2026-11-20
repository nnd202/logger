// Contrôles de Logger v2 : fichiers du service worker, journée de vie, épisodes, blocs,
// jours renseignés, export chiffré, import.
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

// Stockage simulé.
const memoire = new Map();
globalThis.localStorage = { getItem: (k) => memoire.get(k) ?? null, setItem: (k, v) => memoire.set(k, String(v)), removeItem: (k) => memoire.delete(k) };

const imp = (f) => import(pathToFileURL(join(racine, 'js', f)).href);
const Cl = await imp('calc.js');
const Ca = await imp('catalogue.js');
const E = await imp('episodes.js');
const S = await imp('store.js');
const Cr = await imp('crypto.js');
const { exemple } = await imp('demo.js');

// 2. Dates et journée de vie.
verifier('jourDe : 1 h du matin = la veille', Cl.jourDe('2026-11-21T01:30') === '2026-11-20');
verifier('jourDe : 5 h = le jour même', Cl.jourDe('2026-11-21T05:00') === '2026-11-21');
verifier('ajouterMinutes passe minuit', Cl.ajouterMinutes('2026-11-20T23:50', 20) === '2026-11-21T00:10');

// 3. Catalogue.
const types = Ca.typesDeDepart();
verifier('catalogue : ids uniques', new Set(types.map((t) => t.id)).size === types.length);
verifier('catalogue : toutes les familles couvertes', Ca.FAMILLES.every((f) => types.some((t) => t.famille === f.id)));
verifier('catalogue : envies avec intensité', types.filter((t) => t.famille === 'envie').every((t) => t.echelle));

// 4. Épisodes et blocs.
const n = (id, debut, extra = {}) => ({ id, type: 'agitation', debut, fin: null, enCours: false, intensite: 5, bloc: null, ...extra });
const notes = [n('a', '2026-11-20T21:00'), n('b', '2026-11-20T21:30', { intensite: 9 }), n('c', '2026-11-20T22:10'), n('d', '2026-11-20T23:30'), n('e', '2026-11-21T00:10')];
const g = E.regroupements(notes, 45, 0);
verifier('épisodes : deux groupes (21:00–22:10 et 23:30–00:10)', g.length === 2 && g[0].notes.length === 3 && g[1].notes.length === 2);
verifier('épisode : pic et durée', g[0].pic === 9 && g[0].duree === 70);
const plage = [n('p', '2026-11-20T14:00', { fin: '2026-11-20T15:30' }), n('q', '2026-11-20T16:00')];
verifier('épisode : une plage compte jusqu\'à sa fin', E.regroupements(plage, 45, 0).length === 1);
verifier('épisode : notes écartées (activités)', E.regroupements(plage, 45, 0, [], (x) => x.id === 'p').length === 0);
const avecBloc = notes.map((x) => (['c', 'd'].includes(x.id) ? { ...x, bloc: 'B' } : x));
const g2 = E.regroupements(avecBloc, 45, 0, [{ id: 'B', nom: 'Soirée' }]);
verifier('bloc : ses notes sortent des épisodes', g2.some((x) => x.sorte === 'bloc' && x.nom === 'Soirée' && x.notes.length === 2) && g2.filter((x) => x.sorte === 'episode').every((x) => !x.notes.some((y) => y.bloc)));

// 5. Store : notes, encore, blocs, jours renseignés, pauses.
S.toutEffacer();
const n1 = S.ajouterNote({ type: 'agitation', debut: '2026-11-20T21:00', intensite: 7, etiquettes: ['t7'] });
const n2 = S.encore();
verifier('encore : même type, même intensité, mêmes étiquettes', n2.type === 'agitation' && n2.intensite === 7 && n2.etiquettes[0] === 't7' && n2.id !== n1.id);
verifier('jour renseigné', S.statutJour('2026-11-20') === 'renseigne');
verifier('jour vide', S.statutJour('2026-11-10') === 'vide');
S.basculerCalme('2026-11-10');
verifier('journée calme', S.statutJour('2026-11-10') === 'calme');
S.commencerPause('2026-11-12');
verifier('pause', S.statutJour('2026-11-13') === 'pause');
const b = S.creerBloc([n1.id]);
S.definirMembres(b.id, []);
verifier('bloc vide supprimé', !S.bloc(b.id));
const fin = S.ajouterNote({ type: 'c-reverie', debut: '2026-11-20T14:00', enCours: true });
S.arreter(fin, '2026-11-20T14:45');
verifier('plage arrêtée', !fin.enCours && fin.fin === '2026-11-20T14:45');
const e1 = S.ajouterEtiquette('Bruit');
S.modifierNote(n1, { etiquettes: ['t7', e1.id] });
S.fusionnerEtiquettes(e1.id, 't7');
verifier('fusion d\'étiquettes', n1.etiquettes.length === 1 && n1.etiquettes[0] === 't7' && !S.etiquette(e1.id));

// 6. Export chiffré, import.
S.chargerExemple(exemple('2026-11-20'));
S.reglages().code = { sel: 'x', empreinte: 'y', longueur: 6 };
const donnees = S.donneesExport();
verifier('export : sans le code', !donnees.reglages.code);
const texte = await Cr.chiffrer(donnees, '258013');
verifier('export chiffré : aucune donnée lisible', !texte.includes('agitation') && !texte.includes('Soirée'));
const entete = Cr.lireEnTete(texte);
let refuse = false; try { await Cr.dechiffrer(entete, '111111'); } catch (e) { refuse = e.message === 'code'; }
verifier('mauvais code refusé', refuse);
const relu = await Cr.dechiffrer(entete, '258013');
verifier('bon code : tout revient', relu.notes.length === donnees.notes.length && relu.blocs.length === donnees.blocs.length);
let v1 = false; try { Cr.lireEnTete(JSON.stringify({ format: 'logger-export', version: 1 })); } catch { v1 = true; }
verifier('export v1 refusé', v1);
const avant = S.get().notes.length;
S.toutEffacer();
S.importer(relu, 'remplacer');
verifier('import remplacer', S.get().notes.length === avant && S.reglages().code?.sel === 'x');
S.importer(relu, 'fusionner');
verifier('import fusionner : pas de doublon', S.get().notes.length === avant);
S.restaurerCopie();
verifier('annuler import', S.get().notes.length === avant);
S.retirerExemples();
verifier('exemple retiré', !S.aDesExemples());

console.log(`${ok} contrôles réussis, ${ko} échec${ko > 1 ? 's' : ''}`);
process.exit(ko ? 1 : 0);
