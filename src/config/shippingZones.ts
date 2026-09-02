export interface ShippingZone {
  /**
   * Reference freight rate for the zone: one full-size crated piece
   * (a sofa, REFERENCE_CBM cubic metres) in zone currency units.
   */
  baseRate: number;
  /** ISO 4217 currency code used for the zone's rates. */
  currency: string;
  /** ISO 3166-1 alpha-2 country codes covered by this zone. */
  countries: string[];
}

/**
 * Luxury furniture freight zones.
 * Base rates reflect white-glove, crated international freight for the
 * reference piece; the per-CBM rate is derived from them.
 */
export const SHIPPING_ZONES: Record<string, ShippingZone> = {
  domesticEu: {
    baseRate: 1200,
    currency: "EUR",
    countries: ["FR", "DE", "IT"],
  },
  northAmerica: {
    baseRate: 5132,
    currency: "USD",
    countries: ["US", "CA"],
  },
  asiaPacific: {
    baseRate: 5800,
    currency: "USD",
    countries: ["SG", "JP", "AU"],
  },
} as const;

/** Fallback zone applied when a country is not matched to any zone. */
export const DEFAULT_SHIPPING_ZONE: ShippingZone = {
  baseRate: 6400,
  currency: "USD",
  countries: [],
};

const COUNTRY_TO_ZONE = new Map<string, ShippingZone>();
for (const zone of Object.values(SHIPPING_ZONES)) {
  for (const code of zone.countries) {
    COUNTRY_TO_ZONE.set(code.toUpperCase(), zone);
  }
}

/* ------------------------------------------------------------------ */
/* Volumetric model (CBM)                                              */
/* ------------------------------------------------------------------ */

/** Crated volume of the reference piece (a sofa), in cubic metres. */
export const REFERENCE_CBM = 2.5;

/** Minimum billable volume for any shipment. */
export const MIN_SHIPMENT_CBM = 0.5;

/** Base country rate per cubic metre. */
export function getRatePerCbm(zone: ShippingZone): number {
  return zone.baseRate / REFERENCE_CBM;
}

export type ShippingItemClass =
  | "sofa"
  | "cabinet"
  | "table"
  | "bed"
  | "armchair"
  | "chair"
  | "lighting"
  | "accessory";

/** Typical crated volume per class, in cubic metres. */
export const ITEM_CLASS_CBM: Record<ShippingItemClass, number> = {
  sofa: 2.5,
  cabinet: 2.2,
  bed: 2.0,
  table: 1.8,
  armchair: 1.0,
  chair: 0.6,
  lighting: 0.4,
  accessory: 0.25,
};

/** Legacy view of the same model: class volume as a share of the reference. */
export const ITEM_CLASS_MODIFIERS: Record<ShippingItemClass, number> = Object.fromEntries(
  Object.entries(ITEM_CLASS_CBM).map(([k, v]) => [k, v / REFERENCE_CBM]),
) as Record<ShippingItemClass, number>;

/** Applied when nothing can be inferred (mid-size piece assumption). */
export const DEFAULT_ITEM_CBM = ITEM_CLASS_CBM.armchair;
export const DEFAULT_ITEM_MODIFIER = DEFAULT_ITEM_CBM / REFERENCE_CBM;

/** Keyword hints, ordered — first match wins. */
const CLASS_HINTS: [ShippingItemClass, RegExp][] = [
  ["sofa", /\b(sofa|settee|couch|daybed|chaise|banquette|modular)\b/i],
  ["cabinet", /\b(cabinet|sideboard|credenza|armoire|bookcase|dresser|commode|shelving|wardrobe)\b/i],
  ["bed", /\b(bed|headboard)\b/i],
  ["table", /\b(table|desk|console|bureau)\b/i],
  ["armchair", /\b(armchair|lounge chair|club chair|bergère|bergere|wing chair|swivel)\b/i],
  ["chair", /\b(chair|stool|bench|ottoman|pouf|footstool)\b/i],
  ["lighting", /\b(lamp|light|sconce|chandelier|pendant|lantern)\b/i],
  ["accessory", /\b(mirror|tray|vase|box|rug|cushion|object|sculpture|screen)\b/i],
];

/** Infers an item class from a product title / category string. */
export function inferItemClass(text?: string | null): ShippingItemClass | null {
  if (!text) return null;
  for (const [cls, re] of CLASS_HINTS) {
    if (re.test(text)) return cls;
  }
  return null;
}

/** Cart / catalogue shape needed to price freight. */
export interface ShippingEstimateItem {
  title?: string | null;
  category?: string | null;
  /** Explicit crated volume per unit, in cubic metres (wins over inference). */
  cbm?: number | null;
  /** Legacy multiplier of the reference piece — converted to CBM. */
  shippingModifier?: number | null;
  itemClass?: ShippingItemClass | null;
  quantity?: number | null;
  /** Retail value of a single unit, in minor units (cents). */
  unitPriceCents?: number | null;
}

/** Resolves the crated volume (CBM) of one unit of a line item. */
export function getItemCbm(item: ShippingEstimateItem): number {
  if (typeof item.cbm === "number" && item.cbm > 0) return item.cbm;
  if (typeof item.shippingModifier === "number" && item.shippingModifier > 0) {
    return item.shippingModifier * REFERENCE_CBM;
  }
  const cls =
    item.itemClass ?? inferItemClass(item.category) ?? inferItemClass(item.title);
  return cls ? ITEM_CLASS_CBM[cls] : DEFAULT_ITEM_CBM;
}

/** Legacy accessor kept for callers thinking in multipliers. */
export function getItemShippingModifier(item: ShippingEstimateItem): number {
  return getItemCbm(item) / REFERENCE_CBM;
}

/** Total crated volume of the cart, scaled by quantity. */
export function getCartCbm(items?: ShippingEstimateItem[] | null): number {
  if (!items?.length) return 0;
  const total = items.reduce((sum, item) => {
    const qty = Math.max(1, Math.round(item.quantity ?? 1));
    return sum + getItemCbm(item) * qty;
  }, 0);
  return total > 0 ? Math.max(MIN_SHIPMENT_CBM, Number(total.toFixed(2))) : 0;
}

/**
 * Estimated freight for a country.
 *
 * Formula: Base Country Rate per CBM × Total Cart CBM.
 * Adding a second armchair doubles that line's volume, so the estimate
 * scales linearly. With no items the reference-piece base rate is returned.
 * Unknown country → null.
 */
export function getEstimatedShipping(
  countryCode: string,
  items?: ShippingEstimateItem[] | null,
): number | null {
  if (!countryCode) return null;
  const zone = COUNTRY_TO_ZONE.get(countryCode.trim().toUpperCase());
  if (!zone) return null;
  if (!items || items.length === 0) return zone.baseRate;
  const cbm = getCartCbm(items);
  if (cbm <= 0) return 0;
  return Math.round(getRatePerCbm(zone) * cbm);
}

/** Resolves the full zone (rate + currency) for a country code. Unknown countries return null. */
export function getShippingZone(countryCode: string): ShippingZone | null {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_TO_ZONE.get(code) ?? null;
}
