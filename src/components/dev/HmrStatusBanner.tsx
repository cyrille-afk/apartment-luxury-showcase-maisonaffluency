import { useEffect, useState } from "react";

/**
 * Dev-only banner that surfaces when Vite's HMR connection has gone stale
 * (server restart, network blip, long idle). Production builds render nothing.
 *
 * Detection strategy:
 *  - Listen for `vite:beforeFullReload` and `vite:invalidate` (recoverable).
 *  - Listen for `vite:ws:disconnect` and `vite:ws:connect`.
 *  - If disconnected > 4s without reconnecting, show the banner.
 *  - Also surface uncaught dynamic-import / chunk-load errors which are the
 *    classic symptom of a stale bundle after a redeploy.
 */
export default function HmrStatusBanner() {
  const [stale, setStale] = useState(false);
  const [reason, setReason] = useState<string>("Dev connection lost");

  useEffect(() => {
    if (!import.meta.hot) return;

    let disconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const clearDisconnectTimer = () => {
      if (disconnectTimer) {
        clearTimeout(disconnectTimer);
        disconnectTimer = null;
      }
    };

    const markStale = (msg: string) => {
      setReason(msg);
      setStale(true);
    };

    const onDisconnect = () => {
      clearDisconnectTimer();
      disconnectTimer = setTimeout(() => {
        markStale("HMR disconnected — preview may be out of date");
      }, 4000);
    };

    const onConnect = () => {
      clearDisconnectTimer();
      // Don't auto-clear once shown — user should reload.
    };

    const onInvalidate = () => {
      markStale("Modules invalidated — reload to pick up changes");
    };

    import.meta.hot.on("vite:ws:disconnect", onDisconnect);
    import.meta.hot.on("vite:ws:connect", onConnect);
    import.meta.hot.on("vite:invalidate", onInvalidate);

    // Catch chunk/import failures that indicate a stale bundle
    const onError = (e: ErrorEvent) => {
      const m = String(e?.message || "");
      if (
        /Failed to fetch dynamically imported module/i.test(m) ||
        /Importing a module script failed/i.test(m) ||
        /ChunkLoadError/i.test(m) ||
        /Loading chunk \d+ failed/i.test(m)
      ) {
        markStale("A code chunk failed to load — reload to refresh");
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const m = String((e?.reason && (e.reason as Error).message) || e?.reason || "");
      if (
        /Failed to fetch dynamically imported module/i.test(m) ||
        /Importing a module script failed/i.test(m) ||
        /ChunkLoadError/i.test(m)
      ) {
        markStale("A code chunk failed to load — reload to refresh");
      }
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      clearDisconnectTimer();
      try {
        import.meta.hot?.off?.("vite:ws:disconnect", onDisconnect);
        import.meta.hot?.off?.("vite:ws:connect", onConnect);
        import.meta.hot?.off?.("vite:invalidate", onInvalidate);
      } catch {
        /* no-op */
      }
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  if (!import.meta.hot) return null;
  if (!stale) return null;

  const safeReload = () => {
    // Hard reload bypassing bfcache; warn if user is editing.
    const active = document.activeElement as HTMLElement | null;
    const editing =
      active &&
      (active.tagName === "INPUT" ||
        active.tagName === "TEXTAREA" ||
        active.isContentEditable);
    if (editing) {
      const ok = window.confirm(
        "You appear to be editing a field. Reload the preview anyway?"
      );
      if (!ok) return;
    }
    window.location.reload();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 2147483646,
        background: "rgba(20,20,20,0.95)",
        color: "#fff",
        padding: "10px 14px",
        borderRadius: 999,
        fontFamily:
          "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        fontSize: 13,
        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: "92vw",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#f59e0b",
          boxShadow: "0 0 0 4px rgba(245,158,11,0.2)",
        }}
      />
      <span style={{ opacity: 0.95 }}>{reason}</span>
      <button
        type="button"
        onClick={safeReload}
        style={{
          marginLeft: 4,
          background: "#fff",
          color: "#111",
          border: "none",
          padding: "6px 10px",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Reload
      </button>
      <button
        type="button"
        onClick={() => setStale(false)}
        aria-label="Dismiss"
        style={{
          background: "transparent",
          color: "#bbb",
          border: "none",
          padding: "4px 6px",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}
