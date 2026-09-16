/**
 * Stale-chunk self-healing.
 *
 * Vite emits content-hashed asset filenames, so a new deploy replaces the
 * chunk files an already-open tab still references. When such a tab lazily
 * loads a route AFTER a publish, the old hashed chunk is gone and the dynamic
 * import rejects ("Failed to fetch dynamically imported module" /
 * "Importing a module script failed" / ChunkLoadError) — the user sees a blank
 * panel or an error boundary.
 *
 * This module listens for those failures and heals them by purging any
 * service worker / Cache Storage copy of the old build and reloading the SAME
 * url with a cache-busting query param. Guarded so it can only happen once per
 * build id per tab session — never a reload loop.
 */

const RELOAD_GUARD_KEY = "__ma_stale_chunk_reload";

const STALE_IMPORT_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
  "chunkloaderror",
  "loading chunk",
  "loading css chunk",
];

function isStaleChunkMessage(message: unknown): boolean {
  if (typeof message !== "string") return false;
  const m = message.toLowerCase();
  return STALE_IMPORT_PATTERNS.some((p) => m.includes(p));
}

function currentBuildId(): string {
  if (typeof document === "undefined") return "unknown";
  return document.querySelector('meta[name="app-build-id"]')?.getAttribute("content") || "unknown";
}

function alreadyHealed(): boolean {
  try {
    return sessionStorage.getItem(RELOAD_GUARD_KEY) === currentBuildId();
  } catch {
    return false;
  }
}

function markHealed() {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, currentBuildId());
  } catch {
    /* noop */
  }
}

async function purgeAndReload() {
  if (alreadyHealed()) return;
  markHealed();

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    }
  } catch {
    /* noop */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch {
    /* noop */
  }

  try {
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export function startStaleChunkRecovery() {
  if (typeof window === "undefined") return;
  if (import.meta.env.DEV) return;

  // Vite's own signal for a failed module preload — the most reliable hook.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    void purgeAndReload();
  });

  window.addEventListener("error", (event) => {
    if (isStaleChunkMessage(event.message)) void purgeAndReload();
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { message?: string; name?: string } | string | undefined;
    const message = typeof reason === "string" ? reason : reason?.message || reason?.name;
    if (isStaleChunkMessage(message)) void purgeAndReload();
  });
}
