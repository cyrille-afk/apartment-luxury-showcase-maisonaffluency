import { describe, expect, it } from "vitest";
import { clampFloorExtension, clampFloorPatternScale } from "./visualiserFloorView";

describe("floor view settings", () => {
  it("defaults the floor extension to 8 m and clamps to 0–20 m", () => {
    expect(clampFloorExtension(undefined)).toBe(8);
    expect(clampFloorExtension(-3)).toBe(0);
    expect(clampFloorExtension(50)).toBe(20);
  });
  it("defaults pattern size to 100% within 50–200%", () => {
    expect(clampFloorPatternScale(undefined)).toBe(100);
    expect(clampFloorPatternScale(10)).toBe(50);
    expect(clampFloorPatternScale(400)).toBe(200);
  });
});
