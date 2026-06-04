/**
 * Hong Kong Landed Cost Panel (DAP, HKD)
 * --------------------------------------
 * Mirrors UkLandedCostPanel. Converts goods → EUR → HKD with FX buffer,
 * runs FR→HK shipping estimator (sea LCL default, air optional), shows
 * a courtesy HKD landed cost. HK is a free port: duty / VAT = 0.
 */
import { useEffect, useRef, useState } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Truck, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import {
  DEFAULT_HKD_LANDED_CBM, HKD_LANDED_KG_PER_CBM,
  useHkdLandedCost, fmtHkd, type HkMode,
} from "@/hooks/useHkdLandedCost";
import { FX_BUFFER } from "@/hooks/useGbpLandedCost";

interface Props {
  goodsAfterDiscountCents: number;
  quoteCurrency: string;
  category?: "furniture" | "lighting" | "art" | "textile" | "accessory" | "other";
  defaultExpanded?: boolean;
  title?: string;
  quoteRef?: string;
  clientName?: string | null;
  initialCbm?: number | null;
  initialKg?: number | null;
  initialMode?: HkMode | null;
  onSettingsChange?: (settings: { cbm: number; kg: number; mode: HkMode }) => void;
  /**
   * When provided, the panel uses the pre-aggregated per-line shipping totals
   * (one shipment per origin) instead of running its own single-shipment
   * estimator. CBM / kg / mode controls are hidden because the figures come
   * from the per-line packing recap above.
   */
  overrideShipping?: {
    shippingEurCents: number;
    dutyEurCents: number;
    vatEurCents: number;
    shipmentCount?: number;
    totalCbm?: number;
    totalKg?: number;
  } | null;
  /** Per-origin shipment summary used in the PDF (so each origin's mode
   *  is shown rather than the panel's single-mode dropdown value). */
  shipmentOrigins?: Array<{
    country: string;
    modeLabel: string;
    totalCbm: number;
    totalKg: number;
    eurCents: number;
  }> | null;
  /** Sum of all `trade_quote_extras` rows for this quote, in quote currency cents.
   *  Converted to HKD (via fxQuoteEur + fxEurHkd + FX buffer) and added to the
   *  displayed total. No duty / VAT applied — services are out of scope of
   *  the goods-based DAP calculation. */
  extrasQuoteCents?: number;
}

