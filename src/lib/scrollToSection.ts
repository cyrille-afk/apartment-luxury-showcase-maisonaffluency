/**
 * Scroll to a section element by ID with consistent nav offset.
 * Uses pixel-based scrolling to avoid inconsistent scroll-margin behavior.
 */
export function scrollToSection(id: string, behavior: ScrollBehavior = "smooth") {
  const el = document.getElementById(id);
  if (!el) return;
  // Use a fixed nav height estimate to avoid forced reflow from offsetHeight
  const navHeight = 96;
  const y = el.getBoundingClientRect().top + window.scrollY - navHeight + 2;
  window.scrollTo({ top: Math.max(0, y), behavior });
}
