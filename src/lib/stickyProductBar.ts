import { useSyncExternalStore } from "react";

/**
 * Tiny global signal so the product sticky header can tell the global
 * navigation to stay out of the way while it owns the top of the viewport.
 */
let active = false;
const listeners = new Set<() => void>();

export function setStickyProductBarActive(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStickyProductBarActive() {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false
  );
}
