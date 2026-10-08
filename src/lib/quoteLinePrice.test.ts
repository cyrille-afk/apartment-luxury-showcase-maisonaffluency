import { describe, it, expect } from "vitest";
import { resolveQuoteLinePrice } from "./quoteLinePrice";

describe("resolveQuoteLinePrice", () => {
  it("keeps the saved line price and marks it as quote-sourced", () => {
    const r = resolveQuoteLinePrice(904100, { trade_price_cents: 500000, rrp_price_cents: 600000 });
    expect(r.unit_price_cents).toBe(904100);
    expect(r.price_source).toBe("quote");
  });

  it("falls back to the catalogue trade price when the line has none", () => {
    const r = resolveQuoteLinePrice(null, { trade_price_cents: 534100, rrp_price_cents: 534100 });
    expect(r).toMatchObject({ unit_price_cents: 534100, price_source: "catalogue", price_differs_from_catalogue: false });
  });

  it("uses rrp_price_cents when trade_price_cents is missing", () => {
    const r = resolveQuoteLinePrice(undefined, { trade_price_cents: null, rrp_price_cents: 250000 });
    expect(r.unit_price_cents).toBe(250000);
    expect(r.price_source).toBe("catalogue");
  });

  it("returns no price and no source when neither line nor catalogue has one", () => {
    const r = resolveQuoteLinePrice(null, { trade_price_cents: null, rrp_price_cents: null });
    expect(r).toMatchObject({ unit_price_cents: null, price_source: null, price_differs_from_catalogue: false });
  });

  it("treats a zero catalogue price as unpriced", () => {
    const r = resolveQuoteLinePrice(null, { trade_price_cents: 0, rrp_price_cents: 0 });
    expect(r.unit_price_cents).toBeNull();
    expect(r.price_source).toBeNull();
  });

  it("flags a saved line price that differs from the catalogue price", () => {
    const r = resolveQuoteLinePrice(800000, { trade_price_cents: 904100, rrp_price_cents: 904100 });
    expect(r.price_differs_from_catalogue).toBe(true);
    expect(r.catalogue_price_cents).toBe(904100);
  });

  it("does not flag a saved line price equal to the catalogue price", () => {
    const r = resolveQuoteLinePrice(904100, { trade_price_cents: 904100, rrp_price_cents: 904100 });
    expect(r.price_differs_from_catalogue).toBe(false);
  });

  it("does not flag when there is no catalogue price to compare against", () => {
    const r = resolveQuoteLinePrice(800000, { trade_price_cents: null, rrp_price_cents: null });
    expect(r.price_differs_from_catalogue).toBe(false);
    expect(r.catalogue_price_cents).toBeNull();
  });
});
