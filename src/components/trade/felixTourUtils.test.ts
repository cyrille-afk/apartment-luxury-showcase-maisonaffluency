import { describe, expect, it, vi } from "vitest";
import { startFelixTour, hasPendingTourStart, clearTourStartRequest, TOUR_PENDING_KEY, markTourCompleted, consumeTourCompletion, TOUR_COMPLETED_KEY, quoteWorkspaceReady } from "./felixTourUtils";

describe("Step 6 to Step 7 presentation handoff", () => {
  it("restores Studio Mode only after Quotes replaces the previous product", () => {
    expect(quoteWorkspaceReady("/trade/products/sebastian-herkner-man-of-parts/praia-da-granja-coffee-table", false)).toBe(false);
    expect(quoteWorkspaceReady("/trade/quotes", false)).toBe(false);
    expect(quoteWorkspaceReady("/trade/quotes", true)).toBe(true);
  });
});

describe("tour launch handoff", () => {
  it("notifies the mounted tour without importing its React module", () => {
    const listener = vi.fn();
    window.addEventListener("felix-tour:start", listener);
    try {
      startFelixTour();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0]?.[0].type).toBe("felix-tour:start");
    } finally {
      window.removeEventListener("felix-tour:start", listener);
    }
  });

  it("keeps the restart request alive when no tour is mounted to hear the event", () => {
    clearTourStartRequest();
    expect(hasPendingTourStart()).toBe(false);
    window.dispatchEvent(new Event("felix-tour:start")); // swallowed: nothing mounted yet
    startFelixTour();
    expect(hasPendingTourStart()).toBe(true);
    clearTourStartRequest();
    expect(hasPendingTourStart()).toBe(false);
  });

  it("drops a restart request that was never picked up", () => {
    sessionStorage.setItem(TOUR_PENDING_KEY, String(Date.now() - 60_000));
    expect(hasPendingTourStart()).toBe(false);
    expect(sessionStorage.getItem(TOUR_PENDING_KEY)).toBeNull();
  });
});

describe("tour completion handoff", () => {
  it("drops a completion marker that was never claimed", () => {
    sessionStorage.setItem(TOUR_COMPLETED_KEY, String(Date.now() - 600_000));
    expect(consumeTourCompletion()).toBe(false);
    expect(sessionStorage.getItem(TOUR_COMPLETED_KEY)).toBeNull();
  });

  it("claims a finished walkthrough once and clears the marker", () => {
    markTourCompleted();
    expect(consumeTourCompletion()).toBe(true);
    expect(sessionStorage.getItem(TOUR_COMPLETED_KEY)).toBeNull();
  });

  it("keeps the note across a dashboard remount", () => {
    expect(consumeTourCompletion()).toBe(true);
  });

  it("does not repeat the confirmation after a refresh", async () => {
    vi.resetModules();
    const fresh = await import("./felixTourUtils");
    expect(fresh.consumeTourCompletion()).toBe(false);
  });
});
