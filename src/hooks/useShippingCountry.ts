import { useMemo } from "react";
import {
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
  available: boolean;
};

/** Estimated base freight for the detected (or provided) country. */
export function useEstimatedShipping(countryCode?: string | null): EstimatedShipping {
  return useMemo(() => {
    const code = detectCountryCode(countryCode);
    const rate = code ? getEstimatedShipping(code) : null;
    const zone = code ? getShippingZone(code) : null;
    return {
      countryCode: code,
      cents: rate != null ? Math.round(rate * 100) : 0,
      currency: zone?.currency ?? null,
      available: rate != null,
    };
  }, [countryCode]);
}

export const ESTIMATED_SHIPPING_NOTE =
  "Estimated Base Freight (Final quote verified by Advisor)";
