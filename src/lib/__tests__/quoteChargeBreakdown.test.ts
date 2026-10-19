import { describe, expect, it } from "vitest";
import { quoteChargeBreakdown } from "../quoteChargeBreakdown";

describe("additional charge payment allocation", () => {
  it("includes insurance and GST and exactly reconciles the verified quote's payments", () => {
    const goods = 1_203_827;
    const shipping = 185_883;
    const rows = quoteChargeBreakdown([
      { id: "insurance", label: "Insurance", amountCents: 6_949 },
      { id: "freight", label: "Freight", amountCents: 120_000 },
      { id: "packing", label: "Premium Packing", amountCents: 128_000 },
    ], goods, 9, shipping);
    expect(rows[0].gstCents).toBe(626);
    expect(rows[0].totalCents).toBe(7_575);
    const base = goods + Math.round(goods * 0.09) + shipping;
    expect(base + rows.reduce((sum, row) => sum + row.totalCents, 0)).toBe(1_775_949);
    expect(Math.round(base * 0.6) + rows.reduce((sum, row) => sum + row.depositCents, 0)).toBe(1_065_569);
    expect(base - Math.round(base * 0.6) + rows.reduce((sum, row) => sum + row.balanceCents, 0)).toBe(710_380);
    expect(Math.round(goods * 0.09) + rows.reduce((sum, row) => sum + row.gstCents, 0)).toBe(131_290);
  });

  it("allocates a quote's selected deposit and leaves balance as the exact remainder", () => {
    const rows = quoteChargeBreakdown([{ id: "insurance", label: "Insurance", amountCents: 7 }], 11, 9, 3, 0.8);
    const base = 15;
    const final = 23;
    expect(Math.round(base * 0.8) + rows[0].depositCents).toBe(Math.round(final * 0.8));
    expect(base - Math.round(base * 0.8) + rows[0].balanceCents).toBe(final - Math.round(final * 0.8));
    expect(rows[0].depositCents + rows[0].balanceCents).toBe(rows[0].totalCents);
  });
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