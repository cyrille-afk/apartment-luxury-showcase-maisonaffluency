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
 * Base rates reflect white-glove, crated international freight.
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

/**
 * Returns the base shipping rate for a country code, or null when the
 * country is unknown and no fallback should be applied.
 * Unknown countries resolve to the Rest of World fallback rate.
 */
export function getEstimatedShipping(countryCode: string): number | null {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return null;

  const zone = COUNTRY_TO_ZONE.get(code) ?? DEFAULT_SHIPPING_ZONE;
  return zone.baseRate;
}

/** Resolves the full zone (rate + currency) for a country code. */
export function getShippingZone(countryCode: string): ShippingZone | null {
  if (!countryCode) return null;
  const code = countryCode.trim().toUpperCase();
  if (code.length !== 2 || !/^[A-Z]{2}$/.test(code)) return null;
  return COUNTRY_TO_ZONE.get(code) ?? DEFAULT_SHIPPING_ZONE;
}
