import { expect, it } from "vitest";
import { quoteConfiguredPricePatch } from "./quoteConfiguredPrice";

it("persists Yoma's displayed configured net amount rather than omitting it", () => {
  expect(quoteConfiguredPricePatch({ netCents: 10056330, currency: "EUR", variantLabel: "255 × 70 × H 100 cm - Bleach Oak" })).toEqual({ unit_price_cents: 10056330, unit_price_currency: "EUR" });
});

it("does not invent a saved price when the renderer has none", () => {
  expect(quoteConfiguredPricePatch({ netCents: null, currency: "EUR", variantLabel: null })).toBeNull();
});