import { quoteChargeBreakdown, type QuoteCharge } from "./quoteChargeBreakdown";

export type PaymentAmounts = {
  chargesCents: number;
  gstCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
};

export type PaymentMismatch = {
  label: string;
  expectedCents: number | null;
  displayedCents: number | null;
};

/** Exact integer-cent comparison; a single missing cent blocks payment. */
export function reconcileQuotePayment(input: {
  quoted: PaymentAmounts;
  displayed: PaymentAmounts;
  goodsCents: number;
  shippingCents: number;
  taxRate: number;
  depositPct: number;
  charges: QuoteCharge[];
  quotedCharges?: { label?: string; amountCents: number }[];
}) {
  const issues: string[] = [];
  const mismatches: PaymentMismatch[] = [];
  const labels: Record<keyof PaymentAmounts, string> = {
    chargesCents: "Charges", gstCents: "GST / tax", totalCents: "Order total",
    depositCents: "Deposit", balanceCents: "Balance",
  };
  const compare = (label: string, actual: number, expected: number) => {
    if (!Number.isSafeInteger(actual) || !Number.isSafeInteger(expected) || actual !== expected) {
      issues.push(`${label} does not match the quote.`);
      mismatches.push({ label, expectedCents: Number.isSafeInteger(expected) ? expected : null,
        displayedCents: Number.isSafeInteger(actual) ? actual : null });
    }
  };
  for (const key of Object.keys(labels) as (keyof PaymentAmounts)[]) {
    compare(labels[key], input.displayed[key], input.quoted[key]);
  }
  if (input.quotedCharges) {
    const count = Math.max(input.quotedCharges.length, input.charges.length);
    for (let index = 0; index < count; index++) {
      const quoted = input.quotedCharges[index];
      const displayed = input.charges[index];
      const quotedLabel = quoted?.label?.replace(/ × \d+$/, "");
      if (!quoted || !displayed || quoted.amountCents !== displayed.amountCents || quotedLabel !== displayed.label) {
        issues.push("Individual charges do not match the quote.");
        mismatches.push({ label: quotedLabel === displayed?.label ? quotedLabel || `Charge ${index + 1}`
          : `Charge ${index + 1}: ${quotedLabel || "Not in quote"} → ${displayed?.label || "Not displayed"}`,
          expectedCents: quoted && Number.isSafeInteger(quoted.amountCents) ? quoted.amountCents : null,
          displayedCents: displayed && Number.isSafeInteger(displayed.amountCents) ? displayed.amountCents : null });
      }
    }
  }
  if (!Number.isFinite(input.taxRate) || input.taxRate < 0
    || !Number.isFinite(input.depositPct) || input.depositPct < 0 || input.depositPct > 1
    || !Number.isSafeInteger(input.goodsCents) || !Number.isSafeInteger(input.shippingCents)
    || input.charges.some((charge) => !Number.isSafeInteger(charge.amountCents))) {
    issues.push("Charge calculation cannot be verified.");
    return { ok: false, issues, mismatches };
  }
  const rows = quoteChargeBreakdown(input.charges, input.goodsCents, input.taxRate, input.shippingCents, input.depositPct);
  const baseGst = input.goodsCents > 0 ? Math.round(input.goodsCents * input.taxRate / 100) : 0;
  const base = input.goodsCents + baseGst + input.shippingCents;
  const baseDeposit = Math.round(base * input.depositPct);
  compare("Itemized charges", rows.reduce((sum, row) => sum + row.amountCents, 0), input.quoted.chargesCents);
  compare("Itemized GST / tax", baseGst + rows.reduce((sum, row) => sum + row.gstCents, 0), input.quoted.gstCents);
  compare("Itemized order total", base + rows.reduce((sum, row) => sum + row.totalCents, 0), input.quoted.totalCents);
  compare("Itemized deposit", baseDeposit + rows.reduce((sum, row) => sum + row.depositCents, 0), input.quoted.depositCents);
  compare("Itemized balance", base - baseDeposit + rows.reduce((sum, row) => sum + row.balanceCents, 0), input.quoted.balanceCents);
  compare("Deposit and balance combined", input.displayed.depositCents + input.displayed.balanceCents, input.displayed.totalCents);
  return { ok: issues.length === 0, issues, mismatches };
}