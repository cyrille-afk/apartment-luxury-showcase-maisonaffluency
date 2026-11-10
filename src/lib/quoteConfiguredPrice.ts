export type QuoteConfiguredPrice = {
  netCents: number | null;
  currency: string | null;
  variantLabel: string | null;
};

/**
 * Freeze numeric renderer pricing before asynchronous quote writes.
 * The renderer's net already includes any fabric surcharge; when the surcharge
 * is saved separately (same currency) it is subtracted from the unit price so
 * net totals don't double-charge and retail can still be reconstructed.
 */
export function quoteConfiguredPricePatch(
  snapshot: QuoteConfiguredPrice,
  fabric?: { upchargeCents: number | null | undefined; currency: string | null | undefined },
) {
  if (!snapshot.currency || snapshot.netCents == null || !Number.isFinite(snapshot.netCents) || snapshot.netCents <= 0) return null;
  const net = Math.round(snapshot.netCents);
  const currency = snapshot.currency.toUpperCase();
  const up = fabric?.upchargeCents ?? 0;
  const sameCcy = (fabric?.currency || currency).toUpperCase() === currency;
  if (up > 0 && sameCcy && net - up > 0) {
    return { unit_price_cents: net - up, unit_price_currency: snapshot.currency, fabric_upcharge_cents: up };
  }
  return { unit_price_cents: net, unit_price_currency: snapshot.currency, fabric_upcharge_cents: null };
}
