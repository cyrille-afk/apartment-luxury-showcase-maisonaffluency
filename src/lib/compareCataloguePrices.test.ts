import { describe, expect, it } from "vitest";
import { compareCataloguePrices } from "./compareCataloguePrices";

describe("catalogue price sorting", () => {
  it("orders numeric RRP cents low to high", () => {
    expect([300000, 100000, 200000].sort((a, b) => compareCataloguePrices(a, b, "price-asc")))
      .toEqual([100000, 200000, 300000]);
  });
  it("reverses priced products high to low", () => {
    expect([300000, 100000, 200000].sort((a, b) => compareCataloguePrices(a, b, "price-desc")))
      .toEqual([300000, 200000, 100000]);
  });
  it.each(["price-asc", "price-desc"] as const)("keeps unknown prices last in %s", (mode) => {
    const prices = [null, 200000, 0, 100000, undefined];
    expect(prices.sort((a, b) => compareCataloguePrices(a, b, mode))).toEqual(
      mode === "price-asc" ? [100000, 200000, null, 0, undefined] : [200000, 100000, null, 0, undefined],
    );
    expect(compareCataloguePrices(null, null, mode)).toBe(0);
  });
});