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

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setClientSafeMode(next: boolean) {
  if (safe === next) return;
  safe = next;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* private mode — session-only */
  }
  emit();
}

export function getClientSafeMode() {
  return safe;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      safe = e.newValue === "1";
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useClientSafeMode() {
  const enabled = useSyncExternalStore(subscribe, getClientSafeMode, () => false);
  return { clientSafe: enabled, setClientSafe: setClientSafeMode };
}
