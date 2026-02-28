/**
 * Scroll to a section element by ID with consistent nav offset.
 * Uses pixel-based scrolling to avoid inconsistent scroll-margin behavior.
 */
export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const el = document.getElementById(id);
  if (!el) return;
  const navHeight = document.querySelector("nav")?.offsetHeight ?? 96;
  const y = el.getBoundingClientRect().top + window.scrollY - navHeight - 16;
  window.scrollTo({ top: Math.max(0, y), behavior });
}
