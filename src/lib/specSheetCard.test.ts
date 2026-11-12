import { describe, expect, it } from "vitest";
import { specDimensions, specClientPriceCents, specFinishes, cleanSpecDescription, SPEC_DIMENSIONS_PLACEHOLDER } from "./specSheetCard";
describe("spec sheet card mapping", () => {
  it("formats dimensions as W × D × H cm", () => expect(specDimensions({ dimensions: "W46,5 x D52 x H96 cm" })).toBe("W 46.5 × D 52 × H 96 cm"));
  it("uses variant dimensions when the product has none", () => expect(specDimensions({ size_variants: [{ label: "W 150 × D 40.5 × H 91 cm" }] })).toBe("W 150 × D 40.5 × H 91 cm"));
  it("shows a placeholder when no dimensions exist", () => expect(specDimensions({})).toBe(SPEC_DIMENSIONS_PLACEHOLDER));
  it("prices from the default variant instead of Price upon Request", () => expect(specClientPriceCents({ rrp_price_cents: null, size_variants: [{ price_cents: 3787600 }] })).toBe(3787600));
  it("never falls back to net trade price", () => expect(specClientPriceCents({ trade_price_cents: 100 } as never)).toBeNull());
  it("reads finishes from the default variant", () => expect(specFinishes({ size_variants: [{ base: "Bronze", top: "Cast Glass" }] })).toEqual(["Bronze", "Cast Glass"]));
  it("strips SEO suffixes from meta fallback", () => expect(cleanSpecDescription({ meta_description: "A bronze console | Maison Affluency" })).toBe("A bronze console"));
  it("treats dimensions stored in a variant field as dimensions, not a finish", () => { const p = { size_variants: [{ label: "Bouclé", base: "W 190 × D 100 × H 70 cm" }] }; expect(specDimensions(p)).toBe("W 190 × D 100 × H 70 cm"); expect(specFinishes(p)).toEqual([]); });
  it("uses the priced variant size and ignores model names like M/H", () => expect(specDimensions({ dimensions: "Angelo M/H 90: Ø 90 × 92 cm", size_variants: [{ base: "Ø 90 × H 92 cm", top: "Kynos", price_cents: 1 }] })).toBe("Ø 90 × H 92 cm"));
});
