// Verrouillage de l'appli par un code à 4 chiffres. Pas de chiffrement : les données
// restent lisibles dans le stockage du navigateur ; le code évite seulement l'ouverture.

export const LONGUEUR = 4;
export const DELAI = 5 * 60 * 1000; // verrouillage après 5 min en arrière-plan

export async function empreinte(code, sel) {
  const texte = `${sel}:${code}`;
  try {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Contexte non sécurisé (http local) : empreinte simple.
    let h = 2166136261;
    for (const c of texte) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    return `f${(h >>> 0).toString(16)}`;
  }
}

export function tropSimple(code) {
  return /^(\d)\1+$/.test(code) || '0123456789'.includes(code) || '9876543210'.includes(code);
}

const EFFACER = '<svg viewBox="0 0 24 24"><path d="M9 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9l-5.5-6z"/><path d="M12.5 9.5l5 5M17.5 9.5l-5 5"/></svg>';

/** Pavé numérique dans un conteneur. onComplet(code, recommencer) est appelé à 4 chiffres. */
export function pave(conteneur, onComplet) {
  let code = '';
  conteneur.insertAdjacentHTML('beforeend', `
    <div class="points">${'<i></i>'.repeat(LONGUEUR)}</div>
    <div class="pave">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}
      <button type="button" class="vide-touche" tabindex="-1"></button><button type="button" data-n="0">0</button>
      <button type="button" data-n="x" aria-label="Effacer">${EFFACER}</button></div>`);
  const points = conteneur.querySelector('.points');
  const dessiner = () => points.querySelectorAll('i').forEach((p, i) => p.classList.toggle('plein', i < code.length));
  const recommencer = (erreur) => {
    code = '';
    dessiner();
    if (erreur) { points.classList.remove('erreur'); void points.offsetWidth; points.classList.add('erreur'); }
  };
  const taper = (n) => {
    if (n === 'x') code = code.slice(0, -1);
    else if (code.length < LONGUEUR) code += n;
    dessiner();
    if (code.length === LONGUEUR) setTimeout(() => onComplet(code, recommencer), 120);
  };
  conteneur.querySelector('.pave').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-n]');
    if (b) taper(b.dataset.n);
  });
  const clavier = (ev) => {
    if (!conteneur.isConnected) return document.removeEventListener('keydown', clavier);
    if (/^\d$/.test(ev.key)) taper(ev.key);
    else if (ev.key === 'Backspace') taper('x');
  };
  document.addEventListener('keydown', clavier);
}
