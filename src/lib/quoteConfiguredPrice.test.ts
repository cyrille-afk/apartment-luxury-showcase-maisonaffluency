import { expect, it } from "vitest";
import { quoteConfiguredPricePatch } from "./quoteConfiguredPrice";
import { quoteLinePricing } from "./quoteLineSummary";

it("persists Yoma's displayed configured net amount rather than omitting it", () => {
  expect(quoteConfiguredPricePatch({ netCents: 10056330, currency: "EUR", variantLabel: "x" })).toEqual({ unit_price_cents: 10056330, unit_price_currency: "EUR", fabric_upcharge_cents: null });
});

it("does not invent a saved price when the renderer has none", () => {
  expect(quoteConfiguredPricePatch({ netCents: null, currency: "EUR", variantLabel: null })).toBeNull();
});

it("keeps the fabric surcharge so upholstered pieces retain net and retail prices", () => {
  // RRP 5,000 base, 10% benefit, 1,000 fabric → net 5,500, retail 6,000
  const patch = quoteConfiguredPricePatch({ netCents: 550000, currency: "EUR", variantLabel: null }, { upchargeCents: 100000, currency: "EUR" })!;
  expect(patch).toEqual({ unit_price_cents: 450000, unit_price_currency: "EUR", fabric_upcharge_cents: 100000 });
  const line = { ...patch, quantity: 1, fabric_id: "f", fabric_currency: "EUR", fabric: { price_per_lm_cents: 5000 }, product: { rrp_price_cents: 500000, currency: "EUR" } };
  expect(quoteLinePricing(line as any, false)?.unitCents).toBe(550000);
  expect(quoteLinePricing(line as any, true)?.unitCents).toBe(600000);
});
