import { useEffect, useRef } from "react";
import { toast } from "sonner";

const DO_NOT_INTERRUPT = [
  "/trade/axonometric",
  "/trade/visualiser",
  "/trade/mood-board",
  
  "/trade/tearsheet",
  "/trade/presentations",
];

const isProtectedPath = (p = typeof window !== "undefined" ? window.location.pathname : "") =>
  DO_NOT_INTERRUPT.some((r) => p === r || p.startsWith(r + "/"));

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

function hardReload() {
  if (isProtectedPath()) return;
  try {
    window.location.replace(
      window.location.pathname + window.location.search + window.location.hash,
    );
  } catch {
    window.location.reload();
  }
}

/**
 * Silent auto-update on next navigation, with a discreet toast fallback
 * for users who stay on the same page.
 *
 * - Listens for `app:build-update-available` from buildVersionWatcher.
 * - Reloads automatically on the next route change (pushState/replaceState/popstate)
 *   so the user never sees an "update available" prompt mid-flow.
 * - Shows a single sonner toast with a "Refresh now" action as a fallback.
 */
export default function BuildUpdateBanner() {
  const armed = useRef(false);

  useEffect(() => {
    if (shouldSkipUpdateUi()) return;

    // Patch history.pushState once so we can detect real SPA navigations.
    // We deliberately skip replaceState (used for in-page query-param updates
    // like filters/selections) and only treat path changes as navigations —
    // otherwise pages that sync state into the URL would reload mid-interaction.
    const w = window as unknown as { __mafBuildNavPatched?: boolean };
    if (!w.__mafBuildNavPatched) {
      w.__mafBuildNavPatched = true;
      let lastPath = window.location.pathname;
      const fireIfPathChanged = () => {
        const p = window.location.pathname;
        if (p !== lastPath) {
          lastPath = p;
          window.dispatchEvent(new Event("app:spa-navigation"));
        }
      };
      const origPush = history.pushState;
      history.pushState = function (...args) {
        const r = origPush.apply(this, args as Parameters<typeof origPush>);
        fireIfPathChanged();
        return r;
      };
      window.addEventListener("popstate", fireIfPathChanged);
    }

    const hasUnsavedTyping = () => {
      try {
        const ae = document.activeElement as HTMLElement | null;
        if (ae) {
          const tag = ae.tagName;
          if (tag === "TEXTAREA" || tag === "INPUT" || ae.isContentEditable) return true;
        }
        const fields = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea, input");
        for (const f of Array.from(fields)) {
          if ((f as HTMLInputElement).value && (f as HTMLInputElement).value.trim().length > 0) return true;
        }
      } catch {}
      return false;
    };

    const onNav = () => {
      if (!armed.current) return;
      if (hasUnsavedTyping()) return;
      // Skip reload if the user is still inside a long-running creative tool
      // (axonometric studio, visualiser, etc). We'll catch the next navigation.
      if (isProtectedPath(window.location.pathname)) return;
      // Reload on next macrotask so the navigation commits first.
      setTimeout(hardReload, 0);
    };

    const onAvailable = () => {
      if (armed.current) return;
      armed.current = true;

      window.addEventListener("app:spa-navigation", onNav);

      // In creative tools, never surface a refresh action mid-work. The update
      // remains armed and will load only after the user leaves the protected tool.
      if (isProtectedPath()) return;

      // Discreet toast fallback (no centered black pill).
      toast("A new version is available", {
        description: "It will load on your next page change.",
        duration: 12_000,
        action: {
          label: "Refresh now",
          onClick: hardReload,
        },
      });
    };

    window.addEventListener("app:build-update-available", onAvailable);
    return () => {
      window.removeEventListener("app:build-update-available", onAvailable);
      window.removeEventListener("app:spa-navigation", onNav);
    };
  }, []);

  return null;
}
