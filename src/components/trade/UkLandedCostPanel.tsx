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
import { useState } from "react";
import { Truck, Loader2, ChevronDown, ChevronUp, FileDown, AlertTriangle } from "lucide-react";
import { downloadUkDdpPdf } from "@/lib/ukDdpPdf";
import { useGbpLandedCost, FX_BUFFER, fmtGbp } from "@/hooks/useGbpLandedCost";

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
  /** Quote reference for the downloadable PDF (e.g. "QU-22A02A") */
  quoteRef?: string;
  /** Optional client / studio name for the PDF header */
  clientName?: string | null;
}

export const UkLandedCostPanel = ({
  goodsAfterDiscountCents,
  quoteCurrency,
  category = "furniture",
  defaultExpanded = false,
  title = "UK landed cost (DDP, GBP)",
  quoteRef,
  clientName,
}: Props) => {
  const [cbm, setCbm] = useState(2);
  const [kg, setKg] = useState(200);
  const [mode, setMode] = useState<"road" | "courier">("road");
  const [expanded, setExpanded] = useState(defaultExpanded);

  const gbp = useGbpLandedCost({
    goodsAfterDiscountCents,
    quoteCurrency,
    cbm,
    kg,
    mode,
    category,
  });

  const {
    ready: ratesReady,
    loading,
    fxEurGbp,
    fxIsFallback,
    goodsGbpCents: goodsGbp,
    freightGbpCents: freightGbp,
    fuelGbpCents: fuelGbp,
    insuranceGbpCents: insuranceGbp,
    customsGbpCents: customsGbp,
    handlingGbpCents: handlingGbp,
    lastMileGbpCents: lastMileGbp,
    shippingGbpCents: shippingGbp,
    dutyGbpCents: dutyGbp,
    vatGbpCents: vatGbp,
    totalGbpCents: totalGbp,
    breakdown,
    goodsEurCents,
  } = gbp;

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

              {fxIsFallback && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/60 px-2.5 py-2 mt-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="font-body text-[10px] leading-snug text-amber-900">
                    <span className="font-medium">Live FX unavailable</span> — using fallback indicative rate.
                    Treat the GBP figure as approximate; final invoice issued at the rate of the day.
                  </p>
                </div>
              )}

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

              {/* Download PDF */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadUkDdpPdf({
                      quoteRef: quoteRef || "QUOTE",
                      clientName: clientName ?? null,
                      quoteCurrency,
                      cbm,
                      kg,
                      mode,
                      carrier: breakdown?.selected_carrier ?? null,
                      transitDays: {
                        min: breakdown?.transit_days_min ?? null,
                        max: breakdown?.transit_days_max ?? null,
                      },
                      gbp,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-full font-body text-[11px] uppercase tracking-wider text-foreground hover:bg-foreground hover:text-background transition-colors"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  Download UK DDP estimate (PDF)
                </button>
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
