import { describe, expect, it, vi } from "vitest";
import { startFelixTour } from "./felixTourUtils";

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
});