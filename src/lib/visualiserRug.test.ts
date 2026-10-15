import { describe, expect, it } from "vitest";
import { roundedRugGeometry, RUG_TOP_Y } from "./visualiserRug";

describe("soft rectangular rug", () => {
  it("is a flat large rectangle rather than an extruded organic body", () => {
    const g = roundedRugGeometry(4.5, 3.8);
    g.computeBoundingBox();
    expect(g.boundingBox?.min.x).toBeCloseTo(-2.25);
    expect(g.boundingBox?.max.y).toBeCloseTo(1.9);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) expect(p.getZ(i)).toBe(0);
    expect(RUG_TOP_Y).toBeGreaterThan(0);
    g.dispose();
  });
  it("rounds every corner without shrinking the long straight edges", () => {
    const g = roundedRugGeometry(4.5, 3.8);
    const p = g.getAttribute("position");
    let straight = false;
    for (let i = 0; i < p.count; i++) {
      expect(Math.abs(p.getX(i)) > 2.249 && Math.abs(p.getY(i)) > 1.899).toBe(false);
      if (Math.abs(p.getX(i)) > 2.249) straight = true;
    }
    expect(straight).toBe(true);
    g.dispose();
  });
});