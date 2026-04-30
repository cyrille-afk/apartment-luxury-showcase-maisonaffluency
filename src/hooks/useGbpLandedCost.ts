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

export const FX_BUFFER = 0.02; // +2% safety margin on EUR→GBP

export interface GbpLandedCostInput {
  goodsAfterDiscountCents: number;
  quoteCurrency: string;
  cbm?: number;
  kg?: number;
  mode?: "road" | "courier";
  category?: "furniture" | "lighting" | "art" | "textile" | "accessory" | "other";
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

// Hardcoded sane defaults (mid-2025 indicative). Used only when both live
// FX endpoints fail (e.g. CORS-blocked preview environments).
const FALLBACK_TO_EUR: Record<string, number> = {
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

/** Try frankfurter → exchangerate.host → hardcoded fallback. Always resolves. */
const fetchFx = async (
  from: string,
  to: string
): Promise<{ rate: number; isFallback: boolean }> => {
  if (from === to) return { rate: 1, isFallback: false };
  const withTimeout = (url: string, ms = 4000) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ms);
    return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
  };
  // Source 1 — Frankfurter
  try {
    const r = await withTimeout(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    if (r.ok) {
      const d = await r.json();
      const v = d?.rates?.[to];
      if (typeof v === "number" && v > 0) return { rate: v, isFallback: false };
    }
  } catch { /* try next */ }
  // Source 2 — exchangerate.host
  try {
    const r = await withTimeout(`https://api.exchangerate.host/latest?base=${from}&symbols=${to}`);
    if (r.ok) {
      const d = await r.json();
      const v = d?.rates?.[to];
      if (typeof v === "number" && v > 0) return { rate: v, isFallback: false };
    }
  } catch { /* fall through */ }
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
  cbm = 2,
  kg = 200,
  mode = "road",
  category = "furniture",
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (goodsEurCents <= 0) { setBreakdown(null); return; }
      setLoading(true);
      try {
        const b = await estimateShipping({
          origin_country: "FR",
          dest_country: "GB",
          total_volume_cbm: cbm,
          total_weight_kg: kg,
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
  }, [cbm, kg, mode, category, goodsEurCents]);

  const eurToGbp = (eurCents: number): number => {
    if (!fxEurGbp) return 0;
    return Math.round(eurCents * fxEurGbp * (1 + FX_BUFFER));
  };

  const goodsGbpCents = eurToGbp(goodsEurCents);
  const freightGbpCents = eurToGbp(breakdown?.freight_cents ?? 0);
  const fuelGbpCents = eurToGbp(breakdown?.fuel_cents ?? 0);
  const insuranceGbpCents = eurToGbp(breakdown?.insurance_cents ?? 0);
  const customsGbpCents = eurToGbp(breakdown?.customs_cents ?? 0);
  const handlingGbpCents = eurToGbp(breakdown?.handling_cents ?? 0);
  const lastMileGbpCents = eurToGbp(breakdown?.last_mile_cents ?? 0);
  const shippingGbpCents =
    freightGbpCents + fuelGbpCents + insuranceGbpCents +
    customsGbpCents + handlingGbpCents + lastMileGbpCents;
  const dutyGbpCents = eurToGbp(breakdown?.duty_cents ?? 0);
  const vatGbpCents = eurToGbp(breakdown?.vat_cents ?? 0);
  const totalGbpCents = goodsGbpCents + shippingGbpCents + dutyGbpCents + vatGbpCents;

  return {
    ready: fxEurGbp != null && fxQuoteEur != null,
    loading,
    fxEurGbp,
    fxQuoteEur,
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
