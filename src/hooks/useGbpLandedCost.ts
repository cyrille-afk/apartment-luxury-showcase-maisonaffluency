/**
 * useGbpLandedCost
 * ----------------
 * Shared hook powering both the UkLandedCostPanel and the totals-block
 * GBP DDP toggle. Converts a goods-after-discount amount (in any quote
 * currency) into a fully-loaded GBP DDP figure for delivery to London,
 * using FR→GB shipping lanes, UK duty/VAT, and a +2% FX buffer.
 */
import { useEffect, useMemo, useState } from "react";
import { estimateShipping, ShippingBreakdown } from "@/lib/shippingEstimator";
import { getFxRate, getFxSource } from "@/lib/fxRates";

export const FX_BUFFER = 0.02; // +2% safety margin on EUR→GBP

export interface GbpLandedCostInput {
  goodsAfterDiscountCents: number;
  quoteCurrency: string;
  cbm?: number;
  kg?: number;
  mode?: "road" | "courier";
  category?: "furniture" | "lighting" | "art" | "textile" | "accessory" | "other";
  /**
   * Optional per-line shipping override (already aggregated, in EUR cents).
   * When provided, replaces the panel's single-shipment estimator call —
   * caller is responsible for summing freight, duty and VAT across all
   * origin shipments.
   */
  overrideShipping?: {
    shippingEurCents: number;
    dutyEurCents: number;
    vatEurCents: number;
    shipmentCount?: number;
    totalCbm?: number;
    totalKg?: number;
  } | null;
}

export interface GbpLandedCostResult {
  ready: boolean;
  loading: boolean;
  fxEurGbp: number | null;
  fxQuoteEur: number | null;
  fxIsFallback: boolean;
  goodsGbpCents: number;
  freightGbpCents: number;
  fuelGbpCents: number;
  insuranceGbpCents: number;
  customsGbpCents: number;
  handlingGbpCents: number;
  lastMileGbpCents: number;
  shippingGbpCents: number; // sum of all freight-side lines
  dutyGbpCents: number;
  vatGbpCents: number;
  totalGbpCents: number;
  breakdown: ShippingBreakdown | null;
  goodsEurCents: number;
}

export const DEFAULT_GBP_LANDED_CBM = 2;
export const GBP_LANDED_KG_PER_CBM: Record<"road" | "courier", number> = {
  road: 333,
  courier: 200,
};

// Hardcoded sane defaults (mid-2025 indicative). Used only when both live
// FX endpoints fail (e.g. CORS-blocked preview environments).
export const FALLBACK_TO_EUR: Record<string, number> = {
  EUR: 1,
  GBP: 1.17,
  USD: 0.92,
  SGD: 0.69,
  AUD: 0.61,
  CAD: 0.68,
  CHF: 1.05,
  JPY: 0.0061,
  HKD: 0.118,
  AED: 0.25,
};
const FALLBACK_EUR_TO_GBP = 0.85;

/** Read the platform rate table → hardcoded fallback. Always resolves.
 *  The browser never calls an FX provider directly. */
export const fetchFx = async (
  from: string,
  to: string
): Promise<{ rate: number; isFallback: boolean }> => {
  if (from === to) return { rate: 1, isFallback: false };
  try {
    const v = await getFxRate(from, to);
    if (typeof v === "number" && v > 0 && getFxSource(from, to) === "database") {
      return { rate: v, isFallback: false };
    }
  } catch { /* fall through to the bundled table */ }
  // Source 3 — hardcoded fallback
  if (to === "EUR" && FALLBACK_TO_EUR[from]) {
    return { rate: FALLBACK_TO_EUR[from], isFallback: true };
  }
  if (from === "EUR" && to === "GBP") {
    return { rate: FALLBACK_EUR_TO_GBP, isFallback: true };
  }
  if (from === "EUR" && FALLBACK_TO_EUR[to]) {
    return { rate: 1 / FALLBACK_TO_EUR[to], isFallback: true };
  }
  const fromEur = FALLBACK_TO_EUR[from];
  const toEur = FALLBACK_TO_EUR[to];
  if (fromEur && toEur) return { rate: fromEur / toEur, isFallback: true };
  return { rate: 1, isFallback: true };
};

