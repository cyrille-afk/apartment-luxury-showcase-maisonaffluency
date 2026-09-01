/**
 * Single pricing engine for the product page.
 *
 * Both presentational variants (PublicEditorialLayout and
 * TradePortalDashboardLayout) derive every displayed figure from these pure
 * helpers, so a finish swap or a quantity change resolves to the exact same
 * numbers on either surface. No hardcoded price strings anywhere.
 */

export type PricingRole =
  | "PUBLIC"
  | "RETAIL_BUYER"
  | "TRADE_UNVERIFIED"
  | "TRADE_VERIFIED";

export function formatCents(cents: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString("en-US")}`;
  }
}

/** Net trade price after the member's assigned tier discount (e.g. Silver 8%). */
export function applyTradeDiscount(baseRetailCents: number, discountPct: number): number {
  if (!baseRetailCents || baseRetailCents <= 0) return 0;
  if (!discountPct || discountPct <= 0) return baseRetailCents;
  return Math.round(baseRetailCents * (1 - discountPct));
}

export interface DisplayPriceInput {
  /** Base retail rate in minor units (selected variant wins over catalogue RRP). */
  baseRetailPriceCents: number;
  /** Real assigned tier discount from `trade_tier_config` — never a mock rate. */
  tradeDiscountMultiplier: number;
}

export interface DisplayPrice {
  isTrade: boolean;
  netCents: number | null;
  netLabel: string | null;
  netDisplay: string | null;
  retailFootnoteLabel: string | null;
}

/** Pure: derives every price label from the dataset + the active user role. */
export function computeDisplayPrice(
  data: DisplayPriceInput,
  role: PricingRole,
  currency = "USD",
  withFromPrefix = false,
): DisplayPrice {
  const fmt = (cents: number) => formatCents(cents, currency);

  if (
    role === "TRADE_VERIFIED" &&
    data.baseRetailPriceCents > 0 &&
    data.tradeDiscountMultiplier > 0
  ) {
    const netCents = applyTradeDiscount(data.baseRetailPriceCents, data.tradeDiscountMultiplier);
    const netLabel = fmt(netCents);
    return {
      isTrade: true,
      netCents,
      netLabel,
      netDisplay: `${withFromPrefix ? "From " : ""}${netLabel}`,
      retailFootnoteLabel: fmt(data.baseRetailPriceCents),
    };
  }

  return {
    isTrade: false,
    netCents: null,
    netLabel: null,
    netDisplay: null,
    retailFootnoteLabel:
      data.baseRetailPriceCents > 0 ? fmt(data.baseRetailPriceCents) : null,
  };
}
