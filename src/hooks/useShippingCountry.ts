import { useMemo } from "react";
import {
  getCartCbm,
  getEstimatedShipping,
  getShippingZone,
  type ShippingEstimateItem,
} from "@/config/shippingZones";


const OVERRIDE_KEY = "ma_shipping_country";

/**
 * Resolves the buyer's country code without a geo backend.
 * Priority: explicit prop → localStorage override (mock geolocation) →
 * browser locale region. Returns null when nothing can be resolved.
 */
export function detectCountryCode(fallback?: string | null): string | null {
  if (fallback) return fallback.trim().toUpperCase();
  try {
    const stored = localStorage.getItem(OVERRIDE_KEY);
    if (stored) return stored.trim().toUpperCase();
    // Header flag switcher / IP-geo cache (shared with trade display currency).
    const dest = localStorage.getItem("trade.detectedCountry");
    if (dest) return dest.trim().toUpperCase();
  } catch {
    /* private mode */
  }

  try {
    const locales = [
      ...(navigator.languages || []),
      navigator.language,
    ].filter(Boolean) as string[];
    for (const loc of locales) {
      const region = new Intl.Locale(loc).maximize().region;
      if (region) return region.toUpperCase();
    }
  } catch {
    /* unsupported */
  }
  return null;
}

export type EstimatedShipping = {
  countryCode: string | null;
  /** Estimated base freight in minor units (cents). 0 when unknown. */
  cents: number;
  /** Currency of the zone rate, when a zone matched. */
  currency: string | null;
  /** Display name of the matched zone (e.g. "Asia Pacific"), when a zone matched. */
  zoneLabel: string | null;
  available: boolean;
  /** Total crated volume of the cart used for the estimate. */
  cbm: number;
};

/**
 * Estimated freight for the detected (or provided) country, scaled by the
 * active cart lines: Base Country Zone Rate × Item Class Multiplier × qty.
 * Recomputes whenever quantities, finishes or products change.
 */
export function useEstimatedShipping(
  items?: ShippingEstimateItem[] | null,
  countryCode?: string | null,
): EstimatedShipping {
  // Stable dependency: only the fields that influence the freight maths.
  const signature = JSON.stringify(
    (items ?? []).map((i) => [
      i.title ?? "",
      i.category ?? "",
      i.itemClass ?? "",
      i.cbm ?? "",
      i.shippingModifier ?? "",
      i.quantity ?? 1,
      i.unitPriceCents ?? 0,
    ]),
  );
  return useMemo(() => {
    const code = detectCountryCode(countryCode);
    const rate = code ? getEstimatedShipping(code, items ?? null) : null;
    const zone = code ? getShippingZone(code) : null;
    return {
      countryCode: code,
      cents: rate != null ? Math.round(rate * 100) : 0,
      currency: zone?.currency ?? null,
      zoneLabel: zone?.label ?? null,
      available: rate != null,
      cbm: getCartCbm(items ?? null),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, signature]);
}


export const ESTIMATED_SHIPPING_NOTE =
  "Estimated Base Freight (Final quote verified by Advisor)";
