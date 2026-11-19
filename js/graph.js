// Petits graphiques SVG, sobres : une seule teinte (framboise), un repère éventuel en gris.
// Chaque marque a une zone de toucher large qui porte une bulle (data-tip).

export const ACCENT = '#b0335d';
const REPERE = '#a3aab3';
const GRILLE = '#ebe7e9';
const TEXTE = '#7b8290';
const VIDE = '#efecee';

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Teinte séquentielle : du très pâle (t ≈ 0) à l'accent (t = 1). */
export function teinte(t) {
  const a = [0xf6, 0xd9, 0xd6], b = [0xa8, 0x26, 0x54];
  const k = Math.max(0, Math.min(1, t));
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * k)).join(',')})`;
}

/** Graduations rondes (1, 2, 5 × 10ⁿ). */
export function graduations(min, max, n = 4) {
  if (min === max) { const d = Math.abs(min) * 0.1 || 1; min -= d; max += d; }
  const brut = (max - min) / n;
  const p = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 5, 10].map((k) => k * p).find((x) => x >= brut);
  const t = [];
  for (let v = Math.floor(min / pas) * pas; v <= Math.ceil(max / pas) * pas + pas / 2; v += pas) t.push(Math.round(v * 1e6) / 1e6);
  return t;
}

/** Barre aux coins du haut arrondis (4 px), posée sur la ligne de base. */
function barre(x, y, l, h, couleur) {
  if (h <= 0) return '';
  const r = Math.min(4, l / 2, h);
  return `<path d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + l - r}Q${x + l},${y} ${x + l},${y + r}V${y + h}Z" fill="${couleur}"/>`;
}

/**
 * Barres verticales. barres : [{ etiquette, y, tip, fort }] ; « fort » met la barre en accent
 * plein, les autres en accent atténué (seulement si au moins une barre est forte).
 * reference : ligne grise horizontale facultative (par exemple la moyenne).
 */
export function barres({ barres: bs, format = (v) => v, hauteur = 150, reference = null, etiquettesToutes = false, max = null }) {
  const L = 320, H = hauteur, g = 34, d = 8, h = 10, b = 22;
  const vals = bs.map((x) => x.y).concat(reference != null ? [reference] : []);
  const t = graduations(0, max ?? Math.max(...vals, 0.0001));
  const y1 = t[t.length - 1];
  const n = bs.length;
  const pas = (L - g - d) / n;
  const l = Math.max(2, pas - 2);
  const Y = (v) => h + (H - h - b) * (1 - v / (y1 || 1));
  const relief = bs.some((x) => x.fort);
  const grille = t.map((v) => `<line x1="${g}" x2="${L - d}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRILLE}" stroke-width="1"/>
    <text x="${g - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10.5" fill="${TEXTE}">${esc(format(v))}</text>`).join('');
  const marques = bs.map((x, i) => barre(g + i * pas + 1, Y(x.y), l, Y(0) - Y(x.y), relief && !x.fort ? '#d99aa9' : ACCENT)).join('');
  const ref = reference != null ? `<line x1="${g}" x2="${L - d}" y1="${Y(reference)}" y2="${Y(reference)}" stroke="${REPERE}" stroke-width="1.5" stroke-dasharray="4 3"/>` : '';
  const chaque = etiquettesToutes || n <= 12 ? 1 : Math.ceil(n / 8);
  const etiq = bs.map((x, i) => ((i % chaque === 0 || i === n - 1) && x.etiquette
    ? `<text x="${g + i * pas + pas / 2}" y="${H - 7}" font-size="10" fill="${TEXTE}" text-anchor="middle">${esc(x.etiquette)}</text>` : '')).join('');
  const zones = bs.map((x, i) => `<rect x="${g + i * pas}" y="${h}" width="${pas}" height="${H - h - b + 4}" fill="transparent" data-tip="${esc(x.tip)}"/>`).join('');
  return `<svg class="graphe" viewBox="0 0 ${L} ${H}" role="img">${grille}${marques}${ref}${etiq}${zones}</svg>`;
}

