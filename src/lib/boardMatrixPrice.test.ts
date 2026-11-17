import { describe, expect, it } from "vitest";
import { boardMatrixPrice } from "./boardMatrixPrice";
import { clientUnitCents, tradePriceCents } from "./tradePricing";

describe("saved size prices in the board matrix", () => {
  it("uses Rift CTS saved starting RRP of EUR 29,202 with the existing discount chain", () => {
    const result = boardMatrixPrice(null, [{ label: "108 cm", price_cents: 2920200 }, { label: "128 cm", price_cents: 3329300 }]);
    expect(result).toEqual({ cents: 2920200, from: true });
    expect(tradePriceCents(result.cents, 0.1)).toBe(2628180);
    expect(clientUnitCents(result.cents, 0.1, 1)).toBe(2920200);
  });
  it("uses Yoma Console saved starting RRP of EUR 111,737", () => {
    expect(boardMatrixPrice(null, [{ label: "Bleach Oak", price_cents: 11173700 }, { label: "Ebonized Oak", price_cents: 11438300 }])).toEqual({ cents: 11173700, from: true });
  });
  it("uses an exact saved size instead of the cheapest size", () => {
    expect(boardMatrixPrice(null, [{ label: "108 cm", price_cents: 2920200 }, { label: "128 cm", price_cents: 3329300 }], { label: "128 cm" })).toEqual({ cents: 3329300, from: false });
  });
  it("preserves confirmed finishes and base prices", () => {
    expect(boardMatrixPrice(100, [{ price_cents: 50 }], { price_cents: 200 })).toEqual({ cents: 200, from: false });
    expect(boardMatrixPrice(100, [{ price_cents: 50 }])).toEqual({ cents: 100, from: false });
  });
  it("keeps invalid and absent prices unconfirmed", () => {
    expect(boardMatrixPrice(null, [{ price_cents: 0 }, { price_cents: -1 }, { price_cents: NaN }])).toEqual({ cents: null, from: false });
  });
});