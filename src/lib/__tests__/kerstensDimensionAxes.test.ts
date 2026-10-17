import { describe, expect, it } from "vitest";
import { computeVariantAxes } from "../parseSizeVariants";

describe("Kerstens Mono CLS dimension and finish separation", () => {
  it("lists three sizes once while retaining all four finish combinations", () => {
    const sizes = ["80 × 42 × H 80 cm", "120 × 42 × H 80 cm", "160 × 42 × H 80 cm"];
    const finishes = ["Brown Travertine", "White Onyx", "Muschel Type 'S'", "Grand Antique Marble"];
    const variants = finishes.flatMap((finish) => sizes.map((size) => ({
      label: `${size} — ${finish}`, base: "", top: "", price_cents: 0,
    })));
    const axes = computeVariantAxes(variants);
    expect(axes.hasSingleAxisSplit).toBe(true);
    expect(axes.singleSizeOptions).toHaveLength(3);
    expect(new Set(axes.singleSizeOptions)).toEqual(new Set(sizes));
    expect(new Set(axes.singleMaterialOptions)).toEqual(new Set(finishes));
    expect(axes.singleAxisParsed).toHaveLength(12);
  });
});