import type { GLTF, GLTFLoader } from "three-stdlib";

/** Persistent browser cache for furniture models so reloads and 3D restarts skip re-downloading. */
export const MODEL_CACHE_NAME = "ma-visualiser-models-v1";
export const MAX_CACHED_MODELS = 40;

const memory = new Map<string, Promise<ArrayBuffer>>();

async function openCache(): Promise<Cache | null> {
  try { return typeof caches !== "undefined" ? await caches.open(MODEL_CACHE_NAME) : null; } catch { return null; }
}

/** Returns model bytes from memory, then Cache Storage, then the network (storing the result). */
export function cachedModelBytes(url: string, fetcher: typeof fetch = fetch): Promise<ArrayBuffer> {
  const hit = memory.get(url);
  if (hit) return hit;
  const pending = (async () => {
    const cache = await openCache();
    const stored = await cache?.match(url).catch(() => undefined);
    if (stored) return stored.arrayBuffer();
    const res = await fetcher(url, { credentials: "omit" });
    if (!res.ok) throw new Error(`Model download failed (${res.status})`);
    if (cache) {
      try {
        await cache.put(url, res.clone());
        const keys = await cache.keys();
        for (const old of keys.slice(0, Math.max(0, keys.length - MAX_CACHED_MODELS))) await cache.delete(old);
      } catch { /* storage full — still serve the download */ }
    }
    return res.arrayBuffer();
  })();
  memory.set(url, pending);
  pending.catch(() => memory.delete(url));
  return pending;
}

/** drei `useGLTF` extension: routes GLB downloads through the persistent cache. */
export function withCachedModelLoader(loader: GLTFLoader) {
  loader.load = (url, onLoad, _onProgress, onError) => {
    const resolved = loader.manager.resolveURL(url);
    const base = loader.path || resolved.slice(0, resolved.lastIndexOf("/") + 1);
    cachedModelBytes(resolved)
      .then((bytes) => loader.parse(bytes.slice(0), base, (gltf: GLTF) => onLoad(gltf), (e) => onError?.(e as unknown as ErrorEvent)))
      .catch((e) => onError?.(e));
  };
}
