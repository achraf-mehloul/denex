// IndexedDB-backed session storage. Each session keeps the full
// triple-channel sample buffer captured during recording so it can be
// replayed and re-processed offline.

export type Session = {
  id: string;
  startedAt: number;
  durationMs: number;
  avgBpm: number;
  signalQuality: number;
  sampleRate: number;
  samples: number;
  deviceName?: string;
  original: Float32Array;
  noisy: Float32Array;
  filtered: Float32Array;
};

export type SessionMeta = Omit<Session, "original" | "noisy" | "filtered">;

const DB_NAME = "denex";
const STORE = "sessions";
const VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSession(s: Session): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(s);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSession(id: string): Promise<Session | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as Session) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function listSessions(): Promise<SessionMeta[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => {
      const all = (req.result as Session[]).map(({ original: _o, noisy: _n, filtered: _f, ...meta }) => {
        void _o; void _n; void _f;
        return meta;
      });
      resolve(all.sort((a, b) => b.startedAt - a.startedAt));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllSessions(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
