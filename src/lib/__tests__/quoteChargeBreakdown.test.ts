import { describe, expect, it } from "vitest";
import { quoteChargeBreakdown } from "../quoteChargeBreakdown";

describe("additional charge payment allocation", () => {
  it("shows freight with 9% GST and its 60/40 contributions", () => {
    const [freight] = quoteChargeBreakdown([{ id: "freight", label: "Freight", amountCents: 120_000 }], 1_337_586, 9);
    expect(freight.gstCents).toBe(10_800);
    expect(freight.totalCents).toBe(130_800);
    expect(freight.depositCents).toBe(78_480);
    expect(freight.balanceCents).toBe(52_320);
  });

  it("reconciles multiple small charges to the existing rounded order payments", () => {
    const rows = quoteChargeBreakdown([
      { id: "a", label: "Freight", amountCents: 6 },
      { id: "b", label: "Packing", amountCents: 6 },
    ], 6, 9, 7);
    // 18 taxable cents + 2 GST cents + 7 untaxed cents = 27 cents.
    expect(rows.reduce((sum, row) => sum + row.gstCents, 1)).toBe(2);
    expect(rows.reduce((sum, row) => sum + row.depositCents, Math.round(14 * 0.6))).toBe(Math.round(27 * 0.6));
    expect(rows.reduce((sum, row) => sum + row.balanceCents, Math.round(14 * 0.4))).toBe(Math.round(27 * 0.4));
  });

  it("does not add GST when tax is disabled", () => {
    const [row] = quoteChargeBreakdown([{ id: "a", label: "Freight", amountCents: 120_000 }], 1_337_586, 0);
    expect(row.gstCents).toBe(0);
    expect(row.depositCents).toBe(72_000);
    expect(row.balanceCents).toBe(48_000);
  });
});