import { describe, it, expect } from "vitest";
import { buildSharedQuoteSnapshot } from "./quoteClientShare";

describe("buildSharedQuoteSnapshot", () => {
  it("uses retail price, never the net trade price", () => {
    const s = buildSharedQuoteSnapshot("e3ccd6aa-0000", "Mrs Tan", [
      { quantity: 7, unit_price_cents: 2034000, unit_price_currency: "EUR", product: { product_name: "Saint Honoré Sofa", rrp_price_cents: 2250000, currency: "EUR" } },
    ]);
    expect(s.lines[0].unitCents).toBe(2250000);
    expect(s.lines[0].lineTotalCents).toBe(2250000 * 7);
    expect(s.totals).toEqual([{ currency: "EUR", cents: 2250000 * 7 }]);
    expect(JSON.stringify(s)).not.toContain("2034000");
  });
});
