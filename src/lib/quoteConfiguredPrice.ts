export type QuoteConfiguredPrice = {
  netCents: number | null;
  currency: string | null;
  variantLabel: string | null;
};

/** Freeze numeric renderer pricing before asynchronous quote writes. */
export function quoteConfiguredPricePatch(snapshot: QuoteConfiguredPrice) {
  if (!snapshot.currency || snapshot.netCents == null || !Number.isFinite(snapshot.netCents) || snapshot.netCents <= 0) return null;
  return { unit_price_cents: Math.round(snapshot.netCents), unit_price_currency: snapshot.currency };
}