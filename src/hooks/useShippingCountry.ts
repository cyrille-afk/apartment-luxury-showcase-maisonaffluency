import { useMemo } from "react";
import {
  getCartCbm,
  getEstimatedShipping,
  getShippingZone,
  type ShippingEstimateItem,
} from "@/config/shippingZones";
import {
  convertCents,
  useFxRates,
  type DisplayCurrency,
} from "@/components/trade/CurrencyToggle";


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
  /** Estimated base freight in minor units (cents), after the safety cap. */
  cents: number;
  /** Raw engine figure before the 15% safety cap. */
  uncappedCents: number;
  /** True when freight exceeded 15% of the order value and was capped. */
  capped: boolean;
  /** Advisor-validation copy to display when capped, otherwise null. */
  notice: string | null;
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
 * active cart lines: Base Country Zone Rate × consolidated cart CBM.
 * When `orderValueCents` is supplied, the figure is capped at 15% of the
 * order value and flagged for advisor validation.
 * Recomputes whenever quantities, finishes or products change.
 */
export function useEstimatedShipping(
  items?: ShippingEstimateItem[] | null,
  countryCode?: string | null,
  /** Currency the estimate should be expressed in (usually the cart currency). */
  targetCurrency?: string | null,
  /** Order value (goods, after discount) in the same currency, minor units. */
  orderValueCents?: number | null,
): EstimatedShipping {
  const fxRates = useFxRates();
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
    const zoneCcy = zone?.currency ?? null;
    const target = (targetCurrency || zoneCcy || "").toUpperCase() || null;
    const zoneCents = rate != null ? Math.round(rate * 100) : 0;
    // Freight rates are stored per zone in the zone's own currency — convert
    // them into the currency the cart/checkout is priced in before display.
    const converted =
      zoneCents > 0 && zoneCcy && target && target !== zoneCcy
        ? convertCents(zoneCents, zoneCcy, target as DisplayCurrency, fxRates)
        : zoneCents;
    // Never quote an unconverted figure under a different currency label.
    const unconvertible =
      zoneCents > 0 && zoneCcy && target && target !== zoneCcy && converted === zoneCents;
    const shown = unconvertible ? 0 : converted;
    // Fragile/luxury safety net: freight above 15% of the order value is
    // shown as an initial deposit pending advisor validation.
    const cap = applyFreightCap(shown, orderValueCents ?? 0);
    return {
      countryCode: code,
      cents: cap.cents,
      uncappedCents: cap.uncappedCents,
      capped: cap.capped,
      notice: cap.notice,
      currency: unconvertible ? zoneCcy : target ?? zoneCcy,
      zoneLabel: zone?.label ?? null,
      available: rate != null && !unconvertible,
      cbm: getCartCbm(items ?? null),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, signature, targetCurrency, fxRates, orderValueCents]);
}



export const ESTIMATED_SHIPPING_NOTE =
  "Estimated Base Freight — Excludes Destination Duties & GST (Final quote verified by Advisor)";
