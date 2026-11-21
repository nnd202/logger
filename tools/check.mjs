// Contrôles de Logger v2 : fichiers du service worker, journée, enchaînements,
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
const S = await imp('store.js');
const Cr = await imp('crypto.js');
const { exemple } = await imp('demo.js');

// 2. Dates et journée de vie.
verifier('jourDe : journée de 0 h à 24 h', Cl.jourDe('2026-11-21T00:30', Ca.DEBUT_JOURNEE) === '2026-11-21' && Cl.jourDe('2026-11-20T23:59', Ca.DEBUT_JOURNEE) === '2026-11-20');
verifier('ajouterMinutes passe minuit', Cl.ajouterMinutes('2026-11-20T23:50', 20) === '2026-11-21T00:10');

// 3. Catalogue.
const types = Ca.typesDeDepart();
verifier('catalogue : ids uniques', new Set(types.map((t) => t.id)).size === types.length);
verifier('catalogue : toutes les familles couvertes', Ca.FAMILLES.every((f) => types.some((t) => t.famille === f.id)));
verifier('catalogue : envies avec intensité', types.filter((t) => t.famille === 'envie').every((t) => t.echelle));

// 4. Corps et endormissement au catalogue.
verifier('chaque type a une icône', types.every((t) => t.icone));
verifier('famille Corps', types.some((t) => t.famille === 'corps' && t.nom === 'Nausées'));
verifier('endormissement : zone de 30 min au moins', Ca.ZONE_MIN === 30 && Ca.LATENCES.length === 4);

// 5. Store : notes, encore, blocs, jours renseignés, pauses.
S.toutEffacer();
const n1 = S.ajouterNote({ type: 'agitation', debut: '2026-11-20T21:00', intensite: 7, etiquettes: ['t7'] });
const n2 = S.ajouterNote({ type: 'maletre', debut: '2026-11-20T21:05', chaine: n1.id });
const n3 = S.ajouterNote({ type: 'fatigue', debut: '2026-11-20T21:20', chaine: n1.id });
verifier('enchaînement : suites dans l\'ordre', S.suitesDe(n1.id).map((x) => x.id).join() === [n2.id, n3.id].join());
S.supprimerNote(n1.id);
verifier('tête supprimée : la suivante prend la tête', n2.chaine === null && n3.chaine === n2.id);
S.remettreNote(n1);
verifier('jour renseigné', S.statutJour('2026-11-20') === 'renseigne');
verifier('jour vide', S.statutJour('2026-11-10') === 'vide');
S.basculerCalme('2026-11-10');
verifier('rien à signaler', S.statutJour('2026-11-10') === 'calme');
S.commencerPause('2026-11-12');
verifier('pause', S.statutJour('2026-11-13') === 'pause');
const nuit = S.ajouterNote({ type: 'endormissement', debut: '2026-11-20T23:50', fin: '2026-11-21T00:20' });
verifier('plage après minuit visible le lendemain', S.plagesTraversantes('2026-11-21').includes(nuit) && !S.plagesTraversantes('2026-11-20').includes(nuit));
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
verifier('export chiffré : aucune donnée lisible', !texte.includes('agitation') && !texte.includes('Léa'));
const entete = Cr.lireEnTete(texte);
let refuse = false; try { await Cr.dechiffrer(entete, '111111'); } catch (e) { refuse = e.message === 'code'; }
verifier('mauvais code refusé', refuse);
const relu = await Cr.dechiffrer(entete, '258013');
verifier('bon code : tout revient', relu.notes.length === donnees.notes.length && relu.notes.some((x) => x.chaine));
let v1 = false; try { Cr.lireEnTete(JSON.stringify({ format: 'logger-export', version: 1 })); } catch { v1 = true; }
verifier('export v1 refusé', v1);
const avant = S.get().notes.length;
S.toutEffacer();
S.importer(relu, 'remplacer');
verifier('import remplacer', S.get().notes.length === avant && S.reglages().code?.sel === 'x');
S.importer(relu, 'fusionner');
verifier('import fusionner : pas de doublon', S.get().notes.length === avant);
await S.restaurerCopie();
verifier('annuler import', S.get().notes.length === avant);
S.retirerExemples();
verifier('exemple retiré', !S.aDesExemples());

