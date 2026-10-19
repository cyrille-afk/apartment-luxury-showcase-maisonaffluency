export type QuoteCharge = { id: string; label: string; amountCents: number };

/** Allocate rounded tax and payment portions without changing the order total. */
export function quoteChargeBreakdown(
  charges: QuoteCharge[],
  goodsCents: number,
  taxRate: number,
  nonTaxableCents = 0,
  depositPct = 0.6,
) {
  const tax = (cents: number) => cents > 0 ? Math.round(cents * taxRate / 100) : 0;
  let taxable = goodsCents;
  let payable = goodsCents + tax(goodsCents) + nonTaxableCents;
  return charges.map((charge) => {
    const gstCents = tax(taxable + charge.amountCents) - tax(taxable);
    const totalCents = charge.amountCents + gstCents;
    const depositCents = Math.round((payable + totalCents) * depositPct) - Math.round(payable * depositPct);
    const balanceCents = totalCents - depositCents;
    taxable += charge.amountCents;
    payable += totalCents;
    return { ...charge, gstCents, totalCents, depositCents, balanceCents };
  });
}