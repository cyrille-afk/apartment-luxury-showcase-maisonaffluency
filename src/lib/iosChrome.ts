/**
 * iOS browser/PWA chrome backing.
 *
 * Only dark routes (hero landing, designers landing) should paint a black
 * canvas + bottom gradient behind the iOS toolbar. Light routes (designer
 * biography, product pages) must keep the page surface, otherwise a black
 * compartment appears behind the iOS navigation panel.
 */
const DARK_CLASS = "ios-chrome-dark";
const IMAGE_CLASS = "ios-chrome-image";

function setThemeColor(color: string) {
  if (typeof document === "undefined") return;
  const meta = document.getElementById("mobile-theme-color");
  if (meta) meta.setAttribute("content", color);
}

export function setDarkIosChrome() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove(IMAGE_CLASS);
  html.style.removeProperty("--ios-chrome-image");
  html.classList.add(DARK_CLASS);
  html.style.setProperty("--ios-chrome-base", "#000000");
  setThemeColor("#000000");
}

export function setImageIosChrome(imageUrl: string) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove(DARK_CLASS);
  html.classList.add(IMAGE_CLASS);
  html.style.removeProperty("--ios-chrome-base");
  html.style.setProperty("--ios-chrome-image", `url("${imageUrl}")`);
  setThemeColor("#31312d");
}

export function clearDarkIosChrome() {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.classList.remove(DARK_CLASS);
  html.classList.remove(IMAGE_CLASS);
  html.style.removeProperty("--ios-chrome-base");
  html.style.removeProperty("--ios-chrome-image");
  setThemeColor("#ffffff");
}