export const HkLandedCostPanel = ({
  goodsAfterDiscountCents,
  quoteCurrency,
  category = "furniture",
  defaultExpanded = false,
  title = "Hong Kong landed cost (DAP, HKD)",
  quoteRef,
  clientName,
  initialCbm,
  initialKg,
  initialMode,
  onSettingsChange,
  overrideShipping = null,
  shipmentOrigins = null,
  extrasQuoteCents = 0,
}: Props) => {
  const useOverride = !!overrideShipping;
  const resolvedInitialMode: HkMode = initialMode ?? "sea_lcl";
  const resolvedInitialCbm = initialCbm ?? DEFAULT_HKD_LANDED_CBM;
  const resolvedInitialKg = initialKg ?? Math.round(resolvedInitialCbm * HKD_LANDED_KG_PER_CBM[resolvedInitialMode]);
  const isInitialKgManual = initialKg != null && initialKg !== Math.round(resolvedInitialCbm * HKD_LANDED_KG_PER_CBM[resolvedInitialMode]);
  const [cbm, setCbm] = useState(resolvedInitialCbm);
  const [mode, setMode] = useState<HkMode>(resolvedInitialMode);
  const [kg, setKg] = useState(resolvedInitialKg);
  const kgEditedRef = useRef(isInitialKgManual);
  useEffect(() => {
    setCbm(resolvedInitialCbm);
    setMode(resolvedInitialMode);
    setKg(resolvedInitialKg);
    kgEditedRef.current = isInitialKgManual;
  }, [resolvedInitialCbm, resolvedInitialKg, resolvedInitialMode, isInitialKgManual]);
  useEffect(() => {
    if (kgEditedRef.current) return;
    setKg(Math.round(cbm * HKD_LANDED_KG_PER_CBM[mode]));
  }, [cbm, mode]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  const hkd = useHkdLandedCost({ goodsAfterDiscountCents, quoteCurrency, cbm, kg, mode, category, overrideShipping });
  const {
    ready: ratesReady, loading, fxEurHkd, fxQuoteEur, fxIsFallback,
    goodsHkdCents: goodsHkd, freightHkdCents: freightHkd, fuelHkdCents: fuelHkd,
    insuranceHkdCents: insuranceHkd, customsHkdCents: customsHkd, handlingHkdCents: handlingHkd,
    lastMileHkdCents: lastMileHkd, shippingHkdCents: shippingHkd,
    dutyHkdCents: dutyHkd, vatHkdCents: vatHkd, totalHkdCents: baseTotalHkd, breakdown,
    shippingEurCents: shippingEur, totalEurCents: baseTotalEur,
  } = hkd;
  // Convert "additional charges" (e.g. crating) from quote currency → EUR → HKD
  // with the same FX buffer used elsewhere on this panel.
  const extrasEurCents = fxQuoteEur ? Math.round(extrasQuoteCents * fxQuoteEur) : 0;
  const extrasHkdCents = fxEurHkd ? Math.round(extrasEurCents * fxEurHkd * (1 + FX_BUFFER)) : 0;
  const totalHkd = baseTotalHkd + extrasHkdCents;
  const totalEur = baseTotalEur + extrasEurCents;
  const fmtEur = (cents: number) =>
    new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format((cents || 0) / 100);

  return (
    <div className="border border-border rounded-md bg-background/40 print:bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-display text-xs uppercase tracking-wider text-foreground/80">{title}</span>
          {ratesReady && totalHkd > 0 && (
            <span className="font-body text-xs text-muted-foreground">· {fmtHkd(totalHkd)} all-in</span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/60">
          {/* Inputs — hidden when freight is sourced from per-line packing recap */}
          {!useOverride && (
            <div className="grid grid-cols-3 gap-2">
              <label className="block">
                <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">CBM</span>
                <input
                  type="number" min={0.1} step={0.1} value={cbm}
                  onChange={(e) => {
                    const nextCbm = Math.max(0.1, parseFloat(e.target.value) || 0.1);
                    const nextKg = Math.round(nextCbm * HKD_LANDED_KG_PER_CBM[mode]);
                    kgEditedRef.current = false;
                    setCbm(nextCbm); setKg(nextKg);
                    onSettingsChange?.({ cbm: nextCbm, kg: nextKg, mode });
                  }}
                  className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 font-body text-xs"
                />
              </label>
              <label className="block">
                <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
                  Weight (kg){!kgEditedRef.current && <span className="ml-1 normal-case tracking-normal text-muted-foreground/60">· auto</span>}
                </span>
                <input
                  type="number" min={0} step={10} value={kg}
                  onChange={(e) => {
                    const nextKg = Math.max(0, parseFloat(e.target.value) || 0);
                    kgEditedRef.current = true;
                    setKg(nextKg);
                    onSettingsChange?.({ cbm, kg: nextKg, mode });
                  }}
                  className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 font-body text-xs"
                />
              </label>
              <label className="block">
                <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Mode</span>
                <select
                  value={mode}
                  onChange={(e) => {
                    const nextMode = e.target.value as HkMode;
                    const nextKg = Math.round(cbm * HKD_LANDED_KG_PER_CBM[nextMode]);
                    kgEditedRef.current = false;
                    setMode(nextMode); setKg(nextKg);
                    onSettingsChange?.({ cbm, kg: nextKg, mode: nextMode });
                  }}
                  className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 font-body text-xs"
                >
                  <option value="sea_lcl">Sea LCL · standard</option>
                  <option value="air">Air freight · express</option>
                </select>
              </label>
            </div>
          )}
          {useOverride && (
            <p className="font-body text-[10px] text-muted-foreground leading-relaxed">
              Freight is summed from the per-line packing
              {overrideShipping?.shipmentCount ? ` (${overrideShipping.shipmentCount} shipment${overrideShipping.shipmentCount > 1 ? "s" : ""})` : ""}
              {overrideShipping?.totalCbm ? ` — ${overrideShipping.totalCbm.toFixed(2)} m³` : ""}
              {overrideShipping?.totalKg ? ` · ${Math.round(overrideShipping.totalKg)} kg` : ""}.
              Edit a line's origin / CBM / kg in the items table to refine.
            </p>
          )}

          {/* Breakdown */}
          {!ratesReady ? (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-xs">
              <DotCircleLoader size="sm" /> Loading FX rates…
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-xs">
              <DotCircleLoader size="sm" /> Calculating…
            </div>
          ) : (!useOverride && !breakdown?.available) ? (
            <p className="font-body text-xs text-amber-700">
              {breakdown?.reason || "No shipping rate available."}
            </p>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <Row label="Goods (net, after trade discount)" value={fmtHkd(goodsHkd)} bold />
              </div>

              <div className="space-y-1 border-t border-border/40 pt-2">
                <div className="flex justify-between font-body text-[11px] uppercase tracking-wider text-foreground/70">
                  <span>
                    {useOverride
                      ? `Freight — per-line aggregate${overrideShipping?.shipmentCount && overrideShipping.shipmentCount > 1 ? ` · ${overrideShipping.shipmentCount} shipments` : ""}`
                      : `Freight — ${breakdown?.selected_carrier} · ${mode === "air" ? "Air" : "Sea LCL"}${breakdown?.transit_days_min ? ` (${breakdown.transit_days_min}–${breakdown.transit_days_max} days)` : ""}`}
                  </span>
                  <span className="tabular-nums">
                    {fmtHkd(shippingHkd)}
                    <span className="ml-2 normal-case tracking-normal text-muted-foreground">≈ {fmtEur(shippingEur)}</span>
                  </span>
                </div>
                {!useOverride && freightHkd > 0 && <Row label="· Base freight (Paris → Hong Kong)" value={fmtHkd(freightHkd)} indent />}
                {!useOverride && fuelHkd > 0 && <Row label="· Fuel / BAF surcharge" value={fmtHkd(fuelHkd)} indent />}
                {!useOverride && insuranceHkd > 0 && <Row label="· Cargo insurance" value={fmtHkd(insuranceHkd)} indent />}
                {!useOverride && customsHkd > 0 && <Row label="· Customs clearance (HK)" value={fmtHkd(customsHkd)} indent />}
                {!useOverride && handlingHkd > 0 && <Row label="· Handling & documentation" value={fmtHkd(handlingHkd)} indent />}
                {!useOverride && lastMileHkd > 0 && <Row label="· Last-mile delivery (Hong Kong)" value={fmtHkd(lastMileHkd)} indent />}
                {useOverride && (
                  <p className="pl-2 font-body text-[10px] text-muted-foreground/80 leading-snug">
                    Detailed cost components are shown per origin in the Shipments-by-origin recap above.
                  </p>
                )}
              </div>


              <div className="space-y-1 border-t border-border/40 pt-2">
                <div className="flex justify-between font-body text-[11px] uppercase tracking-wider text-foreground/70">
                  <span>HK Import Taxes (DAP)</span>
                </div>
                <Row label="· Import duty (Hong Kong free port — 0%)" value={fmtHkd(dutyHkd)} indent />
                <Row label="· Sales tax / VAT (none in Hong Kong)" value={fmtHkd(vatHkd)} indent />
              </div>

              {extrasQuoteCents > 0 && (
                <div className="space-y-1 border-t border-border/40 pt-2">
                  <div className="flex justify-between font-body text-[11px] uppercase tracking-wider text-foreground/70">
                    <span>Additional charges</span>
                    <span className="tabular-nums">
                      {fmtHkd(extrasHkdCents)}
                      <span className="ml-2 normal-case tracking-normal text-muted-foreground">≈ {fmtEur(extrasEurCents)}</span>
                    </span>
                  </div>
                  <p className="pl-2 font-body text-[10px] text-muted-foreground/80 leading-snug">
                    Crating, hand-loading, or other manual fees added on the quote. Not subject to duty or VAT.
                  </p>
                </div>
              )}


              <div className="flex justify-between border-t-2 border-foreground/20 pt-2 mt-1 font-display text-sm uppercase tracking-wider text-foreground">
                <span>DAP delivered Hong Kong — all in</span>
                <span className="font-medium tabular-nums">
                  {fmtHkd(totalHkd)}
                  <span className="ml-2 normal-case tracking-normal text-muted-foreground text-xs">≈ {fmtEur(totalEur)}</span>
                </span>
              </div>

              {fxIsFallback && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/60 px-2.5 py-2 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="font-body text-[10px] leading-snug text-amber-900">
                    <span className="font-medium">Live FX unavailable</span> — using fallback indicative rate.
                    Treat the HKD figure as approximate; final invoice issued at the rate of the day.
                  </p>
                </div>
              )}

              <div className="border-t border-border/40 pt-2 mt-2 space-y-1.5">
                <p className="font-body text-[10px] text-muted-foreground/90 leading-relaxed">
                  <span className="font-medium text-foreground/80">Indicative estimate.</span>{" "}
                  {useOverride
                    ? `Freight is summed from per-line packing across ${overrideShipping?.shipmentCount ?? 1} shipment${(overrideShipping?.shipmentCount ?? 1) > 1 ? "s" : ""}${overrideShipping?.totalCbm ? ` (${overrideShipping.totalCbm.toFixed(2)} CBM` : ""}${overrideShipping?.totalKg ? ` · ${Math.round(overrideShipping.totalKg)} kg)` : (overrideShipping?.totalCbm ? ")" : "")} — actual crating`
                    : `Freight is calculated on declared volume (${cbm} CBM) and weight (${kg} kg) — actual crating`}
                  may vary on confirmation. Hong Kong is a free port — DAP terms cover origin handling,
                  international freight, HK customs clearance and inland delivery. Building access /
                  installation fees are receiver-side.
                </p>
                <p className="font-body text-[10px] text-muted-foreground/90 leading-relaxed">
                  <span className="font-medium text-foreground/80">FX:</span>{" "}
                  EUR→HKD @ {fxEurHkd?.toFixed(4)} including a +{(FX_BUFFER * 100).toFixed(0)}% buffer to
                  cushion currency movement between quote and invoice. Final HKD invoice issued on order
                  confirmation at the rate of the day; the buffer protects the quoted figure for ~30 days.
                </p>
                <p className="font-body text-[10px] text-muted-foreground/70 leading-relaxed italic">
                  Quote remains in {quoteCurrency} as the working currency. This panel is a courtesy
                  landed-cost view for the Hong Kong end-client.
                </p>
              </div>

              <div className="pt-2">
                <p className="font-body text-[10px] text-muted-foreground/80 italic leading-snug">
                  This Hong Kong DAP breakdown is appended automatically as a dedicated page to the main Quote PDF — no separate download needed.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const Row = ({ label, value, bold, indent }: { label: string; value: string; bold?: boolean; indent?: boolean }) => (
  <div className={`flex justify-between font-body text-xs ${bold ? "text-foreground font-medium" : "text-muted-foreground"} ${indent ? "pl-2" : ""}`}>
    <span className="pr-2">{label}</span>
    <span className="tabular-nums">{value}</span>
  </div>
);

export default HkLandedCostPanel;
