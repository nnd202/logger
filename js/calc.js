// Outils de dates et de nombres, sans dépendance.

export const uid = (p = 'x') => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const pad = (n) => String(n).padStart(2, '0');

/** Date locale au format AAAA-MM-JJ. */
export function aujourdhui(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const heureMaintenant = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

const midi = (iso) => new Date(`${iso}T12:00:00`);

export function ajouterJours(iso, n) {
  const d = midi(iso);
  d.setDate(d.getDate() + n);
  return aujourdhui(d);
}

/** Nombre de jours de a à b (b − a). */
export const ecartJours = (a, b) => Math.round((midi(b) - midi(a)) / 864e5);

/** Jour de la semaine, lundi = 0. */
export const jourSemaine = (iso) => (midi(iso).getDay() + 6) % 7;

export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const JOURS_COURTS = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
export const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « mer 19/11 », avec l'année quand elle diffère de l'année en cours (ou si annee = true). */
export function dateCourte(iso, annee = 'auto') {
  if (!iso) return '';
  const [a, m, j] = iso.split('-');
  const avecAn = annee === true || (annee === 'auto' && Number(a) !== new Date().getFullYear());
  return `${JOURS_COURTS[jourSemaine(iso)]} ${j}/${m}${avecAn ? `/${a}` : ''}`;
}

export const dateNum = (iso) => (iso ? iso.split('-').reverse().join('/') : '');

export function dateLongue(iso) {
  return midi(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export const minutesDe = (h) => { const [a, b] = String(h).split(':').map(Number); return a * 60 + (b || 0); };
export const texteHeure = (min) => `${Math.floor(min / 60) % 24}:${pad(Math.round(min % 60))}`.replace(/^(\d):/, '$1:');
export const texteHeureH = (h) => `${h} h`;

/** Durée en minutes en texte court : « 2 h 30 », « 45 min ». */
export function texteDuree(min) {
  min = Math.round(Math.abs(min));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${pad(m)}` : `${h} h`;
}

/** Nombre à la française : 2,5 ; 1 200. */
export function nombre(v, dec = 1) {
  if (v == null || !Number.isFinite(v)) return '–';
  const f = 10 ** dec;
  return (Math.round(v * f) / f).toLocaleString('fr-FR');
}

export const pct = (x) => `${Math.round(x * 100)} %`;

export const pluriel = (n, mot, motPluriel = `${mot}s`) => `${n.toLocaleString('fr-FR')} ${n > 1 || n === 0 ? motPluriel : mot}`;

export function ilYA(iso, auj = aujourdhui()) {
  const n = ecartJours(iso, auj);
  if (n === 0) return "aujourd'hui";
  if (n === 1) return 'hier';
  if (n === 2) return 'avant-hier';
  if (n < 0) return `dans ${-n} j`;
  return `il y a ${n} j`;
}

export const majuscule = (t) => { t = String(t || '').trim(); return t.charAt(0).toUpperCase() + t.slice(1); };

// --- Horodatages v2 : « AAAA-MM-JJTHH:MM » en heure locale ------------------------------

export const horodatage = (d = new Date()) => `${aujourdhui(d)}T${heureMaintenant(d)}`;

/** Minutes depuis l'époque, en heure locale (chaîne sans fuseau = heure locale). */
export const minutes = (ts) => Math.round(Date.parse(ts) / 60000);

export const deMinutes = (m) => horodatage(new Date(m * 60000));

export const ajouterMinutes = (ts, n) => deMinutes(minutes(ts) + n);

/** Journée de vie : de 5 h à 5 h. Une note à 1 h du matin appartient à la veille. */
export function jourDe(ts, debutJournee = 5) {
  return aujourdhui(new Date(Date.parse(ts) - debutJournee * 3600000));
}

/** « 21:04 » depuis un horodatage. */
export const heureDe = (ts) => (ts ? ts.slice(11, 16) : '');
