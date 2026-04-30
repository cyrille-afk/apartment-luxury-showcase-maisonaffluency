/**
 * UK Landed Cost Panel
 * --------------------
 * Adds a secondary GBP view on a quote: converts goods (any currency) to EUR
 * if needed, runs the FR→GB shipping estimator (Paris→London, road by default),
 * applies UK DDP duty + VAT (from shipping_duty_rates), then converts to GBP
 * with a +2% FX buffer.
 *
 * Quote currency (usually EUR) is left untouched — this is purely a side-panel
 * helper for UK clients quoted in EUR.
 */
import { useEffect, useMemo, useState } from "react";
import { estimateShipping, ShippingBreakdown } from "@/lib/shippingEstimator";
import { Truck, Loader2, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  /** Net goods subtotal AFTER trade discount, in the quote's currency */
  goodsAfterDiscountCents: number;
  /** Quote currency (EUR/USD/SGD/GBP) */
  quoteCurrency: string;
  /** Optional category override; defaults to 'furniture' */
  category?: "furniture" | "lighting" | "art" | "textile" | "accessory" | "other";
  /** Compact (single-line summary) vs expanded view */
  defaultExpanded?: boolean;
  /** Headline label, e.g. "UK landed cost (DDP)" */
  title?: string;
}

const FX_BUFFER = 0.02; // +2% safety margin on EUR→GBP

const fmtGbp = (cents: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })
    .format((cents || 0) / 100);

