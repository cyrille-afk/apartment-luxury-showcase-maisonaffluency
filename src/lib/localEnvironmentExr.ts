/** Stores a user-chosen EXR lighting file in this browser (IndexedDB — too large for localStorage). */
const DB = "ma-visualiser-env";
const STORE = "files";
const KEY = "empty-room-exr";
export const LOCAL_EXR_EVENT = "ma-local-exr-changed";

const open = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const run = async <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> => {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
};

export const isExrBuffer = (buffer: ArrayBuffer) => {
  const h = new Uint8Array(buffer, 0, Math.min(4, buffer.byteLength));
  return buffer.byteLength >= 8 && h[0] === 0x76 && h[1] === 0x2f && h[2] === 0x31 && h[3] === 0x01;
};

export async function getLocalExr(): Promise<{ name: string; buffer: ArrayBuffer } | null> {
  try { return (await run<{ name: string; buffer: ArrayBuffer } | undefined>("readonly", (s) => s.get(KEY))) ?? null; }
  catch { return null; }
}

export async function saveLocalExr(file: File): Promise<void> {
  const buffer = await file.arrayBuffer();
  if (!isExrBuffer(buffer)) throw new Error("That file isn't a valid .exr lighting file.");
  await run("readwrite", (s) => s.put({ name: file.name, buffer }, KEY));
  window.dispatchEvent(new Event(LOCAL_EXR_EVENT));
}

export async function clearLocalExr(): Promise<void> {
  await run("readwrite", (s) => s.delete(KEY));
  window.dispatchEvent(new Event(LOCAL_EXR_EVENT));
}

// One-time reset: return to the generated industrial room without an uploaded EXR.
if (typeof window !== "undefined" && typeof indexedDB !== "undefined") {
  const FLAG = "ma-visualiser-exr-reset-v1";
  try {
    if (!localStorage.getItem(FLAG)) {
      localStorage.setItem(FLAG, "1");
      clearLocalExr().catch(() => undefined);
    }
  } catch { /* storage unavailable */ }
}
