import { describe, expect, it } from "vitest";
import { felixLineCents, felixQuantity, felixQuoteTotals } from "./felixQuoteQuantity";
const ava = { productId: "cloud", productName: "Cloud", unitPriceCents: 481500, priceCurrency: "EUR", quantity: 3 };
describe("Felix quantity pricing", () => {
  it("multiplies the configured unit price by quantity", () => {
    expect(felixLineCents(ava)).toBe(1444500);
  });
  it("recalculates the quote total when one line quantity changes", () => {
    const other = { ...ava, productId: "other", unitPriceCents: 100000, quantity: 2 };
    expect(felixQuoteTotals([ava, other])[0].cents).toBe(1644500);
    expect(felixQuoteTotals([{ ...ava, quantity: 1 }, other])[0].cents).toBe(681500);
  });
  it("keeps unpriced lines unpriced rather than inventing zero prices", () => {
    const unknown = { ...ava, unitPriceCents: null };
    expect(felixLineCents(unknown)).toBeNull();
    expect(felixQuoteTotals([ava, unknown])[0].incomplete).toBe(true);
  });
  it("keeps currencies separate", () => {
    expect(felixQuoteTotals([ava, { ...ava, priceCurrency: "USD", quantity: 1 }])).toEqual([
      { currency: "EUR", cents: 1444500, incomplete: false },
      { currency: "USD", cents: 481500, incomplete: false },
    ]);
  });
  it("normalizes invalid quantities to positive whole pieces", () => {
    expect(felixQuantity(0)).toBe(1);
    expect(felixQuantity(2.7)).toBe(2);
    expect(felixQuantity(NaN)).toBe(1);
  });
});