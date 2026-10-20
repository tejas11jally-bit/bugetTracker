// Offline quick add (PRD "Non-functional requirements"): entries queue in IndexedDB and sync later.
// Each entry carries a clientId so a retried request never creates a duplicate.

export type QueuedEntry = { clientId: string; body: Record<string, unknown>; queuedAt: number };

const DB = "ledgerly";
const STORE = "queue";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "clientId" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueue(entry: QueuedEntry) {
  await run("readwrite", (s) => s.put(entry));
}

export async function queued(): Promise<QueuedEntry[]> {
  if (typeof indexedDB === "undefined") return [];
  return run("readonly", (s) => s.getAll() as IDBRequest<QueuedEntry[]>);
}

let flushing = false;

export async function flushQueue(): Promise<number> {
  if (flushing || typeof indexedDB === "undefined" || !navigator.onLine) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const e of await queued()) {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...e.body, clientId: e.clientId }),
      }).catch(() => null);
      if (!res) break;
      if (res.ok || res.status === 400) {
        // 400 = unparseable; drop it rather than retry forever.
        await run("readwrite", (s) => s.delete(e.clientId));
        if (res.ok) sent++;
      }
    }
  } finally {
    flushing = false;
  }
  if (sent) window.dispatchEvent(new CustomEvent("ledgerly:synced", { detail: sent }));
  return sent;
}
