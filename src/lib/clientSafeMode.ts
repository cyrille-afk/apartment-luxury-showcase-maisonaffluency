import { useSyncExternalStore } from "react";

/**
 * Client-Safe Mode.
 *
 * A single global switch a designer can flip before handing the phone to a
 * client: net pricing, tier discounts and margin disappear instantly across
 * the app, leaving only retail-facing information. Persisted so it survives a
 * PWA relaunch mid-meeting.
 */
const KEY = "ma_client_safe_mode";

let safe = (() => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
})();

// Set the document guard before React mounts, so lazy routes and retained exit
// animations cannot paint an internal price while Client View is restored.
function syncDocumentMask() {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.clientView = safe ? "active" : "inactive";
  }
}
syncDocumentMask();

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setClientSafeMode(next: boolean) {
  const changed = safe !== next;
  safe = next;
  syncDocumentMask();
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* private mode — session-only */
  }
  if (changed) emit();
}

export function getClientSafeMode() {
  return safe;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  // A drawer/route can unmount every subscriber while another tab changes
  // the preference. Reconcile on remount and PWA/browser resume as well.
  const restorePreference = () => {
    try {
      const next = window.localStorage.getItem(KEY) === "1";
      if (safe === next) return;
      safe = next;
      syncDocumentMask();
      emit();
    } catch {
      // Storage unavailable: retain the current session's explicit choice.
    }
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY || e.key === null) {
      safe = e.newValue === "1";
      syncDocumentMask();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", restorePreference);
  window.addEventListener("pageshow", restorePreference);
  restorePreference();
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", restorePreference);
    window.removeEventListener("pageshow", restorePreference);
  };
}

export function useClientSafeMode() {
  const enabled = useSyncExternalStore(subscribe, getClientSafeMode, () => false);
  return { clientSafe: enabled, setClientSafe: setClientSafeMode };
}
