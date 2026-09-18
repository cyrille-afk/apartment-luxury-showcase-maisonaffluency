/**
 * Multi-vendor commission engine.
 *
 * Every value is an integer in minor units (cents). No floating-point money
 * ever leaves this module: percentages are applied with integer rounding and
 * prorated amounts use largest-remainder distribution so the parts always sum
 * back to the whole, regardless of how many line items a transaction carries.
 */

export const DEFAULT_DESIGNER_RATE_PCT = 70; // designer share; platform keeps 30%
export const STRIPE_PCT_BPS = 290; // 2.9%
export const STRIPE_FIXED_CENTS = 30;

export type Absorption = "designer" | "platform";

export interface SplitLineInput {
  lineItemId?: string | null;
  designerId?: string | null;
  designerName?: string | null;
  /** Pre-discount line total in cents (unit price × quantity). */
  grossCents: number;
  /** Designer share, 0–100. Falls back to the standard tier. */
  commissionRatePct?: number | null;
  /** Who eats the B2B trade discount for this designer's contract. */
  absorption?: Absorption | null;
}

export interface SplitLineResult {
  lineItemId: string | null;
  designerId: string | null;
  designerName: string | null;
  grossAmount: number;
  tradeDiscountApplied: number;
  discountAbsorbedBy: Absorption;
  commissionRatePct: number;
  stripeFeeCents: number;
  platformFee: number;
  designerNetPayout: number;
}

/**
 * Split `total` across `weights` so the parts are proportional and sum exactly
 * to `total` (largest remainder method).
 */
export function prorate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0) return new Array(n).fill(0);
  if (sum <= 0) {
    // Even split when there is nothing to weigh by.
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
  // Integer-safe percentage: scale by 100 to keep two decimals of the rate.
  return Math.round((amountCents * Math.round(percent * 100)) / 10000);
}

export interface SplitTransactionInput {
  lines: SplitLineInput[];
  /** Total B2B trade discount applied to the transaction, in cents. */
  tradeDiscountCents?: number;
  /** Present when the checkout ran under a trade program. */
  tradeProgramId?: string | null;
  /** Set false for non-Stripe settlement (wire, PayNow). */
  chargeStripeFees?: boolean;
}

export interface SplitTransactionResult {
  lines: SplitLineResult[];
  totals: {
    gross: number;
    tradeDiscount: number;
    stripeFees: number;
    platformFee: number;
    designerNet: number;
  };
}

export function calculateSplits(input: SplitTransactionInput): SplitTransactionResult {
  const lines = input.lines.filter((l) => Number.isFinite(l.grossCents));
  const weights = lines.map((l) => Math.max(0, Math.round(l.grossCents)));
  const grossTotal = weights.reduce((a, b) => a + b, 0);

  const discountTotal = input.tradeProgramId
    ? Math.min(Math.max(0, Math.round(input.tradeDiscountCents ?? 0)), grossTotal)
    : 0;
  const discountParts = prorate(discountTotal, weights);

  // Stripe's structural cost: percentage on the charged amount plus one fixed
  // fee for the transaction, prorated across the items by charged value.
  const chargedParts = weights.map((w, i) => w - discountParts[i]);
  const chargedTotal = chargedParts.reduce((a, b) => a + b, 0);
  const stripeTotal =
    input.chargeStripeFees === false
      ? 0
      : Math.round((chargedTotal * STRIPE_PCT_BPS) / 10000) + STRIPE_FIXED_CENTS;
  const stripeParts = prorate(stripeTotal, chargedParts);

  const results: SplitLineResult[] = lines.map((line, i) => {
    const gross = weights[i];
    const discount = discountParts[i];
    const charged = chargedParts[i];
    const stripeFee = stripeParts[i];
    const absorption: Absorption = line.absorption === "designer" ? "designer" : "platform";
    const rate =
      typeof line.commissionRatePct === "number" && line.commissionRatePct >= 0 && line.commissionRatePct <= 100
        ? line.commissionRatePct
        : DEFAULT_DESIGNER_RATE_PCT;

    // Designer-absorbed: the discount shrinks the base the split is taken on.
    // Platform-absorbed: the designer is paid on the full list price and the
    // whole discount comes out of the platform margin.
    const base = absorption === "designer" ? charged : gross;
    const designerNet = Math.min(pct(base, rate), charged);
    const platformFee = charged - stripeFee - designerNet;

    return {
      lineItemId: line.lineItemId ?? null,
      designerId: line.designerId ?? null,
      designerName: line.designerName ?? null,
      grossAmount: gross,
      tradeDiscountApplied: discount,
      discountAbsorbedBy: absorption,
      commissionRatePct: rate,
      stripeFeeCents: stripeFee,
      platformFee,
      designerNetPayout: designerNet,
    };
  });

  return {
    lines: results,
    totals: {
      gross: grossTotal,
      tradeDiscount: discountTotal,
      stripeFees: stripeTotal,
      platformFee: results.reduce((a, l) => a + l.platformFee, 0),
      designerNet: results.reduce((a, l) => a + l.designerNetPayout, 0),
    },
  };
}
