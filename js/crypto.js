// Chiffrement du fichier d'export avec le code à 6 chiffres.
// Clé : PBKDF2-SHA-256 (600 000 itérations, sel aléatoire) → AES-GCM 256 bits.
// Le fichier reste un .txt contenant du JSON : l'en-tête est lisible, les données ne le sont pas.
// Limite : un code à 6 chiffres n'offre qu'un million de possibilités. Le fichier résiste à un curieux,
// pas à quelqu'un de déterminé qui disposerait du fichier : le ranger dans un stockage protégé.

export const ITERATIONS = 600000;

function b64(buf) {
  const o = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < o.length; i += 0x8000) s += String.fromCharCode(...o.subarray(i, i + 0x8000));
  return btoa(s);
}
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function cle(code, sel, iterations) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: sel, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function chiffrer(donnees, code) {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await cle(code, sel, ITERATIONS);
  const clair = new TextEncoder().encode(JSON.stringify(donnees));
  const chiffre = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, clair);
  return JSON.stringify({
    format: 'logger-export', version: 2, application: 'Logger', le: new Date().toISOString(),
    chiffre: { algo: 'AES-GCM', kdf: 'PBKDF2-SHA-256', iterations: ITERATIONS, sel: b64(sel), iv: b64(iv) },
    donnees: b64(chiffre),
  }, null, 1);
}

export function enClair(donnees) {
  return JSON.stringify({ format: 'logger-export', version: 2, application: 'Logger', le: new Date().toISOString(), chiffre: null, donnees }, null, 1);
}

/** Lit l'en-tête d'un export. Lève une erreur lisible si ce n'est pas un export Logger v2. */
export function lireEnTete(texte) {
  let d;
  try { d = JSON.parse(texte); } catch { throw new Error("Ce fichier n'est pas un export Logger"); }
  if (d?.format !== 'logger-export') throw new Error("Ce fichier n'est pas un export Logger");
  if (d.version !== 2) throw new Error('Cet export vient de la v1 : seule la v2 se réimporte');
  return d;
}

/** Renvoie les données en clair ; lève 'code' si le code ne correspond pas. */
export async function dechiffrer(enTete, code) {
  if (!enTete.chiffre) return enTete.donnees;
  const { sel, iv, iterations } = enTete.chiffre;
  const k = await cle(code, deB64(sel), iterations);
  try {
    const clair = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, k, deB64(enTete.donnees));
    return JSON.parse(new TextDecoder().decode(clair));
  } catch {
    throw new Error('code');
  }
}
