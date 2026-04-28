import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { startBuildVersionWatcher } from "./lib/buildVersionWatcher";

const CACHE_RESET_SESSION_KEY = "__ma_frontend_cache_reset_v1";

async function clearStaleFrontendCachesOnce() {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(CACHE_RESET_SESSION_KEY)) return;

  sessionStorage.setItem(CACHE_RESET_SESSION_KEY, "true");

  let shouldReload = false;

  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();

    if (registrations.length > 0) {
      await Promise.all(registrations.map((registration) => registration.unregister()));
      shouldReload = true;
    }
  }

  if ("caches" in window) {
    const cacheKeys = await caches.keys();

    if (cacheKeys.length > 0) {
      await Promise.all(cacheKeys.map((cacheKey) => caches.delete(cacheKey)));
      shouldReload = true;
    }
  }

  if (shouldReload) {
    window.location.reload();
  }
}

void clearStaleFrontendCachesOnce();

// CSS is now loaded (import above is synchronous in the bundled output).
// Reveal content by adding css-ready — this disables the FOUC guard in index.html.
document.documentElement.classList.add("css-ready");

createRoot(document.getElementById("root")!).render(<App />);
