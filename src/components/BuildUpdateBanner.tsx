import { useEffect, useRef } from "react";
import { toast } from "sonner";

const FABRICS_DRAFT_KEY = "trade-admin-fabrics:draft-v1";

const DO_NOT_INTERRUPT = [
  "/trade/axonometric",
  "/trade/visualiser",
  "/trade/mood-board",
  "/trade/tearsheet",
  "/trade/presentations",
  // Admin editors: reloading mid-edit loses in-progress work (fabrics library
  // under /trade/admin/fabrics, etc.). Block auto-reload across all admin
  // surfaces — including the ones that do NOT live under /trade/admin.
  "/trade/admin",
  "/trade/designers/admin",
  "/trade/collectibles/admin",
  "/trade/designers/instagram",
  "/trade/documents-admin",
  "/trade/quotes-admin",
  "/trade/description-writer",
  "/trade/journal",
];


const isProtectedPath = (p = typeof window !== "undefined" ? window.location.pathname : "") =>
  DO_NOT_INTERRUPT.some((r) => p === r || p.startsWith(r + "/"));

function hasFabricWorkInProgress(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(FABRICS_DRAFT_KEY) || window.localStorage.getItem(FABRICS_DRAFT_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw) as {
      adding?: boolean;
      editingId?: string | null;
      linkingId?: string | null;
      editDraft?: Record<string, unknown>;
      newRow?: Record<string, unknown>;
    };
    const hasText = (obj?: Record<string, unknown>) =>
      !!obj && ["name", "supplier", "description", "image_url", "tier", "price_per_lm_cents"].some((key) => {
        const value = obj[key];
        return typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
      });
    return !!draft.adding || !!draft.editingId || !!draft.linkingId || hasText(draft.editDraft) || hasText(draft.newRow);
  } catch {
    return false;
  }
}

function shouldSkipUpdateUi(): boolean {
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

async function hardReload() {
  if (hasFabricWorkInProgress()) return;
  if (isProtectedPath()) return;

  // Purge service workers + Cache Storage so the new build's HTML/JS is
  // actually fetched from the network on the next navigation. Without this,
  // a precached shell can keep serving the old bundle even after reload.
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
  } catch { /* noop */ }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => false)));
    }
  } catch { /* noop */ }

  // Cache-bust the navigation so intermediaries don't hand us the stale HTML.
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("v", Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/**
 * Discreet build-update notice.
 *
 * - Listens for `app:build-update-available` from buildVersionWatcher.
 * - Never reloads automatically on route changes; editors must remain intact.
 * - Shows a single sonner toast with a manual "Refresh now" action only when safe.
 */
export default function BuildUpdateBanner() {
  const armed = useRef(false);

  // Strip the `?v=<timestamp>` cache-buster left behind by hardReload() so the
  // visible/shareable URL stays clean after a build refresh.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (!url.searchParams.has("v")) return;
      url.searchParams.delete("v");
      const clean = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
      window.history.replaceState(window.history.state, "", clean);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    if (shouldSkipUpdateUi()) return;


    const onAvailable = () => {
      if (armed.current) return;
      armed.current = true;

      // In creative tools, never surface a refresh action mid-work. The update
      // remains pending until the user hard-refreshes manually when ready.
      if (isProtectedPath() || hasFabricWorkInProgress()) return;

      // Show at top-center so mobile/PWA users see it above the iOS home
      // indicator (default bottom-right sits under the system nav bar and is
      // effectively invisible on installed PWAs).
      const isNarrow = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
      toast("A new version is available", {
        description: "Refresh when you're ready.",
        duration: 20_000,
        position: isNarrow ? "top-center" : "bottom-right",
        action: {
          label: "Refresh now",
          onClick: (e) => {
            e?.preventDefault?.();
            void hardReload();
          },
        },
      });
    };

    window.addEventListener("app:build-update-available", onAvailable);
    return () => {
      window.removeEventListener("app:build-update-available", onAvailable);
    };
  }, []);

  return null;
}
