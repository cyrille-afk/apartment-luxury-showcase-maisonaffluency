const RELOAD_FLAG = "ma:chunk-reloaded";

/**
 * Wraps a dynamic import so a stale chunk (after a new deploy) retries once,
 * then forces a single hard reload instead of crashing the page.
 */
export function lazyImportWithRetry<T>(factory: () => Promise<T>): () => Promise<T> {
  return async () => {
    try {
      const mod = await factory();
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }
      return mod;
    } catch (error) {
      // Second chance: the network may simply have hiccupped.
      try {
        return await factory();
      } catch (retryError) {
        let alreadyReloaded = false;
        try { alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1"; } catch { /* ignore */ }
        if (!alreadyReloaded) {
          try { sessionStorage.setItem(RELOAD_FLAG, "1"); } catch { /* ignore */ }
          window.location.reload();
          // Never resolves; the reload takes over.
          return await new Promise<T>(() => {});
        }
        throw retryError;
      }
    }
  };
}
