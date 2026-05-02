import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";

/**
 * Floating "Reload to latest" banner.
 *
 * Listens for the `app:build-update-available` event dispatched by
 * `buildVersionWatcher` whenever a newer deployed build id is detected,
 * and gives the user a one-click action to hard-reload immediately
 * (bypassing bfcache). The banner is dismissible — if the user dismisses
 * it, it will reappear on the next detected build change.
 */
export default function BuildUpdateBanner() {
  const [available, setAvailable] = useState(false);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    const onAvailable = () => setAvailable(true);
    window.addEventListener("app:build-update-available", onAvailable);
    return () =>
      window.removeEventListener("app:build-update-available", onAvailable);
  }, []);

  if (!available) return null;

  const reload = () => {
    setReloading(true);
    // Hard reload, busting any HTTP cache.
    try {
      // Replace so the back button doesn't bring back the stale page.
      window.location.replace(
        window.location.pathname + window.location.search + window.location.hash,
      );
    } catch {
      window.location.reload();
    }
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-3 rounded-full border border-border bg-background/95 backdrop-blur shadow-2xl px-4 py-2.5 print:hidden animate-fade-in"
    >
      <span className="font-body text-sm text-foreground">
        A new version of Maison Affluency is available.
      </span>
      <button
        type="button"
        onClick={reload}
        disabled={reloading}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground text-background px-3 py-1.5 font-body text-xs uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${reloading ? "animate-spin" : ""}`}
          aria-hidden="true"
        />
        Reload to latest
      </button>
      <button
        type="button"
        onClick={() => setAvailable(false)}
        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full"
        aria-label="Dismiss"
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
