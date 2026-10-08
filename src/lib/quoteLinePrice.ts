// Resolves the effective unit price for a quote line.
// A price saved on the quote line always wins; when the line has none,
// fall back to the catalogue price (trade_price_cents, then rrp_price_cents).

export type QuoteLinePriceSource = "quote" | "catalogue" | null;

export interface ResolvedQuoteLinePrice {
  unit_price_cents: number | null;
  price_source: QuoteLinePriceSource;
}

export function resolveQuoteLinePrice(
  lineUnitPriceCents: number | null | undefined,
  product: { trade_price_cents?: number | null; rrp_price_cents?: number | null } | null | undefined,
): ResolvedQuoteLinePrice {
  if (lineUnitPriceCents != null) {
    return { unit_price_cents: lineUnitPriceCents, price_source: "quote" };
  }
  const catalogue = product?.trade_price_cents || product?.rrp_price_cents || null;
  return {
    unit_price_cents: catalogue,
    price_source: catalogue != null ? "catalogue" : null,
  };
}
