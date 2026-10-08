import { describe, it, expect } from "vitest";
import { resolveQuoteLinePrice } from "./quoteLinePrice";

describe("resolveQuoteLinePrice", () => {
  it("keeps the saved line price and marks it as quote-sourced", () => {
    const r = resolveQuoteLinePrice(904100, { trade_price_cents: 500000, rrp_price_cents: 600000 });
    expect(r).toEqual({ unit_price_cents: 904100, price_source: "quote" });
  });

  it("falls back to the catalogue trade price when the line has none", () => {
    const r = resolveQuoteLinePrice(null, { trade_price_cents: 534100, rrp_price_cents: 534100 });
    expect(r).toEqual({ unit_price_cents: 534100, price_source: "catalogue" });
  });

  it("uses rrp_price_cents when trade_price_cents is missing", () => {
    const r = resolveQuoteLinePrice(undefined, { trade_price_cents: null, rrp_price_cents: 250000 });
    expect(r).toEqual({ unit_price_cents: 250000, price_source: "catalogue" });
  });

  it("returns no price and no source when neither line nor catalogue has one", () => {
    const r = resolveQuoteLinePrice(null, { trade_price_cents: null, rrp_price_cents: null });
    expect(r).toEqual({ unit_price_cents: null, price_source: null });
  });

  it("treats a zero catalogue price as unpriced", () => {
    const r = resolveQuoteLinePrice(null, { trade_price_cents: 0, rrp_price_cents: 0 });
    expect(r).toEqual({ unit_price_cents: null, price_source: null });
  });
});
