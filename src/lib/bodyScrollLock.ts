/**
 * Ref-counted body scroll lock.
 *
 * Several overlays (mini-cart drawer in the header, the product CTA drawer,
 * modals) can be mounted at once. Each one naively saving/restoring
 * `document.body.style.overflow` leaves the page permanently locked when two
 * overlays overlap — the second one restores the first one's "hidden".
 * This shared counter guarantees the lock is released exactly once.
 */
let locks = 0;
let previous = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (locks === 0) {
    previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  locks += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.body.style.overflow = previous;
    previous = "";
  }
}

/** Emergency release — used on route changes so no overlay can strand the page. */
export function releaseBodyScroll() {
  if (typeof document === "undefined") return;
  locks = 0;
  previous = "";
  document.body.style.overflow = "";
}
