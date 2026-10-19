import { describe, expect, it } from "vitest";
import { reconcileQuotePayment } from "../quotePaymentReconciliation";

const amounts = { chargesCents: 254_949, gstCents: 131_290, totalCents: 1_775_949, depositCents: 1_065_569, balanceCents: 710_380 };
const fixture = () => ({
  quoted: { ...amounts }, displayed: { ...amounts }, goodsCents: 1_203_827,
  shippingCents: 185_883, taxRate: 9, depositPct: 0.6,
  charges: [{ id: "insurance", label: "Insurance", amountCents: 6_949 },
    { id: "freight", label: "Freight", amountCents: 120_000 },
    { id: "packing", label: "Packing", amountCents: 128_000 }],
});
describe("payment reconciliation gate", () => {
  it("allows the exact verified quote including insurance and GST", () => {
    expect(reconcileQuotePayment(fixture())).toEqual({ ok: true, issues: [] });
  });
  for (const key of Object.keys(amounts) as (keyof typeof amounts)[]) {
    it(`blocks even a one-cent ${key} mismatch`, () => {
      const input = fixture(); input.displayed[key] += 1;
      expect(reconcileQuotePayment(input).ok).toBe(false);
    });
  }
  it("blocks missing insurance even when displayed totals look correct", () => {
    const input = fixture(); input.charges.shift();
    expect(reconcileQuotePayment(input).issues).toContain("Itemized charges does not match the quote.");
  });
  it("blocks incorrect GST allocation", () => {
    const input = fixture(); input.taxRate = 8;
    expect(reconcileQuotePayment(input).issues).toContain("Itemized GST / tax does not match the quote.");
  });
  it("blocks incorrect deposit allocation even if deposit and balance sum correctly", () => {
    const input = fixture(); input.depositPct = 0.8;
    expect(reconcileQuotePayment(input).issues).toContain("Itemized deposit does not match the quote.");
  });
  it("fails closed for invalid amounts", () => {
    const input = fixture(); input.charges[0].amountCents = NaN;
    expect(reconcileQuotePayment(input).ok).toBe(false);
  });
  it("supports zero tax and a custom deposit without rounding drift", () => {
    const input = { quoted: { chargesCents: 7, gstCents: 0, totalCents: 21, depositCents: 17, balanceCents: 4 },
      displayed: { chargesCents: 7, gstCents: 0, totalCents: 21, depositCents: 17, balanceCents: 4 },
      goodsCents: 11, shippingCents: 3, taxRate: 0, depositPct: 0.8,
      charges: [{ id: "fee", label: "Fee", amountCents: 7 }] };
    expect(reconcileQuotePayment(input).ok).toBe(true);
  });
});