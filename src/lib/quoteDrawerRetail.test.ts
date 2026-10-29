import { describe, expect, it } from "vitest";
import { quoteDrawerRetail } from "./quoteDrawerRetail";

const product = { rrp_price_cents: 2250000, currency: "EUR" };
describe("saved quote drawer retail", () => {
  it("keeps €22,500 retail for a configured fixed-price base", () => {
    expect(quoteDrawerRetail({ product, variant_label: "Solid Oak" })).toEqual({ cents: 2250000, currency: "EUR" });
  });
  it("adds the saved upholstery surcharge, not the fabric's current price", () => {
    expect(quoteDrawerRetail({ product, variant_label: "Solid Oak", fabric_id: "teddy", fabric_upcharge_cents: 10000, fabric_currency: "EUR", fabric: { price_per_lm_cents: 99900 } })).toEqual({ cents: 2260000, currency: "EUR" });
  });
  it("resolves the selected model rather than the cheaper starting size", () => {
    expect(quoteDrawerRetail({ product: { ...product, size_variants: [{ label: "Saint Honoré 240", price_cents: 1460000 }, { label: "Saint Honoré 280", price_cents: 2050000 }] }, variant_label: "Saint Honoré 280 · Solid Oak" })?.cents).toBe(2050000);
  });
  it("matches every selected variant axis", () => {
    expect(quoteDrawerRetail({ product: { ...product, size_variants: [{ base: "Oak", top: "Marble", size: "280 cm", price_cents: 2260000 }, { base: "Oak", top: "Glass", size: "280 cm", price_cents: 2000000 }] }, variant_label: "Oak · Marble · 280 cm" })?.cents).toBe(2260000);
  });
  it("does not invent retail for missing or ambiguous selected variants", () => {
    const variants = [{ base: "Oak", top: "Marble", price_cents: 2260000 }, { base: "Oak", top: "Glass", price_cents: 2000000 }];
    expect(quoteDrawerRetail({ product: { ...product, size_variants: variants }, variant_label: "Oak" })).toBeNull();
    expect(quoteDrawerRetail({ product: { ...product, size_variants: [variants[0], variants[0]] }, variant_label: "Oak · Marble" })).toBeNull();
  });
  it("keeps catalogue retail when variant prices are all unspecified", () => {
    expect(quoteDrawerRetail({ product: { ...product, size_variants: [{ label: "Oak", price_cents: 0 }] }, variant_label: "Oak" })?.cents).toBe(2250000);
  });
  it("honours a known frame-price override", () => {
    expect(quoteDrawerRetail({ product, variant_label: "Walnut", woodRetail: { cents: 2300000, currency: "EUR" } })?.cents).toBe(2300000);
  });
  it("does not mis-add surcharges or frame prices from another currency", () => {
    expect(quoteDrawerRetail({ product, fabric_upcharge_cents: 10000, fabric_currency: "USD" })).toBeNull();
    expect(quoteDrawerRetail({ product, woodRetail: { cents: 2300000, currency: "USD" } })).toBeNull();
  });
  it("does not use net amounts as retail when the retail basis is absent", () => {
    const saved = { product: { currency: "EUR", rrp_price_cents: null }, unit_price_cents: 2034000, variant_label: "Solid Oak" };
    expect(quoteDrawerRetail(saved)).toBeNull();
  });
  it("does not recompute a missing saved fabric surcharge from today's rates", () => {
    expect(quoteDrawerRetail({ product, fabric_id: "teddy", fabric: { price_per_lm_cents: 10000 } })).toBeNull();
  });
});