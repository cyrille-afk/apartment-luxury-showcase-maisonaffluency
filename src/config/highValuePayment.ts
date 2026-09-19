/**
 * High-value settlement routing.
 *
 * Corporate cards rarely authorise a single six-figure furniture order, so
 * above these per-currency thresholds the checkout leads with bank transfer
 * and offers a deposit-by-card / balance-by-transfer plan instead of letting
 * the buyer discover a declined card at the last step.
 *
 * Amounts are in minor units (cents / pence) of the settlement currency and
 * reflect typical corporate card ceilings, not our own limits.
 */
export const CARD_PRACTICAL_LIMIT_CENTS: Record<string, number> = {
  GBP: 20_000_00,
  EUR: 25_000_00,
  USD: 25_000_00,
  CHF: 25_000_00,
  SGD: 35_000_00,
  AED: 90_000_00,
  HKD: 200_000_00,
  AUD: 40_000_00,
  CAD: 35_000_00,
};

/** Fallback ceiling for currencies without a published limit. */
const DEFAULT_LIMIT_CENTS = 25_000_00;

export function cardPracticalLimitCents(currency: string): number {
  return CARD_PRACTICAL_LIMIT_CENTS[String(currency || "").toUpperCase()] ?? DEFAULT_LIMIT_CENTS;
}

/** True when the order is likely to exceed a corporate card authorisation. */
export function isHighValueOrder(totalCents: number, currency: string): boolean {
  return Number.isFinite(totalCents) && totalCents > cardPracticalLimitCents(currency);
}

/** Deposit plans the server honours (see `create-payment-intent`). */
export const DEPOSIT_PLANS = [0.3, 0.5] as const;
export type DepositPct = (typeof DEPOSIT_PLANS)[number] | 0;

/** Rounds the deposit the same way the server does (whole currency units). */
export function depositAmountCents(totalCents: number, pct: DepositPct): number {
  if (!pct) return totalCents;
  return Math.round(Math.round(totalCents * pct) / 100) * 100;
}
