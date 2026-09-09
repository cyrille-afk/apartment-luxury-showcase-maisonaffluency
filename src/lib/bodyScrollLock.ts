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
let lockedScrollY = 0;
let previousBodyStyles: Partial<Record<
  "overflow" | "position" | "top" | "left" | "right" | "width",
  string
>> = {};
let previousHtmlOverscroll = "";

export function lockBodyScroll() {
  if (typeof document === "undefined") return;
  if (locks === 0) {
    lockedScrollY = window.scrollY;
    previousBodyStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
    };
    previousHtmlOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";
    document.documentElement.style.overscrollBehavior = "none";
  }
  locks += 1;
}

export function unlockBodyScroll() {
  if (typeof document === "undefined") return;
  locks = Math.max(0, locks - 1);
  if (locks === 0) {
    const restoreY = lockedScrollY;
    document.body.style.overflow = previousBodyStyles.overflow ?? "";
    document.body.style.position = previousBodyStyles.position ?? "";
    document.body.style.top = previousBodyStyles.top ?? "";
    document.body.style.left = previousBodyStyles.left ?? "";
    document.body.style.right = previousBodyStyles.right ?? "";
    document.body.style.width = previousBodyStyles.width ?? "";
    document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
    previousBodyStyles = {};
    previousHtmlOverscroll = "";
    lockedScrollY = 0;
    window.scrollTo(0, restoreY);
  }
}

/** Emergency release — used on route changes so no overlay can strand the page. */
export function releaseBodyScroll() {
  if (typeof document === "undefined") return;
  const restoreY = locks > 0 ? lockedScrollY : window.scrollY;
  locks = 0;
  document.body.style.overflow = previousBodyStyles.overflow ?? "";
  document.body.style.position = previousBodyStyles.position ?? "";
  document.body.style.top = previousBodyStyles.top ?? "";
  document.body.style.left = previousBodyStyles.left ?? "";
  document.body.style.right = previousBodyStyles.right ?? "";
  document.body.style.width = previousBodyStyles.width ?? "";
  document.documentElement.style.overscrollBehavior = previousHtmlOverscroll;
  previousBodyStyles = {};
  previousHtmlOverscroll = "";
  lockedScrollY = 0;
  window.scrollTo(0, restoreY);
}
