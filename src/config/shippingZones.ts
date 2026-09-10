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
  /** Human-readable zone name shown in the checkout order summary. */
  label: string;
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
    countries: [
      "FR", "DE", "IT", "ES", "NL", "BE", "IE", "PT", "AT",
      "LU", "MC", "GR", "GB",
    ],
    label: "Domestic EU",
  },
  // Switzerland sits outside the EU customs union: shipments cross a third-
  // country border and are cleared, taxed and duty-assessed on entry.
  switzerland: {
    baseRate: 1600,
    currency: "CHF",
    countries: ["CH", "LI"],
    label: "International Shipping (Switzerland)",
  },

  northAmerica: {
    baseRate: 5132,
    currency: "USD",
    countries: ["US", "CA", "MX"],
    label: "North America",
  },
  middleEast: {
    baseRate: 4800,
    currency: "USD",
    countries: ["AE", "SA", "QA", "KW", "BH", "OM"],
    label: "Middle East",
  },
  asiaPacific: {
    baseRate: 5800,
    currency: "USD",
    countries: ["SG", "JP", "AU", "HK", "NZ", "KR", "TW", "MY", "TH", "ID"],
    label: "Asia Pacific",
  },
} as const;


/** Fallback zone applied when a country is not matched to any zone. */
export const DEFAULT_SHIPPING_ZONE: ShippingZone = {
  baseRate: 6400,
  currency: "USD",
  countries: [],
  label: "Rest of World",
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
  // Lighting first: "Lantern Table Lamp" / "Console Floor Light" must never be
  // priced as a dining table — that misread was inflating freight ~4×.
  ["lighting", /\b(lamp|lamps|light|lights|sconce|chandelier|pendant|lantern|luminaire)\b/i],
  ["sofa", /\b(sofa|settee|couch|daybed|chaise|banquette|modular)\b/i],
  ["cabinet", /\b(cabinet|sideboard|credenza|armoire|bookcase|dresser|commode|shelving|wardrobe)\b/i],
  ["bed", /\b(bed|headboard)\b/i],
  ["table", /\b(table|desk|console|bureau)\b/i],
  ["armchair", /\b(armchair|lounge chair|club chair|bergère|bergere|wing chair|swivel)\b/i],
  ["chair", /\b(chair|stool|bench|ottoman|pouf|footstool)\b/i],
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

/**
 * Share of the crated volume that each ADDITIONAL identical unit adds.
 *
 * The published per-class CBM is a single crated piece: net product volume
 * plus crate tare (timber frame, corner blocking, foam void). When several
 * units of the same line ship together they are consolidated into one crate
 * or nested onto one pallet, so the tare is paid once — not per unit.
 * Fragile small pieces (lighting, accessories) nest far better than case
 * goods, hence the lower factors.
 */
export const CONSOLIDATION_FACTOR: Record<ShippingItemClass, number> = {
  sofa: 0.85,
  cabinet: 0.85,
  bed: 0.85,
  table: 0.8,
  armchair: 0.75,
  chair: 0.65,
  lighting: 0.55,
  accessory: 0.5,
};

/** Applied when the item class cannot be inferred. */
export const DEFAULT_CONSOLIDATION_FACTOR = 0.75;

/** Resolves the class used for consolidation (null when unknown). */
export function resolveItemClass(item: ShippingEstimateItem): ShippingItemClass | null {
  return item.itemClass ?? inferItemClass(item.category) ?? inferItemClass(item.title);
}

/**
 * Billable crated volume of one cart line, quantity included.
 * First unit at full crate volume, each additional unit at its consolidation
 * factor — so two lamps never carry two full container tares.
 */
export function getLineCbm(item: ShippingEstimateItem): number {
  const qty = Math.max(1, Math.round(item.quantity ?? 1));
  const unit = getItemCbm(item);
  if (qty === 1) return unit;
  const cls = resolveItemClass(item);
  const factor = cls ? CONSOLIDATION_FACTOR[cls] : DEFAULT_CONSOLIDATION_FACTOR;
  return unit + unit * factor * (qty - 1);
}

/** Total crated volume of the cart, consolidated per line. */
export function getCartCbm(items?: ShippingEstimateItem[] | null): number {
  if (!items?.length) return 0;
  const total = items.reduce((sum, item) => sum + getLineCbm(item), 0);
  return total > 0 ? Math.max(MIN_SHIPMENT_CBM, Number(total.toFixed(2))) : 0;
}

/* ------------------------------------------------------------------ */
/* Freight safety cap                                                  */
/* ------------------------------------------------------------------ */

/** Freight is never displayed above this share of the order value. */
export const FREIGHT_CAP_RATIO = 0.15;

export const FREIGHT_CAP_NOTICE =
  "Oversized shipping quote requires advisor validation. Initial freight deposit shown below.";

export interface CappedFreight {
  /** Freight to display, in minor units. */
  cents: number;
  /** Raw engine output before the cap, in minor units. */
  uncappedCents: number;
  capped: boolean;
  /** Advisor-validation copy when capped, otherwise null. */
  notice: string | null;
}

/**
 * Caps a freight figure at {@link FREIGHT_CAP_RATIO} of the order value.
 * Above the cap the shown amount becomes an initial freight deposit and the
 * order is routed to an advisor for validation.
 */
export function applyFreightCap(
  freightCents: number,
  orderValueCents: number,
): CappedFreight {
  const freight = Math.max(0, Math.round(freightCents || 0));
  const value = Math.max(0, Math.round(orderValueCents || 0));
  const ceiling = Math.round(value * FREIGHT_CAP_RATIO);
  if (freight <= 0 || value <= 0 || freight <= ceiling) {
    return { cents: freight, uncappedCents: freight, capped: false, notice: null };
  }
  return {
    cents: ceiling,
    uncappedCents: freight,
    capped: true,
    notice: FREIGHT_CAP_NOTICE,
  };
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

/** Resolves the display label of the shipping zone for a country code (e.g. "Asia Pacific"). */
export function getShippingZoneLabel(countryCode: string): string | null {
  return getShippingZone(countryCode)?.label ?? null;
}
