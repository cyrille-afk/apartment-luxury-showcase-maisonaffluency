/**
 * Merchant-of-Record (wholesale procurement) engine.
 *
 * Maison Affluency buys from the designer at RRP less the wholesale discount
 * and resells to the end buyer. Two independent ledgers come out of one sale:
 *   - Accounts receivable: sold_price_gross (what the buyer paid us)
 *   - Accounts payable:    purchase_cost_cogs (fixed wholesale debt to designer)
 *
 * purchase_cost_cogs is derived ONLY from retail_rrp and the designer's
 * wholesale discount — retail markdowns and B2B trade discounts never touch it.
 *
 * Every value is an integer in minor units (cents).
 */

export const DEFAULT_WHOLESALE_DISCOUNT_PCT = 30; // Maison pays 70% of RRP
export const STRIPE_PCT_BPS = 290; // 2.9%
export const STRIPE_FIXED_CENTS = 30;

export interface ProcurementLineInput {
  lineItemId?: string | null;
  designerId?: string | null;
  designerName?: string | null;
  /** Recommended retail price for the line (unit RRP × quantity), in cents. */
  retailRrpCents: number;
  /** Wholesale discount granted by the designer, 0–100. */
  wholesaleDiscountPct?: number | null;
}

export interface ProcurementLineResult {
  lineItemId: string | null;
  designerId: string | null;
  designerName: string | null;
  retailRrp: number;
  wholesaleDiscountPct: number;
  purchaseCostCogs: number;
  soldPriceGross: number;
  retailDiscountApplied: number;
  stripeProcessingFees: number;
  netMaisonMargin: number;
}

export interface ProcurementTransactionInput {
  lines: ProcurementLineInput[];
  /** Total retail/B2B discount granted to the end buyer, in cents. */
  retailDiscountCents?: number;
  tradeProgramId?: string | null;
  /** Set false for non-Stripe settlement (wire, PayNow). */
  chargeStripeFees?: boolean;
}

export interface ProcurementTransactionResult {
  lines: ProcurementLineResult[];
  totals: {
    retailRrp: number;
    purchaseCostCogs: number;
    soldPriceGross: number;
    stripeProcessingFees: number;
    netMaisonMargin: number;
  };
}

/**
 * Split `total` across `weights` proportionally so the parts sum exactly to
 * `total` (largest remainder method).
 */
export function prorate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return new Array(n).fill(0);
  if (sum <= 0) {
    const base = Math.floor(total / n);
    const parts = new Array(n).fill(base);
    let rest = total - base * n;
    for (let i = 0; rest > 0; i = (i + 1) % n, rest--) parts[i] += 1;
    return parts;
  }
  const exact = weights.map((w) => (w * total) / sum);
  const parts = exact.map((v) => Math.floor(v));
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0 && order.length > 0; k++, remainder--) {
    parts[order[k % order.length].i] += 1;
  }
  return parts;
}

function pct(amountCents: number, percent: number): number {
  return Math.round((amountCents * Math.round(percent * 100)) / 10000);
}

export function calculateProcurement(
  input: ProcurementTransactionInput,
): ProcurementTransactionResult {
  const lines = input.lines.filter((l) => Number.isFinite(l.retailRrpCents));
  const rrps = lines.map((l) => Math.max(0, Math.round(l.retailRrpCents)));
  const rrpTotal = rrps.reduce((a, b) => a + b, 0);

  const discountTotal = Math.min(
    Math.max(0, Math.round(input.retailDiscountCents ?? 0)),
    rrpTotal,
  );
  const discountParts = prorate(discountTotal, rrps);

  const soldParts = rrps.map((r, i) => r - discountParts[i]);
  const soldTotal = soldParts.reduce((a, b) => a + b, 0);
  const stripeTotal =
    input.chargeStripeFees === false
      ? 0
      : Math.round((soldTotal * STRIPE_PCT_BPS) / 10000) + STRIPE_FIXED_CENTS;
  const stripeParts = prorate(stripeTotal, soldParts);

  const results: ProcurementLineResult[] = lines.map((line, i) => {
    const retailRrp = rrps[i];
    const rawPct = line.wholesaleDiscountPct;
    const wholesaleDiscountPct =
      typeof rawPct === "number" && rawPct >= 0 && rawPct <= 100
        ? rawPct
        : DEFAULT_WHOLESALE_DISCOUNT_PCT;

    // Locked at transaction time, independent of any buyer-side discount.
    const purchaseCostCogs = retailRrp - pct(retailRrp, wholesaleDiscountPct);
    const soldPriceGross = soldParts[i];
    const stripeProcessingFees = stripeParts[i];

    return {
      lineItemId: line.lineItemId ?? null,
      designerId: line.designerId ?? null,
      designerName: line.designerName ?? null,
      retailRrp,
      wholesaleDiscountPct,
      purchaseCostCogs,
      soldPriceGross,
      retailDiscountApplied: discountParts[i],
      stripeProcessingFees,
      netMaisonMargin: soldPriceGross - purchaseCostCogs - stripeProcessingFees,
    };
  });

  return {
    lines: results,
    totals: {
      retailRrp: rrpTotal,
      purchaseCostCogs: results.reduce((a, l) => a + l.purchaseCostCogs, 0),
      soldPriceGross: soldTotal,
      stripeProcessingFees: stripeTotal,
      netMaisonMargin: results.reduce((a, l) => a + l.netMaisonMargin, 0),
    },
  };
}
