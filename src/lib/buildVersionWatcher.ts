/**
 * Auto-update watcher.
 *
 * Polls /version.json periodically and notifies the app when the deployed
 * build id no longer matches the one stamped into index.html at build time.
 *
 * - Reads the current build id from <meta name="app-build-id">.
 * - Skips silently in dev / Lovable preview (no app-controlled refreshes there).
 * - Polls every 60s and on tab focus / regained network connectivity.
 * - Never reloads automatically; the user controls refresh via the banner.
 */

const POLL_INTERVAL_MS = 60_000;
const DO_NOT_INTERRUPT = [
  "/trade/axonometric",
  "/trade/visualiser",
  "/trade/mood-board",
  "/trade/floor-plan",
  "/trade/tearsheet",
  "/trade/presentations",
];

let started = false;
let currentBuildId: string | null = null;

function isProtectedPath(): boolean {
  if (typeof window === "undefined") return false;
  const p = window.location.pathname;
  return DO_NOT_INTERRUPT.some((r) => p === r || p.startsWith(r + "/"));
}

function shouldSkipBuildWatcher(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return true;

  const host = window.location.hostname;
  const isLovablePreview =
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev");

  if (isLovablePreview) return true;

  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  return false;
}

function readMetaBuildId(): string | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector('meta[name="app-build-id"]');
  return el?.getAttribute("content") || null;
}

async function fetchRemoteBuildId(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { buildId?: string };
    return data?.buildId || null;
  } catch {
    return null;
  }
}

async function triggerPostDeployRescrape(newBuildId: string) {
  // Fire-and-forget. We use sessionStorage so multiple tabs / multiple
  // version checks during the same session don't pile up duplicate calls.
  // The edge function itself is also idempotent (it short-circuits when the
  // snapshot already matches the buildId), so a duplicate call is cheap.
  try {
    const key = "og-rescrape-fired-for";
    if (sessionStorage.getItem(key) === newBuildId) return;
    sessionStorage.setItem(key, newBuildId);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/post-deploy-rescrape`;
    // keepalive lets the request survive the imminent page reload below.
    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ buildId: newBuildId }),
    }).catch(() => {});
  } catch {
    /* noop */
  }
}

async function checkForUpdate() {
  if (!currentBuildId) return;
  const remote = await fetchRemoteBuildId();
  if (!remote) return;
  if (remote !== currentBuildId) {
    // Kick off the OG rescrape for this new deploy *before* anything else.
    triggerPostDeployRescrape(remote);
    // Notify the UI so it can show a "Reload to latest" banner. We do NOT
    // hard-reload automatically anymore — the user controls when to refresh
    // (the banner gives an immediate one-click action, see BuildUpdateBanner).
    window.dispatchEvent(
      new CustomEvent("app:build-update-available", {
        detail: { from: currentBuildId, to: remote },
      }),
    );
  }
}

export function startBuildVersionWatcher() {
  if (started) return;
  started = true;
  if (shouldSkipBuildWatcher()) return;
  if (isProtectedPath()) return;
  currentBuildId = readMetaBuildId();
  // No build id stamped → likely dev server. Nothing to watch.
  if (!currentBuildId) return;

  // Initial check shortly after boot
  setTimeout(checkForUpdate, 5_000);
  // Periodic polling
  setInterval(checkForUpdate, POLL_INTERVAL_MS);
  // Check when the tab regains focus or network comes back
  window.addEventListener("focus", checkForUpdate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
  window.addEventListener("online", checkForUpdate);
}
