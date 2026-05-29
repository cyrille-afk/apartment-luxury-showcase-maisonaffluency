/**
 * useHkdLandedCost
 * ----------------
 * Hong Kong DAP landed-cost helper, mirroring useGbpLandedCost.
 * Converts goods (in any quote currency) → EUR, prices FR→HK shipping
 * (sea LCL default, air optional), applies HK duties (free port → 0%),
 * then displays the figure in HKD with a +2% FX buffer.
 *
 * Quote currency is untouched; this is a side-panel helper for HK clients.
 */
import { useEffect, useMemo, useState } from "react";
import { estimateShipping, ShippingBreakdown } from "@/lib/shippingEstimator";
import { FX_BUFFER, fetchFx } from "@/hooks/useGbpLandedCost";

export type HkMode = "sea_lcl" | "air";

export interface HkdLandedCostInput {
  goodsAfterDiscountCents: number;
  quoteCurrency: string;
  cbm?: number;
  kg?: number;
  mode?: HkMode;
  category?: "furniture" | "lighting" | "art" | "textile" | "accessory" | "other";
  /**
   * Optional per-line shipping override (already aggregated, in EUR cents).
   * When provided, replaces the panel's single-shipment estimator call.
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

export interface HkdLandedCostResult {
  ready: boolean;
  loading: boolean;
  fxEurHkd: number | null;
  fxQuoteEur: number | null;
  fxIsFallback: boolean;
  goodsHkdCents: number;
  freightHkdCents: number;
  fuelHkdCents: number;
  insuranceHkdCents: number;
  customsHkdCents: number;
  handlingHkdCents: number;
  lastMileHkdCents: number;
  shippingHkdCents: number;
  dutyHkdCents: number;
  vatHkdCents: number;
  totalHkdCents: number;
  breakdown: ShippingBreakdown | null;
  goodsEurCents: number;
  shippingEurCents: number;
  totalEurCents: number;
}

export const DEFAULT_HKD_LANDED_CBM = 1;
/** Sea LCL volumetric is generous (350 kg/m³); air is much denser (167). */
export const HKD_LANDED_KG_PER_CBM: Record<HkMode, number> = {
  sea_lcl: 350,
  air: 167,
};

export const useHkdLandedCost = ({
  goodsAfterDiscountCents,
  quoteCurrency,
  cbm = DEFAULT_HKD_LANDED_CBM,
  kg,
  mode = "sea_lcl",
  category = "furniture",
  overrideShipping = null,
}: HkdLandedCostInput): HkdLandedCostResult => {
  const [fxEurHkd, setFxEurHkd] = useState<number | null>(null);
  const [fxQuoteEur, setFxQuoteEur] = useState<number | null>(null);
  const [fxIsFallback, setFxIsFallback] = useState(false);
  const [breakdown, setBreakdown] = useState<ShippingBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [eh, qe] = await Promise.all([
        fetchFx("EUR", "HKD"),
        fetchFx(quoteCurrency, "EUR"),
      ]);
      if (cancelled) return;
      setFxEurHkd(eh.rate);
      setFxQuoteEur(qe.rate);
      setFxIsFallback(eh.isFallback || qe.isFallback);
    })();
    return () => { cancelled = true; };
  }, [quoteCurrency]);

  const goodsEurCents = useMemo(() => {
    if (!fxQuoteEur || goodsAfterDiscountCents <= 0) return 0;
    return Math.round(goodsAfterDiscountCents * fxQuoteEur);
  }, [goodsAfterDiscountCents, fxQuoteEur]);

  const chargeableKg = kg ?? Math.round(cbm * HKD_LANDED_KG_PER_CBM[mode]);
  const useOverride = !!overrideShipping;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (useOverride || goodsEurCents <= 0) { setBreakdown(null); return; }
      setLoading(true);
      try {
        const b = await estimateShipping({
          origin_country: "FR",
          dest_country: "HK",
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

  const eurToHkd = (eurCents: number): number => {
    if (!fxEurHkd) return 0;
    return Math.round(eurCents * fxEurHkd * (1 + FX_BUFFER));
  };

  const goodsHkdCents = eurToHkd(goodsEurCents);

  const shippingEurOverride = overrideShipping?.shippingEurCents ?? 0;
  const dutyEurOverride = overrideShipping?.dutyEurCents ?? 0;
  const vatEurOverride = overrideShipping?.vatEurCents ?? 0;

  const freightHkdCents = useOverride ? 0 : eurToHkd(breakdown?.freight_cents ?? 0);
  const fuelHkdCents = useOverride ? 0 : eurToHkd(breakdown?.fuel_cents ?? 0);
  const insuranceHkdCents = useOverride ? 0 : eurToHkd(breakdown?.insurance_cents ?? 0);
  const customsHkdCents = useOverride ? 0 : eurToHkd(breakdown?.customs_cents ?? 0);
  const handlingHkdCents = useOverride ? 0 : eurToHkd(breakdown?.handling_cents ?? 0);
  const lastMileHkdCents = useOverride ? 0 : eurToHkd(breakdown?.last_mile_cents ?? 0);
  const shippingHkdCents = useOverride
    ? eurToHkd(shippingEurOverride)
    : freightHkdCents + fuelHkdCents + insuranceHkdCents
      + customsHkdCents + handlingHkdCents + lastMileHkdCents;
  const dutyHkdCents = useOverride ? eurToHkd(dutyEurOverride) : eurToHkd(breakdown?.duty_cents ?? 0);
  const vatHkdCents = useOverride ? eurToHkd(vatEurOverride) : eurToHkd(breakdown?.vat_cents ?? 0);
  const totalHkdCents = goodsHkdCents + shippingHkdCents + dutyHkdCents + vatHkdCents;

  const shippingEurCents = useOverride
    ? shippingEurOverride
    : (breakdown?.freight_cents ?? 0) + (breakdown?.fuel_cents ?? 0)
      + (breakdown?.insurance_cents ?? 0) + (breakdown?.customs_cents ?? 0)
      + (breakdown?.handling_cents ?? 0) + (breakdown?.last_mile_cents ?? 0);
  const totalEurCents = goodsEurCents + shippingEurCents
    + (useOverride ? dutyEurOverride : (breakdown?.duty_cents ?? 0))
    + (useOverride ? vatEurOverride : (breakdown?.vat_cents ?? 0));

  return {
    ready: fxEurHkd != null && fxQuoteEur != null,
    loading,
    fxEurHkd,
    fxQuoteEur,
    fxIsFallback,
    goodsHkdCents,
    freightHkdCents,
    fuelHkdCents,
    insuranceHkdCents,
    customsHkdCents,
    handlingHkdCents,
    lastMileHkdCents,
    shippingHkdCents,
    dutyHkdCents,
    vatHkdCents,
    totalHkdCents,
    breakdown,
    goodsEurCents,
    shippingEurCents,
    totalEurCents,
  };
};

export const fmtHkd = (cents: number) =>
  new Intl.NumberFormat("en-HK", {
    style: "currency",
    currency: "HKD",
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
