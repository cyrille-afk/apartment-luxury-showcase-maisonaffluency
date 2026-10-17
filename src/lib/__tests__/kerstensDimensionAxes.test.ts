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

  it.each([
    { product: "Mono STS", sizes: ["34 × 26 × H 40 cm", "42 × 32 × H 44 cm"], finishes: ["Brown Travertine", "White Onyx", "Muschel Type 'S'", "Grand Antique Marble"], separator: " — " },
    { product: "Rift CTS", sizes: ["W 108 × D 108 × H 28 cm", "W 128 × D 108 × H 28 cm", "W 148 × D 108 × H 28 cm", "W 168 × D 108 × H 28 cm"], finishes: ["Bleached oak or Smoked", "White washed oak or Ebonized Oak"], separator: " - " },
    { product: "Rift CTW Coffee Table", sizes: ["160 × 82 × H 28 cm", "180 × 82 × H 28 cm", "200 × 82 × H 28 cm", "220 × 82 × H 28 cm"], finishes: ["Bleached Oak or Smoked Oak", "White Washed Oak or Ebonized Oak"], separator: " - " },
    { product: "Yoma CLW Console", sizes: ["255 × 70 × H 100 cm"], finishes: ["Bleach Oak", "Ebonized Oak"], separator: " - " },
  ])("keeps $product dimensions distinct from its finish combinations", ({ sizes, finishes, separator }) => {
    const variants = finishes.flatMap((finish) => sizes.map((size) => ({
      label: `${size}${separator}${finish} `, base: "", top: "", price_cents: 0,
    })));
    const axes = computeVariantAxes(variants);
    expect(axes.hasSingleAxisSplit).toBe(true);
    expect(new Set(axes.singleSizeOptions)).toEqual(new Set(sizes));
    expect(axes.singleSizeOptions).toHaveLength(sizes.length);
    expect(new Set(axes.singleMaterialOptions)).toEqual(new Set(finishes));
    expect(axes.singleAxisParsed).toHaveLength(sizes.length * finishes.length);
  });
});