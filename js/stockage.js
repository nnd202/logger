// Où Logger range ses données sur l'appareil : IndexedDB (base « logger », table « kv »), clé → texte.
// Pas de plafond pratique de 5 Mo comme le stockage local, et les écritures ne bloquent pas l'écran.
// Repli sur le stockage local si IndexedDB est indisponible (navigation privée de certains navigateurs, tests).
// Au premier lancement, les données du stockage local y sont recopiées, puis retirées de l'ancien endroit.

const CLES = ['logger2-etat', 'logger2-coffre', 'logger2-copie'];

function local() {
  return {
    sorte: 'local',
    lire: async (k) => localStorage.getItem(k),
    ecrire: async (k, v) => localStorage.setItem(k, v),
    effacer: async (k) => localStorage.removeItem(k),
  };
}

const requete = (r) => new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); });

function ouvrirBase() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open('logger', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
    r.onblocked = () => ko(new Error('bloquée'));
  });
}

function idb(db) {
  const table = (mode) => db.transaction('kv', mode).objectStore('kv');
  const fin = (t) => new Promise((ok, ko) => { t.oncomplete = () => ok(); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error); });
  return {
    sorte: 'indexeddb',
    lire: async (k) => (await requete(table('readonly').get(k))) ?? null,
    ecrire: async (k, v) => { const s = table('readwrite'); s.put(v, k); await fin(s.transaction); },
    effacer: async (k) => { const s = table('readwrite'); s.delete(k); await fin(s.transaction); },
  };
}

/** Recopie l'ancien stockage local dans IndexedDB (une seule fois), puis le vide. */
async function migrer(b) {
  let ancien;
  try { ancien = CLES.filter((k) => localStorage.getItem(k) != null); } catch { return; }
  if (!ancien.length) return;
  for (const k of CLES) if ((await b.lire(k)) != null) return; // déjà migré : on ne touche à rien
  for (const k of ancien) await b.ecrire(k, localStorage.getItem(k));
  for (const k of ancien) if ((await b.lire(k)) !== localStorage.getItem(k)) return; // vérification avant d'effacer
  for (const k of ancien) localStorage.removeItem(k);
}

export async function ouvrirStockage() {
  if (typeof indexedDB === 'undefined') return local();
  try {
    const b = idb(await ouvrirBase());
    await migrer(b);
    // Demande au navigateur de ne jamais effacer ces données de lui-même quand l'appareil manque de place.
    try { b.persistant = await navigator.storage?.persist?.(); } catch { /* non proposé */ }
    return b;
  } catch {
    return local();
  }
}
