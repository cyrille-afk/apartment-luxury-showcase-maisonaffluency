import { useSyncExternalStore } from "react";

/**
 * Tiny global signal so the mobile/PWA commerce dock can tell other UI
 * components (e.g., the product image floating action button) how much of the
 * bottom of the viewport it currently occupies.
 *
 * We publish the dock's MEASURED height (including its iOS safe-area padding)
 * rather than a boolean, because a hardcoded offset (`bottom-24`) collides with
 * the dock as soon as Iisos Safari's collapsing toolbar changes the visual
 * viewport, or the dock grows to two lines of price copy.
 */
let height = 0;
const listeners = new Set<() => void>();

/** Publish the dock's occupied height in CSS px. 0 = dock not owning the bottom. */
export function setStickyCommerceDockHeight(next: number) {
  const rounded = Math.max(0, Math.round(next));
  if (height === rounded) return;
  height = rounded;
  listeners.forEach((l) => l());
}

export function setStickyCommerceDockActive(next: boolean) {
  if (!next) setStickyCommerceDockHeight(0);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useStickyCommerceDockHeight() {
  return useSyncExternalStore(
    subscribe,
    () => height,
    () => 0
  );
}

export function useStickyCommerceDockActive() {
  return useStickyCommerceDockHeight() > 0;
}