export const UkLandedCostPanel = ({
  goodsAfterDiscountCents,
  quoteCurrency,
  category = "furniture",
  defaultExpanded = false,
  title = "UK landed cost (DDP, GBP)",
}: Props) => {
  const [cbm, setCbm] = useState(2);
  const [kg, setKg] = useState(200);
  const [mode, setMode] = useState<"road" | "courier">("road");
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [fxEurGbp, setFxEurGbp] = useState<number | null>(null);
  const [fxQuoteEur, setFxQuoteEur] = useState<number | null>(null);
  const [breakdown, setBreakdown] = useState<ShippingBreakdown | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch EUR→GBP and (if needed) quoteCurrency→EUR
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const eurRes = await fetch("https://api.frankfurter.app/latest?from=EUR&to=GBP");
        const eurData = await eurRes.json();
        if (!cancelled && eurData?.rates?.GBP) setFxEurGbp(eurData.rates.GBP);
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
    };
    run();
    return () => { cancelled = true; };
  }, [quoteCurrency]);

  // Goods value in EUR (estimator's currency)
  const goodsEurCents = useMemo(() => {
    if (!fxQuoteEur || goodsAfterDiscountCents <= 0) return 0;
    return Math.round(goodsAfterDiscountCents * fxQuoteEur);
  }, [goodsAfterDiscountCents, fxQuoteEur]);

  // Run estimator whenever inputs change
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
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
    };
    run();
    return () => { cancelled = true; };
  }, [cbm, kg, mode, category, goodsEurCents]);

  // EUR → GBP with buffer
  const eurToGbp = (eurCents: number): number => {
    if (!fxEurGbp) return 0;
    return Math.round(eurCents * fxEurGbp * (1 + FX_BUFFER));
  };

  const goodsGbp = eurToGbp(goodsEurCents);
  const freightGbp = eurToGbp(breakdown?.freight_cents ?? 0);
  const fuelGbp = eurToGbp(breakdown?.fuel_cents ?? 0);
  const insuranceGbp = eurToGbp(breakdown?.insurance_cents ?? 0);
  const customsGbp = eurToGbp(breakdown?.customs_cents ?? 0);
  const handlingGbp = eurToGbp(breakdown?.handling_cents ?? 0);
  const lastMileGbp = eurToGbp(breakdown?.last_mile_cents ?? 0);
  const shippingGbp = freightGbp + fuelGbp + insuranceGbp + customsGbp + handlingGbp + lastMileGbp;
  const dutyGbp = eurToGbp(breakdown?.duty_cents ?? 0);
  const vatGbp = eurToGbp(breakdown?.vat_cents ?? 0);
  const totalGbp = goodsGbp + shippingGbp + dutyGbp + vatGbp;

  const ratesReady = fxEurGbp != null && fxQuoteEur != null;

  return (
    <div className="border border-border rounded-md bg-background/40 print:bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Truck className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-display text-xs uppercase tracking-wider text-foreground/80">
            {title}
          </span>
          {ratesReady && totalGbp > 0 && (
            <span className="font-body text-xs text-muted-foreground">
              · {fmtGbp(totalGbp)} all-in
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/60">
          {/* Inputs */}
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">CBM</span>
              <input
                type="number" min={0.1} step={0.1} value={cbm}
                onChange={(e) => setCbm(Math.max(0.1, parseFloat(e.target.value) || 0.1))}
                className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 font-body text-xs"
              />
            </label>
            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Weight (kg)</span>
              <input
                type="number" min={0} step={10} value={kg}
                onChange={(e) => setKg(Math.max(0, parseFloat(e.target.value) || 0))}
                className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 font-body text-xs"
              />
            </label>
            <label className="block">
              <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Mode</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as "road" | "courier")}
                className="mt-0.5 w-full bg-background border border-border rounded px-2 py-1 font-body text-xs"
              >
                <option value="road">Road · white-glove</option>
                <option value="courier">Courier · express</option>
              </select>
            </label>
          </div>

          {/* Breakdown */}
          {!ratesReady ? (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-xs">
              <Loader2 className="w-3 h-3 animate-spin" /> Loading FX rates…
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 text-muted-foreground font-body text-xs">
              <Loader2 className="w-3 h-3 animate-spin" /> Calculating…
            </div>
          ) : !breakdown?.available ? (
            <p className="font-body text-xs text-amber-700">
              {breakdown?.reason || "No shipping rate available."}
            </p>
          ) : (
            <div className="space-y-2">
              {/* Goods */}
              <div className="space-y-1">
                <Row label="Goods (net, after trade discount)" value={fmtGbp(goodsGbp)} bold />
              </div>

              {/* Freight breakdown */}
              <div className="space-y-1 border-t border-border/40 pt-2">
                <div className="flex justify-between font-body text-[11px] uppercase tracking-wider text-foreground/70">
                  <span>
                    Freight — {breakdown.selected_carrier} · {mode === "road" ? "Road white-glove" : "Courier express"}
                    {breakdown.transit_days_min ? ` (${breakdown.transit_days_min}–${breakdown.transit_days_max} days)` : ""}
                  </span>
                  <span className="tabular-nums">{fmtGbp(shippingGbp)}</span>
                </div>
                {freightGbp > 0 && <Row label="· Base freight (Paris → London)" value={fmtGbp(freightGbp)} indent />}
                {fuelGbp > 0 && <Row label="· Fuel surcharge" value={fmtGbp(fuelGbp)} indent />}
                {insuranceGbp > 0 && <Row label="· Cargo insurance" value={fmtGbp(insuranceGbp)} indent />}
                {customsGbp > 0 && <Row label="· Customs clearance" value={fmtGbp(customsGbp)} indent />}
                {handlingGbp > 0 && <Row label="· Handling & documentation" value={fmtGbp(handlingGbp)} indent />}
                {lastMileGbp > 0 && <Row label="· Last-mile delivery (London)" value={fmtGbp(lastMileGbp)} indent />}
              </div>

              {/* Duty + VAT */}
              <div className="space-y-1 border-t border-border/40 pt-2">
                <div className="flex justify-between font-body text-[11px] uppercase tracking-wider text-foreground/70">
                  <span>UK Import Taxes (DDP)</span>
                </div>
                <Row
                  label={`· Import duty (${breakdown.duty_cents > 0 ? ((breakdown.duty_cents / Math.max(1, goodsEurCents)) * 100).toFixed(1) : "0"}% — furniture/lighting)`}
                  value={fmtGbp(dutyGbp)}
                  indent
                />
                <Row
                  label={`· UK VAT (${(((breakdown.vat_cents) / Math.max(1, goodsEurCents + breakdown.freight_cents + breakdown.duty_cents)) * 100).toFixed(0)}% on goods + freight + duty)`}
                  value={fmtGbp(vatGbp)}
                  indent
                />
              </div>

              {/* Total */}
              <div className="flex justify-between border-t-2 border-foreground/20 pt-2 mt-1 font-display text-sm uppercase tracking-wider text-foreground">
                <span>DDP delivered London — all in</span>
                <span className="font-medium tabular-nums">{fmtGbp(totalGbp)}</span>
              </div>

              {/* Disclaimer */}
              <div className="border-t border-border/40 pt-2 mt-2 space-y-1.5">
                <p className="font-body text-[10px] text-muted-foreground/90 leading-relaxed">
                  <span className="font-medium text-foreground/80">Indicative estimate.</span>{" "}
                  Freight is calculated on declared volume ({cbm} CBM) and weight ({kg} kg) — actual crating
                  may vary on confirmation. Prices include UK customs clearance, import duty and VAT under
                  Delivered Duty Paid (DDP) — no further charges on delivery to London.
                </p>
                <p className="font-body text-[10px] text-muted-foreground/90 leading-relaxed">
                  <span className="font-medium text-foreground/80">FX:</span>{" "}
                  EUR→GBP @ {fxEurGbp?.toFixed(4)} including a +{(FX_BUFFER * 100).toFixed(0)}% buffer to
                  cushion currency movement between quote and invoice. Final GBP invoice issued on order
                  confirmation at the rate of the day; the buffer protects the quoted figure for ~30 days.
                </p>
                <p className="font-body text-[10px] text-muted-foreground/70 leading-relaxed italic">
                  Quote remains in {quoteCurrency} as the working currency. This panel is a courtesy
                  landed-cost view for the UK end-client.
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

export default UkLandedCostPanel;
