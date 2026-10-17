import { describe, expect, it } from "vitest";
import { picturedFinishesForImage } from "../picturedFinishes";
describe("pictured finishes", () => {
  it("keeps Yoma wood, stone and metal pictured together", () => {
    const finishes = ["Wood", "Stone", "Metal"].map(category => ({ category, image_indices: [1, 2, 3] }));
    expect(picturedFinishesForImage(finishes, 0)).toEqual(finishes);
  });
  it("uses one-based mappings and excludes unpictured finishes", () => {
    const brown = { category: "Stone", image_indices: [1, 2, 3] };
    const white = { category: "Stone", image_indices: [1, 4, 5] };
    expect(picturedFinishesForImage([brown, white, { category: "Stone", image_indices: null }], 1)).toEqual([brown]);
    expect(picturedFinishesForImage([brown, white], 3)).toEqual([white]);
  });
  it("still hides generic all-colourway slides", () => {
    const finishes = Array.from({ length: 4 }, () => ({ category: "Wood", image_indices: [9] }));
    expect(picturedFinishesForImage(finishes, 8)).toEqual([]);
    expect(picturedFinishesForImage(finishes, 8, true)).toEqual(finishes);
  });
  it("does not invent finishes on an unmapped logo", () => {
    expect(picturedFinishesForImage([{ category: "Wood", image_indices: [1, 2] }], 15)).toEqual([]);
  });
});
