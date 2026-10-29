import { quoteLinePricing, summarizeQuoteLines, type QuoteSummaryLine } from "./quoteLineSummary";
import { dimensionsFromVariantLabel } from "./drawerDimensions";

export type SharedQuoteLine = {
  name: string;
  maker: string | null;
  image: string | null;
  finish: string | null;
  dimensions: string | null;
  quantity: number;
  unitCents: number | null;
  lineTotalCents: number | null;
  currency: string | null;
};

export type SharedQuoteSnapshot = {
  version: 1;
  quoteRef: string;
  clientName: string | null;
  lines: SharedQuoteLine[];
  totals: { currency: string; cents: number }[];
  lineCount: number;
  totalUnits: number;
  unpricedCount: number;
};

export type ShareSourceLine = QuoteSummaryLine & {
  image_url?: string | null;
  fabric?: (QuoteSummaryLine["fabric"] & { name?: string | null }) | null;
  wood_fabric?: { name?: string | null } | null;
  product?: (QuoteSummaryLine["product"] & {
    product_name?: string | null;
    brand_name?: string | null;
    image_url?: string | null;
    dimensions?: string | null;
  }) | null;
};

/**
 * Build the client-facing snapshot. Retail pricing only (clientSafe=true) —
 * net/trade prices, markups and internal notes are never included.
 */
export function buildSharedQuoteSnapshot(quoteId: string, clientName: string | null, items: ShareSourceLine[]): SharedQuoteSnapshot {
  const lines: SharedQuoteLine[] = items.map((item) => {
    const pricing = quoteLinePricing(item, true);
    const finish = [item.fabric?.name, item.wood_fabric?.name].filter(Boolean).join(" · ") || item.variant_label || null;
    const dimensions = dimensionsFromVariantLabel(item.variant_label, item.product?.dimensions ?? null);
    return {
      name: item.product?.product_name || "Piece",
      maker: item.product?.brand_name || null,
      image: item.image_url || item.product?.image_url || null,
      finish,
      dimensions,
      quantity: Math.max(0, Number(item.quantity) || 0),
      unitCents: pricing?.unitCents ?? null,
      lineTotalCents: pricing?.lineTotalCents ?? null,
      currency: pricing?.currency ?? null,
    };
  });
  const summary = summarizeQuoteLines(items, true);
  return {
    version: 1,
    quoteRef: `QU-${quoteId.slice(0, 6).toUpperCase()}`,
    clientName,
    lines,
    totals: summary.totals.map(({ currency, cents }) => ({ currency, cents })),
    lineCount: summary.lineCount,
    totalUnits: summary.totalUnits,
    unpricedCount: summary.unpricedCount,
  };
}