// 7. Migration v2.0 → v2.0.1 : les blocs deviennent des enchaînements.
S._remplacer({ version: 2, types: [], notes: [{ id: 'x', type: 'agitation', debut: '2026-11-20T21:00', bloc: 'B' }, { id: 'y', type: 'fatigue', debut: '2026-11-20T21:30', bloc: 'B' }], blocs: [{ id: 'B', nom: 'Soirée' }] });
verifier('icône ajoutée aux anciens types', S.type('agitation')?.icone === '🌀');
verifier('migration des blocs', S.note('y').chaine === 'x' && S.note('x').chaine === null && !('blocs' in S.get()));

// 8. Ordre des colonnes : fixé, un nouveau type s'ajoute à la fin, rien ne bouge seul.
S._remplacer({ version: 2, notes: [] });
const nj = (id, type, h) => ({ id, type, debut: `2026-11-21T${h}`, chaine: null });
let ns = [nj('a', 'travail', '09:00'), nj('b', 'fatigue', '14:00')];
verifier('colonnes : première vue par heure', S.ordreColonnes('2026-11-21', ns).join() === 'travail,fatigue');
ns.push(nj('c', 'stress', '07:00'));
verifier('colonnes : nouveau type à la fin, même plus tôt', S.ordreColonnes('2026-11-21', ns).join() === 'travail,fatigue,stress');
S.ordonnerColonnes('2026-11-21', ['stress', 'travail', 'fatigue']);
verifier('colonnes : ordre choisi gardé', S.ordreColonnes('2026-11-21', ns).join() === 'stress,travail,fatigue');
verifier('colonnes : type sans note retiré', S.ordreColonnes('2026-11-21', ns.filter((n) => n.type !== 'travail')).join() === 'stress,fatigue');

// 9. Coffre : données de l'appareil chiffrées avec le code.
S._remplacer({ version: 2, notes: [{ id: 'z', type: 'fatigue', debut: '2026-11-21T10:00', phrase: 'secret-du-test' }] });
S.enregistrer();
await S.chiffrerAvec('258013');
await S.ecrituresFinies();
const brutCoffre = memoire.get('logger2-coffre') || '';
verifier('coffre : écrit et sans texte en clair', brutCoffre.includes('logger-coffre') && !brutCoffre.includes('secret-du-test') && !memoire.has('logger2-etat'));
S.ajouterNote({ type: 'stress', phrase: 'deuxieme-secret' });
await S.ecrituresFinies();
const S2 = await import(pathToFileURL(join(racine, 'js', 'store.js')).href + '?relance');
verifier('coffre : fermé au démarrage', S2.estChiffre() && !S2.estOuvert() && S2.get().notes.length === 0);
verifier('coffre : mauvais code refusé', !(await S2.ouvrir('111111')));
verifier('coffre : bon code, tout revient', (await S2.ouvrir('258013')) && S2.get().notes.some((n) => n.phrase === 'deuxieme-secret'));
verifier('coffre : vérification après absence', (await S2.verifierCode('258013')) && !(await S2.verifierCode('000000')));
S2.importer({ version: 2, notes: [], types: [] }, 'remplacer');
await S2.ecrituresFinies();
verifier('coffre : copie de secours chiffrée', !(memoire.get('logger2-copie') || '').includes('secret') && S2.copieDisponible());
await S2.restaurerCopie();
verifier('coffre : copie restaurée', S2.get().notes.length === 2);
await S2.dechiffrerTout();
await S2.ecrituresFinies();
verifier('coffre : retiré, données en clair', !memoire.has('logger2-coffre') && (memoire.get('logger2-etat') || '').includes('deuxieme-secret'));

console.log(`${ok} contrôles réussis, ${ko} échec${ko > 1 ? 's' : ''}`);
process.exit(ko ? 1 : 0);
