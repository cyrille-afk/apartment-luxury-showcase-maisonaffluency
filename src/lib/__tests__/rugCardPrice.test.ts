import { describe, it, expect } from "vitest";
import { rugCardPriceCents } from "@/lib/rugPricing";

describe("rugCardPriceCents", () => {
  it("prices a 300 × 400 cm rug at €2,000/m² as €24,000", () => {
    expect(rugCardPriceCents({ category: "Rugs", price_per_sqm_cents: 200000, dimensions: "300 × 400 cm" })).toBe(2_400_000);
  });
  it("returns null for non-rugs so the flat price is kept", () => {
    expect(rugCardPriceCents({ category: "Tables", price_per_sqm_cents: 200000, dimensions: "300 × 400 cm" })).toBeNull();
  });
  it("returns null when no per-m² rate is set", () => {
    expect(rugCardPriceCents({ category: "Rugs", price_per_sqm_cents: null, dimensions: "300 × 400 cm" })).toBeNull();
  });
});
