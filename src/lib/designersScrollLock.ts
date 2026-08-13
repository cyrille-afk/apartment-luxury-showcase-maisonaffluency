export const DESIGNERS_SCROLL_LOCK_ATTR = "data-designers-landing-scroll-lock";

function removeInlineScrollPin(html: HTMLElement, body: HTMLElement) {
  html.style.removeProperty("overflow");
  html.style.removeProperty("overscroll-behavior");
  html.style.removeProperty("height");
  html.style.removeProperty("--designers-landing-vh");
  html.style.removeProperty("--ios-chrome-base");


  body.style.removeProperty("overflow");
  body.style.removeProperty("overscroll-behavior");
  body.style.removeProperty("background-color");
  body.style.removeProperty("position");
  body.style.removeProperty("top");
  body.style.removeProperty("left");
  body.style.removeProperty("right");
  body.style.removeProperty("width");
  body.style.removeProperty("height");
  body.style.removeProperty("min-height");
}

export function markDesignersLandingScrollLock() {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute(DESIGNERS_SCROLL_LOCK_ATTR, "true");
  document.body.setAttribute(DESIGNERS_SCROLL_LOCK_ATTR, "true");
}

export function releaseDesignersLandingScrollLock() {
  if (typeof document === "undefined") return;

  const html = document.documentElement;
  const body = document.body;
  const marked =
    html.getAttribute(DESIGNERS_SCROLL_LOCK_ATTR) === "true" ||
    body.getAttribute(DESIGNERS_SCROLL_LOCK_ATTR) === "true";
  const legacyPinned =
    body.style.position === "fixed" &&
    (body.style.height.includes("--designers-landing-vh") ||
      body.style.minHeight.includes("--designers-landing-vh") ||
      html.style.getPropertyValue("--designers-landing-vh"));

  if (marked || legacyPinned) removeInlineScrollPin(html, body);

  html.removeAttribute(DESIGNERS_SCROLL_LOCK_ATTR);
  body.removeAttribute(DESIGNERS_SCROLL_LOCK_ATTR);
}