import { describe, expect, it } from "vitest";
import { firstPublicVariantDimensionLabel } from "../productVariantSpecs";
import { formatVariantAxisLabel } from "../variantPlaceholders";
import { looksLikeDimension } from "../rugPricing";
import { computeVariantAxes } from "../parseSizeVariants";

describe("product variant specs", () => {
  it("recognizes the US Table's editor label without inventing units or duplicating sizes", () => {
    const label = "L.154,00 x l.88,00 x H.64,00 - 55kg";
    const variants = ["White Travertine", "Silver Travertine", "Pink Travertine"].map(base => ({ base, label }));
    expect(firstPublicVariantDimensionLabel(variants)).toBe(label);
    expect(looksLikeDimension(label)).toBe(true);
    expect(looksLikeDimension("H.64")).toBe(false);
    const axes = computeVariantAxes(variants);
    expect(axes.isBaseOnly).toBe(true);
    expect(axes.baseOptions).toHaveLength(3);
    expect(new Set(variants.map(v => v.label)).size).toBe(1);
  });
  it("uses the public variant dimension label before trade fallback dimensions", () => {
    const variants = [
      {
        top: "COM fabric",
        base: "Ebonised Ash Wood + Polished & Protected Materic Cast Bronze - B8",
        label: "W 79 cm × D 77 cm x H 67 cm",
        price_cents: 0,
      },
      {
        top: "COM fabric",
        base: "Ebonised Ash Wood + Black Patinated & Waxed Materic Cast Bronze - B4",
        label: "",
        price_cents: 0,
      },
    ];

    expect(firstPublicVariantDimensionLabel(variants)).toBe("W 79 cm × D 77 cm x H 67 cm");
  });

  it("normalizes the upholstery axis label everywhere it is displayed", () => {
    expect(formatVariantAxisLabel("Uphostery")).toBe("Upholstery");
  });
});