/** Courbe d'une série dans le temps. points : [{ etiquette, y, tip }]. Les y nuls sont des trous. */
export function courbe({ points, format = (v) => v, hauteur = 140, min = null, max = null }) {
  const L = 320, H = hauteur, g = 34, d = 40, h = 10, b = 22;
  const ys = points.map((p) => p.y).filter((v) => v != null);
  if (!ys.length) return '';
  const t = graduations(min ?? Math.min(...ys), max ?? Math.max(...ys));
  const y0 = t[0], y1 = t[t.length - 1];
  const n = points.length;
  const X = (i) => (n === 1 ? g + (L - g - d) / 2 : g + (i * (L - g - d)) / (n - 1));
  const Y = (v) => h + (H - h - b) * (1 - (v - y0) / (y1 - y0 || 1));
  const grille = t.map((v) => `<line x1="${g}" x2="${L - d + 8}" y1="${Y(v)}" y2="${Y(v)}" stroke="${GRILLE}" stroke-width="1"/>
    <text x="${g - 6}" y="${Y(v) + 3.5}" text-anchor="end" font-size="10.5" fill="${TEXTE}">${esc(format(v))}</text>`).join('');
  // Segments continus entre points présents.
  let chemin = '', ouvert = false;
  points.forEach((p, i) => {
    if (p.y == null) { ouvert = false; return; }
    chemin += `${ouvert ? 'L' : 'M'}${X(i)},${Y(p.y)}`;
    ouvert = true;
  });
  const r = n > 14 ? 3 : 4;
  const ronds = points.map((p, i) => (p.y == null ? '' : `<circle cx="${X(i)}" cy="${Y(p.y)}" r="${r}" fill="${ACCENT}" stroke="#fff" stroke-width="1.5"/>`)).join('');
  const pas = n > 1 ? (L - g - d) / (n - 1) : L - g - d;
  const zones = points.map((p, i) => `<rect x="${X(i) - pas / 2}" y="${h}" width="${pas}" height="${H - h - b}" fill="transparent" data-tip="${esc(p.tip)}"/>`).join('');
  const iDer = points.map((p) => p.y != null).lastIndexOf(true);
  const fin = `<text x="${X(iDer) + 8}" y="${Y(points[iDer].y) + 4}" font-size="11" font-weight="600" fill="#3f4652">${esc(format(points[iDer].y))}</text>`;
  const etiq = `<text x="${X(0)}" y="${H - 6}" font-size="10.5" fill="${TEXTE}" text-anchor="${n === 1 ? 'middle' : 'start'}">${esc(points[0].etiquette)}</text>
    ${n > 1 ? `<text x="${X(n - 1)}" y="${H - 6}" font-size="10.5" fill="${TEXTE}" text-anchor="end">${esc(points[n - 1].etiquette)}</text>` : ''}`;
  return `<svg class="graphe" viewBox="0 0 ${L} ${H}" role="img">${grille}<path d="${chemin}" fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${ronds}${fin}${etiq}${zones}</svg>`;
}

/**
 * Carte des jours, une colonne par semaine (lundi en haut). cases : [{ date, n, loupe, hors, tip }].
 * La teinte suit le nombre de saisies du jour (ou la valeur moyenne si « intensite » est fourni).
 */
