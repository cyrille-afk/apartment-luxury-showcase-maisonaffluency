import { describe, expect, it } from "vitest";
import { fitPlanLabel } from "./planLabels";

describe("fitPlanLabel", () => {
  it("truncates long names so they stay inside a small footprint", () => {
    const r = fitPlanLabel("Frenchmen Street Lounge Chair", 0.82, 0.77);
    expect(r.name.length * r.fontSize * 0.56).toBeLessThanOrEqual(0.82 * 0.88 + 1e-9);
  });
  it("keeps short names whole on large footprints", () => {
    expect(fitPlanLabel("Rift CTS", 1.08, 1.08).name).toBe("Rift CTS");
  });
});
