import { describe, expect, it } from "vitest";
import { comparatorCurrency, convertComparatorCents } from "./comparatorCurrency";

describe("comparator currency", () => {
  it("converts with the direct synced rate", () => {
    expect(convertComparatorCents(850000, "EUR", "USD", { EUR_USD: 1.12 })).toBe(952000);
  });
  it("uses the inverse pair when only it is synced", () => {
    expect(convertComparatorCents(100000, "USD", "EUR", { EUR_USD: 1.25 })).toBe(80000);
  });
  it("refuses to guess when no synced rate exists", () => {
    expect(convertComparatorCents(100000, "SGD", "GBP", {})).toBeNull();
  });
  it("only offers USD, EUR and GBP, defaulting to EUR", () => {
    expect(comparatorCurrency("GBP")).toBe("GBP");
    expect(comparatorCurrency("SGD")).toBe("EUR");
  });
});
