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
  const [breakdown, setBreakdown] = useState<ShippingBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=GBP");
        const d = await r.json();
        if (!cancelled && d?.rates?.GBP) setFxEurGbp(d.rates.GBP);
      } catch { /* swallow */ }
      if (quoteCurrency === "EUR") {
        if (!cancelled) setFxQuoteEur(1);
      } else {
        try {
          const r = await fetch(`https://api.frankfurter.app/latest?from=${quoteCurrency}&to=EUR`);
          const d = await r.json();
          if (!cancelled && d?.rates?.EUR) setFxQuoteEur(d.rates.EUR);
        } catch { /* swallow */ }
      }
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
