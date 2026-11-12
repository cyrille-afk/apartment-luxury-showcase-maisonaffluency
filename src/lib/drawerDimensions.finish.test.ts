import { describe, it, expect } from "vitest";
import { finishFromVariantLabel, joinUniqueLabelSegments, dimensionsFromVariantLabel } from "./drawerDimensions";
const seurat = "Base: Amber Speckled Glass · Shade: Watercolour Paper · Ø 220 x H 375 mm · Ø 220 x H 375 mm ";
describe("drawer finish line", () => {
  it("drops size segments from the finish line", () => {
    expect(finishFromVariantLabel(seurat)).toBe("Base: Amber Speckled Glass · Shade: Watercolour Paper");
  });
  it("still finds the size once", () => { expect(dimensionsFromVariantLabel(seurat)).toBeTruthy(); });
  it("never repeats a size when saving", () => {
    expect(joinUniqueLabelSegments("Base: Glass · Ø 220 x H 375 mm", "Ø220 x H 375 mm")).toBe("Base: Glass · Ø 220 x H 375 mm");
  });
});
