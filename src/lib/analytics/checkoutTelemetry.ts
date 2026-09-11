/**
 * Checkout finalization telemetry.
 *
 * Fires one consolidated `purchase_finalized` event when an order completes
 * (card or wire). Every call is non-blocking and fully guarded: analytics can
 * never throw into — or slow down — the checkout completion route.
 */
import { trackEvent } from "@/lib/analytics";

/** Approximate country centroids for the destinations we ship to. */
const COUNTRY_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  GB: { lat: 54.0, lng: -2.0 },
  US: { lat: 39.8, lng: -98.6 },
  FR: { lat: 46.6, lng: 2.4 },
  DE: { lat: 51.2, lng: 10.4 },
  IT: { lat: 42.8, lng: 12.6 },
  ES: { lat: 40.2, lng: -3.7 },
  NL: { lat: 52.1, lng: 5.3 },
  BE: { lat: 50.6, lng: 4.6 },
  IE: { lat: 53.2, lng: -8.0 },
  PT: { lat: 39.6, lng: -8.0 },
  AT: { lat: 47.6, lng: 14.1 },
  LU: { lat: 49.8, lng: 6.1 },
  MC: { lat: 43.74, lng: 7.42 },
  GR: { lat: 39.1, lng: 22.0 },
  CH: { lat: 46.8, lng: 8.2 },
  LI: { lat: 47.16, lng: 9.55 },
  AE: { lat: 24.0, lng: 54.0 },
  SA: { lat: 24.0, lng: 45.0 },
  QA: { lat: 25.3, lng: 51.2 },
  KW: { lat: 29.3, lng: 47.5 },
  BH: { lat: 26.0, lng: 50.55 },
  OM: { lat: 21.5, lng: 55.9 },
  HK: { lat: 22.3, lng: 114.17 },
  SG: { lat: 1.35, lng: 103.82 },
  AU: { lat: -25.3, lng: 133.8 },
  CA: { lat: 56.1, lng: -106.3 },
  MX: { lat: 23.6, lng: -102.5 },
};

export interface OrderFinalizedTelemetry {
  /** Unique order reference shown to the buyer. */
  orderReference: string;
  /** Settlement currency of the charge (SGD / EUR / CHF / USD …). */
  currency: string;
  /** Gross settlement value in minor units. */
  grossCents: number;
  /** 'B2C Private' or 'Trade Partner Silver' / 'Gold' / 'Platinum'. */
  accountGroup: string;
  /** Destination ISO-2 of the project shipping location. */
  destinationIso: string | null;
  /** Destination country name. */
  destinationName: string | null;
  /** True when local tax is settled at the border instead of at checkout. */
  isTaxDeferredToBorder: boolean;
  /** Tax collected at checkout, minor units. */
  taxCents: number;
  /** Initial freight / transit deposit charged now, minor units. */
  freightDepositCents: number;
  /** 'card' | 'wire' | 'paynow'. */
  paymentMethod: string;
  /** Number of distinct lines in the order. */
  lineCount: number;
}

/** Runs a side-effect off the critical path, swallowing every error. */
function runDetached(fn: () => void) {
  const safe = () => {
    try {
      fn();
    } catch (err) {
      if (typeof console !== "undefined") {
        console.warn("[telemetry] tracking failed (non-blocking):", err);
      }
    }
  };
  try {
    if (typeof window === "undefined") return;
    const idle = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    if (idle) idle(safe, { timeout: 2000 });
    else setTimeout(safe, 0);
  } catch {
    /* scheduling itself must never break checkout */
  }
}

/**
 * Emits the consolidated order-finalized analytics event.
 * Always safe to call — never throws, never blocks.
 */
export function trackOrderFinalized(payload: OrderFinalizedTelemetry) {
  runDetached(() => {
    const iso = (payload.destinationIso || "").toUpperCase();
    const coords = COUNTRY_CENTROIDS[iso] ?? null;
    const value = Number((payload.grossCents / 100).toFixed(2));

    const params = {
      transaction_id: payload.orderReference,
      order_reference: payload.orderReference,
      currency: (payload.currency || "usd").toUpperCase(),
      value,
      gross_settlement_cents: payload.grossCents,
      account_group: payload.accountGroup,
      shipping_country: iso || "UNKNOWN",
      shipping_country_name: payload.destinationName || "Unknown",
      shipping_latitude: coords ? coords.lat : 0,
      shipping_longitude: coords ? coords.lng : 0,
      isTaxDeferredToBorder: payload.isTaxDeferredToBorder,
      tax_collected_cents: payload.taxCents,
      tax: Number((payload.taxCents / 100).toFixed(2)),
      freight_deposit_cents: payload.freightDepositCents,
      shipping: Number((payload.freightDepositCents / 100).toFixed(2)),
      payment_method: payload.paymentMethod,
      line_count: payload.lineCount,
    } as const;

    trackEvent("purchase_finalized", params as any);

    // Mirror into dataLayer so GTM-side tags receive the same payload.
    const w = window as any;
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: "purchase_finalized", ...params });
    }
  });
}
