import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startBuildVersionWatcher } from "./lib/buildVersionWatcher";
import HmrStatusBanner from "./components/dev/HmrStatusBanner";
import BuildUpdateBanner from "./components/BuildUpdateBanner";

const CACHE_RESET_KEY = "__ma_frontend_cache_reset_v1";

function isPreviewOrDev(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return true;

  const host = window.location.hostname;
  const isLovablePreview =
    host.includes("lovableproject.com") ||
    host.includes("lovable.app") ||
    host.includes("id-preview--");

  let isFramed = false;
  try {
    isFramed = window.self !== window.top;
  } catch {
    isFramed = true;
  }

  return isLovablePreview || isFramed;
}

/**
 * Clears any leftover service worker / Cache Storage from older builds.
 * Runs at most once per browser (tracked in localStorage) and never reloads
 * the page — reloading here was causing the preview/test environment to
 * refresh on its own in a loop whenever a SW or cache happened to exist.
 */
async function clearStaleFrontendCachesOnce() {
  if (typeof window === "undefined") return;
  if (isPreviewOrDev()) return;
  try {
    if (localStorage.getItem(CACHE_RESET_KEY)) return;
    localStorage.setItem(CACHE_RESET_KEY, "true");
  } catch {
    return;
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    } catch { /* noop */ }
  }

  if ("caches" in window) {
    try {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((k) => caches.delete(k)));
    } catch { /* noop */ }
  }
}

void clearStaleFrontendCachesOnce();

// Auto cache-busting banner disabled per request.
// startBuildVersionWatcher();

// CSS is now loaded (import above is synchronous in the bundled output).
// Reveal content by adding css-ready — this disables the FOUC guard in index.html.
document.documentElement.classList.add("css-ready");

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    {/* <BuildUpdateBanner /> */}
    <HmrStatusBanner />
  </>
);
