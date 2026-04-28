/**
 * Auto-update watcher.
 *
 * Polls /version.json periodically and reloads the app when the deployed
 * build id no longer matches the one stamped into index.html at build time.
 *
 * - Reads the current build id from <meta name="app-build-id">.
 * - Skips silently in dev (no /version.json is emitted by the dev server).
 * - Polls every 60s and on tab focus / regained network connectivity.
 * - Reloads with cache-bypass when a mismatch is detected.
 */

const POLL_INTERVAL_MS = 60_000;

let started = false;
let currentBuildId: string | null = null;

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

async function checkForUpdate() {
  if (!currentBuildId) return;
  const remote = await fetchRemoteBuildId();
  if (!remote) return;
  if (remote !== currentBuildId) {
    // Avoid reloading while the user is mid-input (forms, contenteditable).
    const active = document.activeElement as HTMLElement | null;
    const isEditing =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    if (isEditing) return;
    // Hard reload bypassing the bfcache.
    window.location.reload();
  }
}

export function startBuildVersionWatcher() {
  if (started) return;
  started = true;
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
