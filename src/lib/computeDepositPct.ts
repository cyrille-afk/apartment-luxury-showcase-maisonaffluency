/**
 * Weighted-average deposit percentage across quote line items.
 *
 * Rules (mirrors QuoteDetail.tsx PDF generation):
 * - An explicit per-line `deposit_pct_override` always wins.
 * - Otherwise, lines flagged as "in stock" or with a zero lead time default to
 *   100% upfront (1.0).
 * - All remaining lines default to 60% (0.6).
 * - Lines with non-positive cents are ignored.
 * - When no positive-cents lines exist, falls back to 0.6.
 *
 * Extracted so PDF-generation behaviour can be unit-tested without rendering
 * the full QuoteDetail component.
 */
export interface DepositLineInput {
  /** Already-converted line total in the quote display currency (cents). */
  lineCents: number;
  /** Optional explicit per-line deposit override (0..1). */
  deposit_pct_override?: number | null;
  /** Per-line lead-time override in weeks (0 means in-stock). */
  lead_weeks_override?: number | null;
  /** Product-level overrides from `trade_products`. */
  stock_status_override?: string | null;
  lead_weeks_max_override?: number | null;
}

export function isLineInStock(line: DepositLineInput): boolean {
  return (
    line.stock_status_override === "in_stock" ||
    line.lead_weeks_max_override === 0 ||
    line.lead_weeks_override === 0
  );
}

export function computeWeightedDepositPct(lines: DepositLineInput[]): number {
  let weight = 0;
  let weighted = 0;
  for (const it of lines) {
    if (!(it.lineCents > 0)) continue;
    const pct =
      it.deposit_pct_override != null
        ? it.deposit_pct_override
        : isLineInStock(it)
          ? 1
          : 0.6;
    weight += it.lineCents;
    weighted += it.lineCents * pct;
  }
  return weight > 0 ? weighted / weight : 0.6;
}
