import { afterEach, describe, expect, it, vi } from "vitest";
import { sidebarTourId, tourTargetSelector, revealSidebarTourTarget, scrollSidebarTourTarget, TOUR_SIDEBAR_REVEAL } from "./tourSidebarTargets";
import { replayFelixTour, clearTourStartRequest, hasPendingTourStart } from "./felixTourUtils";
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });
describe("stable sidebar tour targets", () => {
  it("finds the same named navigation item after DOM reordering", () => {
    document.body.innerHTML = '<a data-tour-id="tour-quotes"></a><a data-tour-id="tour-collection"></a>';
    const collection = document.querySelector(tourTargetSelector("nav-collection"));
    if (!collection) throw new Error("Missing collection");
    document.body.prepend(collection);
    expect(document.querySelector(tourTargetSelector("nav-collection"))).toBe(collection);
    expect(sidebarTourId("/trade/quotes")).toBe("tour-quotes");
    expect(sidebarTourId("/trade/admin/procurement-ledger")).toBe("tour-procurement");
  });
  it("requests React-managed expansion and opens collapsed ancestor details", () => {
    document.body.innerHTML = '<details><summary>Section</summary><a data-tour-id="tour-projects"></a></details>';
    const listener = vi.fn(); window.addEventListener(TOUR_SIDEBAR_REVEAL, listener);
    expect(revealSidebarTourTarget("tour-projects")).toBe(document.querySelector('a'));
    expect(document.querySelector('details')?.open).toBe(true);
    expect(listener.mock.calls[0][0].detail).toBe("tour-projects");
    window.removeEventListener(TOUR_SIDEBAR_REVEAL, listener);
  });
  it("scrolls a target inside the sidebar viewport with nearest alignment", () => {
    document.body.innerHTML = '<div data-sidebar="content"><a data-tour-id="tour-quotes"></a></div>';
    const target = document.querySelector<HTMLElement>('a'); const container = target?.parentElement;
    if (!target || !container) throw new Error("Missing target");
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ top: 20, bottom: 200 } as DOMRect);
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({ top: 300, bottom: 340 } as DOMRect);
    target.scrollIntoView = vi.fn();
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    scrollSidebarTourTarget(target);
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    vi.unstubAllGlobals();
  });
  it("replay clears completion/progress, keeps sidebar order, and requests step one", () => {
    localStorage.setItem('felix_dashboard_tour_seen_v1','done'); localStorage.setItem('felix_tour_progress_v1','12'); localStorage.setItem('ma-sidebar-order-v1:test','custom');
    clearTourStartRequest(); replayFelixTour();
    expect(localStorage.getItem('felix_dashboard_tour_seen_v1')).toBeNull();
    expect(localStorage.getItem('felix_tour_progress_v1')).toBeNull();
    expect(localStorage.getItem('ma-sidebar-order-v1:test')).toBe('custom');
    expect(hasPendingTourStart()).toBe(true);
    clearTourStartRequest(); localStorage.removeItem('ma-sidebar-order-v1:test');
  });
});