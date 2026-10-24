import { describe, expect, it, vi } from "vitest";
import { startFelixTour, hasPendingTourStart, clearTourStartRequest, TOUR_PENDING_KEY, markTourCompleted, consumeTourCompletion, TOUR_COMPLETED_KEY } from "./felixTourUtils";

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