export const useGbpLandedCost = ({
  goodsAfterDiscountCents,
  quoteCurrency,
  cbm = DEFAULT_GBP_LANDED_CBM,
  kg,
  mode = "road",
  category = "furniture",
  overrideShipping = null,
}: GbpLandedCostInput): GbpLandedCostResult => {
  const [fxEurGbp, setFxEurGbp] = useState<number | null>(null);
  const [fxQuoteEur, setFxQuoteEur] = useState<number | null>(null);
  const [fxIsFallback, setFxIsFallback] = useState(false);
  const [breakdown, setBreakdown] = useState<ShippingBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eg, qe] = await Promise.all([
        fetchFx("EUR", "GBP"),
        fetchFx(quoteCurrency, "EUR"),
      ]);
      if (cancelled) return;
      setFxEurGbp(eg.rate);
      setFxQuoteEur(qe.rate);
      setFxIsFallback(eg.isFallback || qe.isFallback);
    })();
    return () => { cancelled = true; };
  }, [quoteCurrency]);

  const goodsEurCents = useMemo(() => {
    if (!fxQuoteEur || goodsAfterDiscountCents <= 0) return 0;
    return Math.round(goodsAfterDiscountCents * fxQuoteEur);
  }, [goodsAfterDiscountCents, fxQuoteEur]);

  const chargeableKg = kg ?? Math.round(cbm * GBP_LANDED_KG_PER_CBM[mode]);
  const useOverride = !!overrideShipping;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (useOverride || goodsEurCents <= 0) { setBreakdown(null); return; }
      setLoading(true);
      try {
        const b = await estimateShipping({
          origin_country: "FR",
          dest_country: "GB",
          total_volume_cbm: cbm,
          total_weight_kg: chargeableKg,
          declared_value_cents: goodsEurCents,
          currency: "EUR",
          preferred_mode: mode,
          category,
        });
        if (!cancelled) setBreakdown(b);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [cbm, chargeableKg, mode, category, goodsEurCents, useOverride]);

  const eurToGbp = (eurCents: number): number => {
    if (!fxEurGbp) return 0;
    return Math.round(eurCents * fxEurGbp * (1 + FX_BUFFER));
  };

  const goodsGbpCents = eurToGbp(goodsEurCents);

  // When per-line override is supplied, freight/duty/VAT come pre-summed in EUR.
  const shippingEurOverride = overrideShipping?.shippingEurCents ?? 0;
  const dutyEurOverride = overrideShipping?.dutyEurCents ?? 0;
  const vatEurOverride = overrideShipping?.vatEurCents ?? 0;

  const freightGbpCents = useOverride ? 0 : eurToGbp(breakdown?.freight_cents ?? 0);
  const fuelGbpCents = useOverride ? 0 : eurToGbp(breakdown?.fuel_cents ?? 0);
  const insuranceGbpCents = useOverride ? 0 : eurToGbp(breakdown?.insurance_cents ?? 0);
  const customsGbpCents = useOverride ? 0 : eurToGbp(breakdown?.customs_cents ?? 0);
  const handlingGbpCents = useOverride ? 0 : eurToGbp(breakdown?.handling_cents ?? 0);
  const lastMileGbpCents = useOverride ? 0 : eurToGbp(breakdown?.last_mile_cents ?? 0);
  const shippingGbpCents = useOverride
    ? eurToGbp(shippingEurOverride)
    : freightGbpCents + fuelGbpCents + insuranceGbpCents
      + customsGbpCents + handlingGbpCents + lastMileGbpCents;
  const dutyGbpCents = useOverride ? eurToGbp(dutyEurOverride) : eurToGbp(breakdown?.duty_cents ?? 0);
  const vatGbpCents = useOverride ? eurToGbp(vatEurOverride) : eurToGbp(breakdown?.vat_cents ?? 0);
  const totalGbpCents = goodsGbpCents + shippingGbpCents + dutyGbpCents + vatGbpCents;

  return {
    ready: fxEurGbp != null && fxQuoteEur != null,
    loading,
    fxEurGbp,
    fxQuoteEur,
    fxIsFallback,
    goodsGbpCents,
    freightGbpCents,
    fuelGbpCents,
    insuranceGbpCents,
    customsGbpCents,
    handlingGbpCents,
    lastMileGbpCents,
    shippingGbpCents,
    dutyGbpCents,
    vatGbpCents,
    totalGbpCents,
    breakdown,
    goodsEurCents,
  };
};

export const fmtGbp = (cents: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
