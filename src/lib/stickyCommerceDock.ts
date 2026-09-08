import { useSyncExternalStore } from "react";

/**
 * Tiny global signal so the mobile/PWA commerce dock can tell other UI
 * components (e.g., the product image floating action button) to move out of
 * the way while it owns the bottom of the viewport.
 */
let active = false;
const listeners = new Set<() => void>();

export function setStickyCommerceDockActive(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStickyCommerceDockActive() {
  return useSyncExternalStore(
    subscribe,
    () => active,
    () => false
  );
}
