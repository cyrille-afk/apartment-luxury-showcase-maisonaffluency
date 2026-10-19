import { describe, expect, it } from "vitest";
import { paymentSummaryRows, type PaymentSummaryInput } from "../paymentSummary";
import { quoteChargeBreakdown } from "../quoteChargeBreakdown";

const fixture = (): PaymentSummaryInput => ({ quoteNumber: "QU-TEST", clientName: "Client", currency: "SGD", locale: "en-SG", taxLabel: "GST", taxRate: 9,
  goodsCents: 1_203_827, shippingCents: 185_883, charges: [{ id: "insurance", label: "Insurance", amountCents: 6_949 },
    { id: "freight", label: "Freight", amountCents: 120_000 }, { id: "packing", label: "Packing", amountCents: 128_000 }],
  taxCents: 131_290, totalCents: 1_775_949, depositCents: 1_065_569, balanceCents: 710_380, depositPct: 0.6,
  paymentType: "deposit", processingFeeCents: 37_557, cardTotalCents: 1_103_126 });

describe("payment summary parity", () => {
  it("uses exactly the same additional charge allocations as the screen", () => {
    const input = fixture();
    expect(paymentSummaryRows(input).slice(1, 4)).toEqual(quoteChargeBreakdown(input.charges, input.goodsCents, 9, input.shippingCents, 0.6));
  });
  it("reconciles every PDF row including GST, deposit and balance to the verified quote", () => {
    const rows = paymentSummaryRows(fixture());
    expect(rows.reduce((s, r) => s + r.gstCents, 0)).toBe(131_290);
    expect(rows.reduce((s, r) => s + r.totalCents, 0)).toBe(1_775_949);
    expect(rows.reduce((s, r) => s + r.depositCents, 0)).toBe(1_065_569);
    expect(rows.reduce((s, r) => s + r.balanceCents, 0)).toBe(710_380);
  });
  it("refuses a mismatched quote total", () => {
    const input = fixture(); input.totalCents++;
    expect(() => paymentSummaryRows(input)).toThrow("do not reconcile");
  });
  it("refuses a card fee mismatch", () => {
    const input = fixture(); input.cardTotalCents++;
    expect(() => paymentSummaryRows(input)).toThrow("Card payment summary");
  });
});