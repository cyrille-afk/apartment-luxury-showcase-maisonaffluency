import { describe, it, expect } from "vitest";
import { computeQuoteTotals } from "@/lib/quotePdf";

describe("manual freight charge on quote PDF", () => {
  it("lists the Freight line and adds it (with 9% GST) to the grand total", () => {
    const t = computeQuoteTotals({
      currency: "SGD",
      subtotalCents: 1_337_586,
      tradeDiscountApplied: false,
      tradeDiscountPct: 0,
      gstEnabled: true,
      gstRate: 9,
      extras: [{ label: "Freight", amountCents: 120_000 }],
    } as any);
    expect(t.extrasList).toEqual([{ label: "Freight", amountCents: 120_000 }]);
    expect(t.grand).toBe(Math.round((1_337_586 + 120_000) * 1.09));
  });
});
