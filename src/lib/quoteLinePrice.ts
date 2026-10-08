// Resolves the effective unit price for a quote line.
// A price saved on the quote line always wins; when the line has none,
// fall back to the catalogue price (trade_price_cents, then rrp_price_cents).

export type QuoteLinePriceSource = "quote" | "catalogue" | null;

export interface ResolvedQuoteLinePrice {
  unit_price_cents: number | null;
  price_source: QuoteLinePriceSource;
  /** True when a saved line price differs from the current catalogue price. */
  price_differs_from_catalogue: boolean;
  /** The current catalogue price, when one exists. */
  catalogue_price_cents: number | null;
}

export function resolveQuoteLinePrice(
  lineUnitPriceCents: number | null | undefined,
  product: { trade_price_cents?: number | null; rrp_price_cents?: number | null } | null | undefined,
): ResolvedQuoteLinePrice {
  const catalogue = product?.trade_price_cents || product?.rrp_price_cents || null;
  if (lineUnitPriceCents != null) {
    return {
      unit_price_cents: lineUnitPriceCents,
      price_source: "quote",
      price_differs_from_catalogue: catalogue != null && lineUnitPriceCents !== catalogue,
      catalogue_price_cents: catalogue,
    };
  }
  return {
    unit_price_cents: catalogue,
    price_source: catalogue != null ? "catalogue" : null,
    price_differs_from_catalogue: false,
    catalogue_price_cents: catalogue,
  };
}
