import { quoteDrawerRetail } from "./quoteDrawerRetail";
import type { QuoteFinishVariant } from "./quoteFinishSwatches";

export type QuoteSummaryLine = {
  quantity: number;
  unit_price_cents: number | null;
  unit_price_currency: string | null;
  fabric_upcharge_cents?: number | null;
  fabric_currency?: string | null;
  variant_label?: string | null;
  fabric_id?: string | null;
  fabric?: { price_per_lm_cents?: number | null; currency?: string | null } | null;
  woodRetail?: { cents: number; currency: string } | null;
  product?: {
    currency?: string | null;
    rrp_price_cents?: number | null;
    trade_price_cents?: number | null;
    size_variants?: QuoteFinishVariant[] | null;
  } | null;
};

export type LinePricing = {
  /** Unit price in cents, including any fabric surcharge. */
  unitCents: number;
  currency: string;
  /** unitCents × quantity */
  lineTotalCents: number;
  /** Which basis the unit price came from. */
  basis: "net" | "retail";
};

/**
 * Resolve the unit price and line total for one quote line.
 * Presentation (clientSafe) mode never uses net prices — retail only.
 * Trade mode prefers the saved net unit price, falling back to catalogue retail.
 */
export function quoteLinePricing(line: QuoteSummaryLine, clientSafe: boolean): LinePricing | null {
  const qty = Math.max(0, Number(line.quantity) || 0);
  if (!clientSafe) {
    const net = line.unit_price_cents;
    if (net != null && net > 0) {
      const currency = (line.unit_price_currency || line.product?.currency || "EUR").toUpperCase();
      const surcharge = line.fabric_upcharge_cents ?? 0;
      const surchargeCurrency = (line.fabric_currency || currency).toUpperCase();
      const unit = surcharge > 0 && surchargeCurrency === currency ? net + surcharge : net;
      return { unitCents: unit, currency, lineTotalCents: unit * qty, basis: "net" };
    }
  }
  const retail = quoteDrawerRetail(line);
  if (retail && retail.cents > 0) {
    return { unitCents: retail.cents, currency: retail.currency, lineTotalCents: retail.cents * qty, basis: "retail" };
  }
  return null;
}

export type QuoteSummary = {
  lineCount: number;
  totalUnits: number;
  /** Per-currency totals; lines without a resolvable price are excluded. */
  totals: { currency: string; cents: number; basis: "net" | "retail" | "mixed" }[];
  /** Lines whose price could not be resolved. */
  unpricedCount: number;
};

/** Aggregate a quote's lines into a summary: line count, units, per-currency totals. */
export function summarizeQuoteLines(lines: QuoteSummaryLine[], clientSafe: boolean): QuoteSummary {
  const byCurrency = new Map<string, { cents: number; bases: Set<"net" | "retail"> }>();
  let totalUnits = 0;
  let unpricedCount = 0;
  for (const line of lines) {
    totalUnits += Math.max(0, Number(line.quantity) || 0);
    const pricing = quoteLinePricing(line, clientSafe);
    if (!pricing) {
      unpricedCount += 1;
      continue;
    }
    const entry = byCurrency.get(pricing.currency) || { cents: 0, bases: new Set<"net" | "retail">() };
    entry.cents += pricing.lineTotalCents;
    entry.bases.add(pricing.basis);
    byCurrency.set(pricing.currency, entry);
  }
  return {
    lineCount: lines.length,
    totalUnits,
    totals: [...byCurrency.entries()].map(([currency, e]) => ({
      currency,
      cents: e.cents,
      basis: e.bases.size === 1 ? [...e.bases][0] : "mixed",
    })),
    unpricedCount,
  };
}
