import { useSyncExternalStore } from "react";

const DISMISSED_KEY = "ma_curated_pairings_dismissed_v1";
const listeners = new Set<() => void>();
let dismissedInMemory = false;

function isDismissed(): boolean {
  if (dismissedInMemory) return true;
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function dismiss() {
  dismissedInMemory = true;
  try {
    sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // Keep dismissal effective for this page even when storage is unavailable.
  }
  listeners.forEach((listener) => listener());
}

/** Tab-scoped shopping session; refreshes retain dismissal, new sessions do not. */
export function useCuratedPairingSession() {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  return { dismissed, dismiss };
}