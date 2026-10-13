import { describe, expect, it } from "vitest";
import { visualiserDimensions } from "./visualiserProductMetadata";

describe("Visualiser recorded dimensions", () => {
  it("reads canonical millimetres from selected canvas state", () => {
    expect(visualiserDimensions({ dimensions: "900 x 770 x 750 MM" })).toBe("900 × 770 × 750 mm");
  });
  it("hydrates the actual Frenchmen lounge chair from linked size variants", () => {
    expect(visualiserDimensions({ dimensions: null }, { size_variants: [{ label: "W 82 × D 77 × H 73 cm — SH 41 cm" }] })).toBe("820 × 770 × 730 mm");
  });
  it("reads structured dimensions from the active object", () => {
    expect(visualiserDimensions({ width_mm: 900, depth_mm: 770, height_mm: 750 })).toBe("900 × 770 × 750 mm");
  });
  it("does not invent dimensions when nothing is recorded", () => {
    expect(visualiserDimensions({ dimensions: null })).toBeNull();
  });
});