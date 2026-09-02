export interface ShippingZone {
  /** Base freight rate for the zone (in zone currency units). */
  baseRate: number;
  /** ISO 4217 currency code used for the zone's rates. */
  currency: string;
  /** ISO 3166-1 alpha-2 country codes covered by this zone. */
  countries: string[];
}

/**
 * Luxury furniture freight zones.
 * Base rates reflect white-glove, crated international freight for one
 * full-size piece (the reference class: a sofa, modifier 1.0).
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
/* Item class multipliers                                              */
/* ------------------------------------------------------------------ */

export type ShippingItemClass =
  | "sofa"
  | "cabinet"
  | "table"
  | "bed"
  | "armchair"
  | "chair"
  | "lighting"
  | "accessory";

/** Volumetric weight class → share of the zone base rate. */
export const ITEM_CLASS_MODIFIERS: Record<ShippingItemClass, number> = {
  sofa: 1.0,
  cabinet: 0.9,
  bed: 0.8,
  table: 0.7,
  armchair: 0.4,
  chair: 0.3,
  lighting: 0.2,
  accessory: 0.12,
};

/** Applied when nothing can be inferred (mid-size piece assumption). */
export const DEFAULT_ITEM_MODIFIER = ITEM_CLASS_MODIFIERS.armchair;

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
  /** Explicit override — takes precedence over inference. */
  shippingModifier?: number | null;
  itemClass?: ShippingItemClass | null;
  quantity?: number | null;
  /** Retail value of a single unit, in minor units (cents). */
  unitPriceCents?: number | null;
}

/** Share of retail value used as a sanity floor for mid-size pieces. */
export const VALUE_SHARE_FLOOR = 0.15;

/** Resolves the freight multiplier for one line item. */
export function getItemShippingModifier(item: ShippingEstimateItem): number {
  if (typeof item.shippingModifier === "number" && item.shippingModifier >= 0) {
    return item.shippingModifier;
  }
  const cls =
    item.itemClass ??
    inferItemClass(item.category) ??
    inferItemClass(item.title);
  return cls ? ITEM_CLASS_MODIFIERS[cls] : DEFAULT_ITEM_MODIFIER;
}

/**
 * Returns the estimated freight for a country code.
 *
 * Formula: Base Country Zone Rate × Item Class Multiplier, summed across
 * every cart line and scaled by quantity. With no items supplied the plain
 * zone base rate is returned (legacy behaviour). Unknown country → null.
 */
export function getEstimatedShipping(
  countryCode: string,
  items?: ShippingEstimateItem[] | null,
): number | null {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  const zone = COUNTRY_TO_ZONE.get(code);
  if (!zone) return null;
  if (!items || items.length === 0) return zone.baseRate;

  let total = 0;
  for (const item of items) {
    const qty = Math.max(1, Math.round(item.quantity ?? 1));
    const modifier = getItemShippingModifier(item);
    let perUnit = zone.baseRate * modifier;
    // Value floor: very expensive mid-size pieces carry heavier crating,
    // insurance and handling than their volumetric class suggests.
    const value = item.unitPriceCents != null ? item.unitPriceCents / 100 : 0;
    if (value > 0) {
      const classRate = zone.baseRate * modifier;
      perUnit = Math.max(
        perUnit,
        Math.min(value * VALUE_SHARE_FLOOR, classRate * 1.5, zone.baseRate),
      );
    }
    total += perUnit * qty;
  }
  return Math.round(total);
}

/** Resolves the full zone (rate + currency) for a country code. Unknown countries return null. */
export function getShippingZone(countryCode: string): ShippingZone | null {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_TO_ZONE.get(code) ?? null;
}
