import { describe, expect, it } from "vitest";
import {
  dimensionsFromMotionLabel,
  motionValueFromVariantLabel,
  resolveProductMotionOptions,
  variantLabelForMotion,
} from "@/lib/productMotionOptions";

const KOUMAC_VARIANTS = [
  { base: "Polished Brass", top: "COM", label: "W 104 x D 106 x H 71 cm", price_cents: 1110000 },
  { base: "Polished Brass", top: "COM", label: "Swivel W 104 x D 106 x H 71 cm", price_cents: 1240000 },
  { base: "Polished Brass", top: "Sheepskin", label: "W 104 x D 106 x H 71 cm", price_cents: 2060000 },
  { base: "Polished Brass", top: "Sheepskin", label: "Swivel W 104 x D 106 x H 71 cm", price_cents: 2210000 },
];

describe("product motion options", () => {
  it("detects matching swivel and fixed variants and extracts dimensions", () => {
    expect(resolveProductMotionOptions(KOUMAC_VARIANTS)).toEqual({
      dimensions: "W 104 x D 106 x H 71 cm",
      fixedVariantLabel: "W 104 x D 106 x H 71 cm",
      swivelVariantLabel: "Swivel W 104 x D 106 x H 71 cm",
    });
  });

  it("maps the selected motion to the exact priced variant label", () => {
    const options = resolveProductMotionOptions(KOUMAC_VARIANTS);
    expect(options).not.toBeNull();
    if (!options) return;
    expect(variantLabelForMotion(options, "fixed")).toBe("W 104 x D 106 x H 71 cm");
    expect(variantLabelForMotion(options, "swivel")).toBe("Swivel W 104 x D 106 x H 71 cm");
  });

  it("does not create a motion control without both matching choices", () => {
    expect(resolveProductMotionOptions([KOUMAC_VARIANTS[0]])).toBeNull();
  });

  it("normalizes swivel labels without losing the metric dimensions", () => {
    expect(motionValueFromVariantLabel("Swivel W 104 x D 106 x H 71 cm")).toBe("swivel");
    expect(dimensionsFromMotionLabel("Swivel W 104 x D 106 x H 71 cm")).toBe("W 104 x D 106 x H 71 cm");
  });
});