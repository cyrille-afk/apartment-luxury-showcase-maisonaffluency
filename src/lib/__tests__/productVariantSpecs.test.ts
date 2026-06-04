import { describe, expect, it } from "vitest";
import { firstPublicVariantDimensionLabel } from "../productVariantSpecs";
import { formatVariantAxisLabel } from "../variantPlaceholders";

describe("product variant specs", () => {
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