export function carteJours({ cases, colonnes, maxN, moisEtiquettes }) {
  const L = 320, g = 22, h = 14;
  const pas = Math.min(16, (L - g) / colonnes);
  const c = pas - 2;
  const H = h + 7 * pas + 2;
  const jours = ['L', '', 'M', '', 'V', '', 'D'].map((j, i) => (j ? `<text x="${g - 6}" y="${h + i * pas + c - 1}" font-size="9" fill="${TEXTE}" text-anchor="end">${j}</text>` : '')).join('');
  const mois = moisEtiquettes.map((m) => `<text x="${g + m.col * pas}" y="${h - 4}" font-size="9.5" fill="${TEXTE}">${esc(m.nom)}</text>`).join('');
  const motif = `<defs><pattern id="hachure" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="${VIDE}"/><line x1="0" y1="0" x2="0" y2="4" stroke="#b7bcc4" stroke-width="1.6"/></pattern></defs>`;
  const carres = cases.map((x) => {
    if (x.hors) return '';
    const fill = x.loupe ? 'url(#hachure)' : x.n ? teinte(0.35 + 0.65 * (x.t ?? x.n / (maxN || 1))) : VIDE;
    const px = g + x.col * pas, py = h + x.lig * pas;
    return `<rect x="${px}" y="${py}" width="${c}" height="${c}" rx="2.5" fill="${fill}"/>
      <rect x="${px - 1}" y="${py - 1}" width="${pas}" height="${pas}" fill="transparent" data-tip="${esc(x.tip)}"/>`;
  }).join('');
  return `<svg class="graphe" viewBox="0 0 ${L} ${H}" role="img">${motif}${jours}${mois}${carres}</svg>`;
}

/** Grille jours de la semaine × heures. grille[j][h] = nombre de saisies. */
export function grilleHeures(grille, nomsJours) {
  const L = 320, g = 30, h = 4, b = 18;
  const pas = (L - g) / 24;
  const c = pas - 1.5;
  const H = h + 7 * (c + 2) + b;
  const max = Math.max(1, ...grille.flat());
  const cases = grille.map((ligne, j) => ligne.map((n, hr) => {
    const x = g + hr * pas, y = h + j * (c + 2);
    return `<rect x="${x}" y="${y}" width="${c}" height="${c}" rx="2" fill="${n ? teinte(0.3 + 0.7 * (n / max)) : VIDE}"/>
      <rect x="${x - 0.75}" y="${y - 1}" width="${pas}" height="${c + 2}" fill="transparent" data-tip="${esc(`${n} fois\n${nomsJours[j]}, ${hr} h – ${hr + 1} h`)}"/>`;
  }).join('')).join('');
  const jours = nomsJours.map((nm, j) => `<text x="${g - 5}" y="${h + j * (c + 2) + c - 2}" font-size="9.5" fill="${TEXTE}" text-anchor="end">${esc(nm.slice(0, 3))}</text>`).join('');
  const hrs = [0, 6, 12, 18, 23].map((hr) => `<text x="${g + hr * pas + c / 2}" y="${H - 5}" font-size="9.5" fill="${TEXTE}" text-anchor="${hr === 23 ? 'end' : 'middle'}">${hr} h</text>`).join('');
  return `<svg class="graphe" viewBox="0 0 ${L} ${H}" role="img">${jours}${cases}${hrs}</svg>`;
}

/** Bulle d'information : suit le doigt sur toute zone [data-tip]. */
export function activerBulles() {
  const bulle = document.createElement('div');
  bulle.className = 'bulle';
  bulle.hidden = true;
  document.body.appendChild(bulle);
  const montrer = (ev) => {
    const cible = ev.target.closest?.('[data-tip]');
    if (!cible) { bulle.hidden = true; return; }
    bulle.replaceChildren(...cible.dataset.tip.split('\n').map((t, i) => {
      const l = document.createElement(i ? 'span' : 'strong');
      l.textContent = t;
      return l;
    }));
    bulle.hidden = false;
    const r = bulle.getBoundingClientRect();
    const x = Math.min(Math.max(8, ev.clientX - r.width / 2), window.innerWidth - r.width - 8);
    const y = ev.clientY - r.height - 18 < 8 ? ev.clientY + 22 : ev.clientY - r.height - 18;
    bulle.style.left = `${x}px`;
    bulle.style.top = `${y}px`;
  };
  document.addEventListener('pointermove', montrer, { passive: true });
  document.addEventListener('pointerdown', montrer, { passive: true });
  window.addEventListener('scroll', () => { bulle.hidden = true; }, { passive: true });
}
