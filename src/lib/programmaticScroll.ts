import { useSyncExternalStore } from "react";

/**
 * Global signal marking an in-progress programmatic scroll (e.g. the hero
 * "Singapore Gallery Preview" jump). The navigation bar uses it to stay
 * visible instead of auto-hiding on the synthetic downward scroll.
 */
let active = false;
let releaseTimer: number | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function beginProgrammaticScroll(maxDurationMs = 8000) {
  if (typeof window === "undefined") return;
  if (releaseTimer !== undefined) window.clearTimeout(releaseTimer);
  if (!active) {
    active = true;
    emit();
  }
  releaseTimer = window.setTimeout(() => endProgrammaticScroll(), maxDurationMs);
}

export function endProgrammaticScroll() {
  if (typeof window !== "undefined" && releaseTimer !== undefined) {
    window.clearTimeout(releaseTimer);
    releaseTimer = undefined;
  }
  if (!active) return;
  active = false;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useProgrammaticScrollActive() {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false
  );
}
