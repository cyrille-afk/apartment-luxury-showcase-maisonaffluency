import { describe, expect, it } from "vitest";
import { clientPriceCents, effectiveProjectMultiplier, toDiscountFraction, tradePriceCents } from "./tradePricing";

describe("Client View pricing", () => {
  it("applies the tier fraction before project markup, rounding each currency step", () => {
    const trade = tradePriceCents(864700, toDiscountFraction(0.10));
    expect(trade).toBe(778230);
    expect(clientPriceCents(trade, effectiveProjectMultiplier(1.25, 40))).toBe(972788);
  });

  it("uses the studio markup when no explicit project markup is set", () => {
    expect(effectiveProjectMultiplier(null, 25)).toBe(1.25);
    expect(effectiveProjectMultiplier(1, 25)).toBe(1.25);
    expect(clientPriceCents(tradePriceCents(10000, 0.15), effectiveProjectMultiplier(null, 25))).toBe(10625);
  });

  it("accepts legacy percent discounts without treating ten as a 1000% discount", () => {
    expect(clientPriceCents(tradePriceCents(10000, toDiscountFraction(10)), 1.2)).toBe(10800);
  });

  it("keeps unavailable prices unavailable", () => {
    expect(clientPriceCents(tradePriceCents(null, 0.1), 1.3)).toBeNull();
    expect(clientPriceCents(tradePriceCents(0, 0.1), 1.3)).toBeNull();
  });
});