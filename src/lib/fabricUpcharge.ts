/**
 * Helpers for per-line fabric upcharges on trade quotes.
 *
 * A quote item may carry a fabric selection (`fabric_id`) with a meters value
 * (`fabric_meters`) and a snapshotted upcharge in cents (`fabric_upcharge_cents`)
 * in the fabric's original currency (`fabric_currency`).
 *
 * Snapshotting at save time keeps historical quote totals stable when a fabric
 * price changes later.
 */

export interface FabricOption {
  id: string;
  name: string;
  supplier: string | null;
  tier: "A" | "B" | "C" | "D" | "E" | null;
  price_per_lm_cents: number | null;
  currency: string;
  image_url?: string | null;
}

export interface QuoteItemFabricFields {
  fabric_id?: string | null;
  fabric_meters?: number | string | null;
  fabric_upcharge_cents?: number | null;
  fabric_currency?: string | null;
}

/** Compute upcharge cents = price_per_lm × meters, in the fabric's currency. */
export function computeFabricUpchargeCents(
  fabric: Pick<FabricOption, "price_per_lm_cents"> | null | undefined,
  meters: number | null | undefined,
): number | null {
  if (!fabric?.price_per_lm_cents || !meters || meters <= 0) return null;
  return Math.round(fabric.price_per_lm_cents * meters);
}

/**
 * Return the snapshotted fabric upcharge converted to the quote currency.
 * Returns 0 (not null) when no fabric is selected so callers can sum freely.
 */
export function fabricUpchargeInQuoteCcy(
  item: QuoteItemFabricFields | null | undefined,
  quoteCurrency: string,
  convertCents: (cents: number | null, from: string, to: string) => number | null,
): number {
  if (!item?.fabric_upcharge_cents) return 0;
  const from = item.fabric_currency || "EUR";
  return convertCents(item.fabric_upcharge_cents, from, quoteCurrency) ?? item.fabric_upcharge_cents;
}

const SYMS: Record<string, string> = { EUR: "€", USD: "$", GBP: "£", SGD: "S$" };
export const ccySym = (c: string) => SYMS[c] || c;

/** "CAT A · €150/lm" */
export function fabricTierLabel(f: Pick<FabricOption, "tier" | "price_per_lm_cents" | "currency">): string {
  const parts: string[] = [];
  if (f.tier) parts.push(`CAT ${f.tier}`);
  if (f.price_per_lm_cents) {
    parts.push(`${ccySym(f.currency || "EUR")}${(f.price_per_lm_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/lm`);
  }
  return parts.join(" · ");
}
