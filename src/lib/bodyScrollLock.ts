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
let previousBodyOverflow = "";
let previousHtmlOverflow = "";
let previousHtmlOverscroll = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (locks === 0) {
    previousBodyOverflow = document.body.style.overflow;
    previousHtmlOverflow = document.documentElement.style.overflow;
    previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.documentElement.style.overscrollBehavior = "none";
  }
  locks += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overflow = previousHtmlOverflow;
    document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    previousBodyOverflow = "";
    previousHtmlOverflow = "";
    previousHtmlOverscroll = "";
  }
}

/** Emergency release — used on route changes so no overlay can strand the page. */
export function releaseBodyScroll() {
  if (typeof document === "undefined") return;
  locks = 0;
  document.body.style.overflow = previousBodyOverflow;
  document.documentElement.style.overflow = previousHtmlOverflow;
  document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
  previousBodyOverflow = "";
  previousHtmlOverflow = "";
  previousHtmlOverscroll = "";
}
