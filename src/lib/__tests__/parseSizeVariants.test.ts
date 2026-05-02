import { describe, it, expect } from "vitest";
import {
  parseSingleAxisLabel,
  computeVariantAxes,
  parseMaterialsFallback,
  type SizeVariant,
} from "../parseSizeVariants";

describe("parseSingleAxisLabel", () => {
  it("splits 'Prefix: <dimensions> <material>' (Angelo M/R example)", () => {
    expect(parseSingleAxisLabel("Angelo M/R 130: Ø 130 × H 75 cm Kynos")).toEqual({
      size: "Ø 130 × H 75 cm",
      material: "Kynos",
    });
  });

  it("handles multiple materials per same size", () => {
    const a = parseSingleAxisLabel("Angelo M/R 160: Ø 160 × H 75 cm Travertine");
    const b = parseSingleAxisLabel("Angelo M/R 160: Ø 160 × H 75 cm Marble");
    expect(a.size).toBe("Ø 160 × H 75 cm");
    expect(b.size).toBe("Ø 160 × H 75 cm");
    expect(a.material).toBe("Travertine");
    expect(b.material).toBe("Marble");
  });

  it("supports inches unit (word form)", () => {
    expect(parseSingleAxisLabel("Side table: 24 inches Oak")).toEqual({
      size: "24 inches",
      material: "Oak",
    });
  });

  it("supports mm units", () => {
    expect(parseSingleAxisLabel("Tray: 300 × 200 mm Brass")).toEqual({
      size: "300 × 200 mm",
      material: "Brass",
    });
  });

  it("falls back to symbolic split when no unit is present", () => {
    const { size, material } = parseSingleAxisLabel("Coffee: Ø 90 Walnut");
    expect(size).toBe("Ø 90");
    expect(material).toBe("Walnut");
  });

  it("never returns empty size for non-standard labels (no colon, no unit)", () => {
    const r = parseSingleAxisLabel("Custom Edition One");
    expect(r.size.length).toBeGreaterThan(0);
  });

  it("handles empty input safely", () => {
    expect(parseSingleAxisLabel("")).toEqual({ size: "", material: "" });
    expect(parseSingleAxisLabel("   ")).toEqual({ size: "", material: "" });
  });

  it("strips dangling separators between size and material", () => {
    const r = parseSingleAxisLabel("Lamp: 40 cm - Bronze");
    expect(r.size).toBe("40 cm");
    expect(r.material).toBe("Bronze");
  });

  it("keeps full label as size when only a prefix is present", () => {
    const r = parseSingleAxisLabel("Limited Edition");
    expect(r.size).toBe("Limited Edition");
    expect(r.material).toBe("");
  });
});

describe("computeVariantAxes — single-axis dedup", () => {
  it("dedupes the Angelo M/R catalogue (3 sizes × multiple materials)", () => {
    const variants: SizeVariant[] = [
      { label: "Angelo M/R 130: Ø 130 × H 75 cm Kynos", price_cents: 100 },
      { label: "Angelo M/R 130: Ø 130 × H 75 cm Travertine", price_cents: 110 },
      { label: "Angelo M/R 130: Ø 130 × H 75 cm Marble", price_cents: 120 },
      { label: "Angelo M/R 160: Ø 160 × H 75 cm Kynos", price_cents: 130 },
      { label: "Angelo M/R 160: Ø 160 × H 75 cm Travertine", price_cents: 140 },
      { label: "Angelo M/R 160: Ø 160 × H 75 cm Marble", price_cents: 150 },
      { label: "Angelo M/R 180: Ø 180 × H 75 cm Kynos", price_cents: 160 },
      { label: "Angelo M/R 180: Ø 180 × H 75 cm Travertine", price_cents: 170 },
      { label: "Angelo M/R 180: Ø 180 × H 75 cm Marble", price_cents: 180 },
    ];
    const axes = computeVariantAxes(variants);
    expect(axes.hasSingleAxisSplit).toBe(true);
    expect(axes.singleSizeOptions).toEqual([
      "Ø 130 × H 75 cm",
      "Ø 160 × H 75 cm",
      "Ø 180 × H 75 cm",
    ]);
    expect(axes.singleMaterialOptions).toEqual(["Kynos", "Travertine", "Marble"]);
    // No empty options ever
    expect(axes.singleSizeOptions.every(Boolean)).toBe(true);
    expect(axes.singleMaterialOptions.every(Boolean)).toBe(true);
  });

  it("does not split when labels are clean dimensions only", () => {
    const variants: SizeVariant[] = [
      { label: "Ø 130 cm" },
      { label: "Ø 160 cm" },
      { label: "Ø 180 cm" },
    ];
    const axes = computeVariantAxes(variants);
    expect(axes.hasSingleAxisSplit).toBe(false);
    expect(axes.hasVariants).toBe(true);
    expect(axes.isDualAxis).toBe(false);
  });

  it("treats base-only products as finish options, not hidden single-axis sizes", () => {
    const variants: SizeVariant[] = [
      { label: "L190 × W180 × H35 cm", base: "Top & Base in Onyx Honey", top: "" },
      { label: "L190 × W180 × H35 cm", base: "Top & Base in Red Onyx", top: "" },
      { label: "L190 × W180 × H35 cm", base: "Top in Lava Stone Creme Brulée & Base in Black Teak", top: "" },
    ];
    const axes = computeVariantAxes(variants);
    expect(axes.isDualAxis).toBe(false);
    expect(axes.isBaseOnly).toBe(true);
    expect(axes.baseOptions).toEqual([
      "Top & Base in Onyx Honey",
      "Top & Base in Red Onyx",
      "Top in Lava Stone Creme Brulée & Base in Black Teak",
    ]);
  });

  it("handles mixed/non-standard labels without dropping options", () => {
    const variants: SizeVariant[] = [
      { label: "Standard" },
      { label: "Large" },
      { label: "Custom Edition" },
    ];
    const axes = computeVariantAxes(variants);
    // Either no split (single axis = label) or split with no empty values
    expect(axes.singleSizeOptions.every(Boolean)).toBe(true);
    expect(axes.singleMaterialOptions.every(Boolean)).toBe(true);
  });

  it("returns empty arrays when there are no variants", () => {
    const axes = computeVariantAxes([]);
    expect(axes.hasVariants).toBe(false);
    expect(axes.singleSizeOptions).toEqual([]);
    expect(axes.singleMaterialOptions).toEqual([]);
    expect(axes.baseOptions).toEqual([]);
    expect(axes.topOptions).toEqual([]);
  });

  it("handles null/undefined input safely", () => {
    expect(computeVariantAxes(null).hasVariants).toBe(false);
    expect(computeVariantAxes(undefined).hasVariants).toBe(false);
  });
});

