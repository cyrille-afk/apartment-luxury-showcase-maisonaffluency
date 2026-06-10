import { useEffect, useRef } from "react";
import { toast } from "sonner";

function isDev(): boolean {
  if (import.meta.env.DEV) return true;
  if (typeof window === "undefined") return true;
  return false;
}

function hardReload() {
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
    if (isDev()) return;

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

    const onNav = () => {
      if (!armed.current) return;
      // Reload on next macrotask so the navigation commits first.
      setTimeout(hardReload, 0);
    };

    const onAvailable = () => {
      if (armed.current) return;
      armed.current = true;

      // Discreet toast fallback (no centered black pill).
      toast("A new version is available", {
        description: "It will load on your next page change.",
        duration: 12_000,
        action: {
          label: "Refresh now",
          onClick: hardReload,
        },
      });

      window.addEventListener("app:spa-navigation", onNav);
    };

    window.addEventListener("app:build-update-available", onAvailable);
    return () => {
      window.removeEventListener("app:build-update-available", onAvailable);
      window.removeEventListener("app:spa-navigation", onNav);
    };
  }, []);

  return null;
}
