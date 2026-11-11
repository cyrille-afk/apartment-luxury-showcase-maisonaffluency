export const TOUR_SIDEBAR_REVEAL = "trade-tour:reveal-sidebar";
export function sidebarTourId(path: string) {
  const names: Record<string, string> = { "/trade": "dashboard", "/trade/the-collection": "collection", "/trade/quotes": "quotes", "/trade/projects": "projects", "/trade/tools": "tools", "/trade/settings": "settings", "/trade/concierge": "concierge", "/trade/extension-sync": "extension-sync", "/trade/beta-feedboard": "beta-feedboard", "/trade/admin/procurement-ledger": "procurement" };
  return `tour-${names[path] ?? path.replace(/^\//, "").replace(/[^a-z0-9]+/g, "-")}`;
}
export function tourTargetSelector(target: string) {
  if (target === "sidebar-reorder") return '[data-tour-id="tour-sidebar-reorder"]';
  const sidebar: Record<string, string> = { "nav-collection": "collection", "nav-quotes": "quotes", "nav-tools": "tools", "nav-settings": "settings", "nav-concierge": "concierge", "sidebar-ai-sync": "extension-sync", "sidebar-beta-feedboard": "beta-feedboard", "sidebar-pwa": "pwa" };
  return sidebar[target] ? `[data-tour-id="tour-${sidebar[target]}"]` : `[data-felix-target="${target}"]`;
}
export function revealSidebarTourTarget(id: string): HTMLElement | null {
  window.dispatchEvent(new CustomEvent(TOUR_SIDEBAR_REVEAL, { detail: id }));
  const target = document.querySelector<HTMLElement>(`[data-tour-id="${id}"]`);
  if (!target) return null;
  let parent = target.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    const control = parent.querySelector<HTMLElement>(':scope > [aria-expanded="false"], :scope > [data-tour-expand] [aria-expanded="false"]');
    control?.click();
    parent = parent.parentElement;
  }
  return target;
}
export function scrollSidebarTourTarget(target: HTMLElement) {
  const container = target.closest<HTMLElement>('[data-sidebar="content"]');
  if (!container) return;
  const box = target.getBoundingClientRect(), frame = container.getBoundingClientRect();
  if (box.top < frame.top || box.bottom > frame.bottom) target.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "nearest", inline: "nearest" });
}