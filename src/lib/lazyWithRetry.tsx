import { lazy as reactLazy, ComponentType } from "react";

/**
 * React.lazy wrapper that survives stale chunk references after a deploy.
 *
 * When a new build ships, hashed chunk filenames change. A tab that still has
 * the old HTML/JS in memory will request a chunk that no longer exists and
 * throw "Failed to fetch dynamically imported module", producing a blank page.
 *
 * Strategy: retry once (handles transient network blips), then force a single
 * hard reload so the browser picks up the new index.html + chunk manifest.
 * A sessionStorage flag prevents infinite reload loops.
 */
const RELOAD_KEY = "chunk-reload-attempted";

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return reactLazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err) {
      // One silent retry for transient failures.
      try {
        const mod = await factory();
        sessionStorage.removeItem(RELOAD_KEY);
        return mod;
      } catch (err2) {
        const alreadyReloaded = sessionStorage.getItem(RELOAD_KEY) === "1";
        if (!alreadyReloaded && typeof window !== "undefined") {
          sessionStorage.setItem(RELOAD_KEY, "1");
          window.location.reload();
          // Never resolves — the page is going away.
          return new Promise<{ default: T }>(() => {});
        }
        throw err2;
      }
    }
  });
}