describe("computeVariantAxes — dual-axis", () => {
  it("dedupes base × top materials and sizes", () => {
    const variants: SizeVariant[] = [
      { label: "Small", base: "Oak", top: "Marble", price_cents: 100 },
      { label: "Small", base: "Oak", top: "Travertine", price_cents: 110 },
      { label: "Large", base: "Walnut", top: "Marble", price_cents: 200 },
      { label: "Large", base: "Walnut", top: "Marble", price_cents: 200 }, // duplicate
    ];
    const axes = computeVariantAxes(variants);
    expect(axes.isDualAxis).toBe(true);
    expect(axes.baseOptions).toEqual(["Oak", "Walnut"]);
    expect(axes.topOptions).toEqual(["Marble", "Travertine"]);
    expect(axes.dualSizeOptions).toEqual(["Small", "Large"]);
    // Never empty
    expect(axes.baseOptions.every(Boolean)).toBe(true);
    expect(axes.topOptions.every(Boolean)).toBe(true);
  });

  it("ignores empty base/top strings in dedup", () => {
    const variants: SizeVariant[] = [
      { label: "S", base: "Oak", top: "" },
      { label: "S", base: "", top: "Marble" },
    ];
    const axes = computeVariantAxes(variants);
    expect(axes.isDualAxis).toBe(true);
    expect(axes.baseOptions).toEqual(["Oak"]);
    expect(axes.topOptions).toEqual(["Marble"]);
  });
});

describe("parseMaterialsFallback — concatenated materials field", () => {
  it("splits the Clash Coffee Table example and sorts alphabetically", () => {
    expect(
      parseMaterialsFallback(
        "Cast Bronze Green Cast Bronze White Cast Bronze Black Cast Bronze"
      )
    ).toEqual([
      "Black Cast Bronze",
      "Cast Bronze",
      "Green Cast Bronze",
      "White Cast Bronze",
    ]);
  });

  it("collapses double-spaces and sorts alphabetically", () => {
    expect(
      parseMaterialsFallback("Cast Bronze  Green Cast  Bronze  White Cast  Bronze")
    ).toEqual(["Cast Bronze", "Green Cast Bronze", "White Cast Bronze"]);
  });

  it("splits on commas and sorts alphabetically", () => {
    expect(parseMaterialsFallback("Walnut, Oak, Brass")).toEqual(["Brass", "Oak", "Walnut"]);
  });

  it("splits on slashes and pipes and sorts alphabetically", () => {
    expect(parseMaterialsFallback("Travertine / Marble | Limestone")).toEqual([
      "Limestone",
      "Marble",
      "Travertine",
    ]);
  });

  it("returns single value when no separators or repeats are detected", () => {
    expect(parseMaterialsFallback("Solid Oak")).toEqual(["Solid Oak"]);
  });

  it("handles empty/null/undefined safely", () => {
    expect(parseMaterialsFallback("")).toEqual([]);
    expect(parseMaterialsFallback(null)).toEqual([]);
    expect(parseMaterialsFallback(undefined)).toEqual([]);
  });

  it("dedupes case-insensitively, keeping first-seen casing", () => {
    expect(parseMaterialsFallback("Oak, oak, OAK, Walnut")).toEqual(["Oak", "Walnut"]);
  });

  it("is deterministic — same input always yields same order", () => {
    const input = "Zinc, Brass, Copper, Aluminum";
    const a = parseMaterialsFallback(input);
    const b = parseMaterialsFallback(input);
    const c = parseMaterialsFallback("Brass, Aluminum, Zinc, Copper");
    expect(a).toEqual(b);
    expect(a).toEqual(c);
    expect(a).toEqual(["Aluminum", "Brass", "Copper", "Zinc"]);
  });

  it("sorts case-insensitively (lowercase and uppercase interleave naturally)", () => {
    expect(parseMaterialsFallback("brass, Aluminum, COPPER")).toEqual([
      "Aluminum",
      "brass",
      "COPPER",
    ]);
  });
});
