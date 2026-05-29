/**
 * Per-Origin Shipping Recap
 * -------------------------
 * Displays one row per (origin, mode) shipment computed from the quote's
 * per-line shipping fields, plus a grand total. Used inside the UK/HK
 * landed-cost panels and as a stand-alone card when there is no
 * destination-specific landed-cost panel.
 */
import { PerLineShippingResult } from "@/lib/perLineShipping";
import { labelForMode } from "@/lib/shippingEstimator";
import { Package, AlertTriangle } from "lucide-react";

const fmtEur = (cents: number) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format((cents || 0) / 100);

const countryFlag = (iso: string) => {
  if (!iso || iso.length !== 2) return "";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + iso.charCodeAt(0) - 65, A + iso.charCodeAt(1) - 65);
};

export const PerOriginShippingRecap = ({
  result,
  destCountry,
  loading = false,
  compact = false,
}: {
  result: PerLineShippingResult;
  destCountry: string;
  loading?: boolean;
  compact?: boolean;
}) => {
  if (!result.shipments.length && !loading) return null;
  return (
    <div className={`rounded-md border border-border bg-background/40 ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-center gap-2 mb-2">
        <Package className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-display text-[11px] uppercase tracking-wider text-foreground/80">
          Shipments by origin → {destCountry}
        </span>
        {result.shipments.length > 1 && (
          <span className="font-body text-[10px] text-muted-foreground">
            · {result.shipments.length} consolidations
          </span>
        )}
        {loading && <span className="font-body text-[10px] text-muted-foreground italic">recalculating…</span>}
      </div>

      <div className="space-y-1">
        {result.shipments.map((s) => {
          const unavailable = !s.breakdown?.available;
          return (
            <div key={`${s.origin}-${s.mode}`} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-body text-xs text-foreground">
                  <span className="mr-1">{countryFlag(s.origin)}</span>
                  <span className="font-medium">{s.origin}</span>
                  <span className="text-muted-foreground"> · {labelForMode(s.mode)}</span>
                  <span className="text-muted-foreground">
                    {" "}· {s.totalCbm.toFixed(2)} m³ · {Math.round(s.totalKg)} kg · {s.lineIds.length} item{s.lineIds.length > 1 ? "s" : ""}
                  </span>
                </div>
                {unavailable && (
                  <div className="flex items-center gap-1 mt-0.5 text-amber-700">
                    <AlertTriangle className="w-3 h-3" />
                    <span className="font-body text-[10px]">
                      {s.breakdown?.reason || "No lane configured — manual quote required."}
                    </span>
                  </div>
                )}
              </div>
              <div className="font-body text-xs tabular-nums text-foreground shrink-0">
                {unavailable ? "—" : fmtEur(s.shippingEurCents + s.dutyEurCents + s.vatEurCents)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-2 pt-2 border-t border-border/60 flex justify-between font-body text-xs">
        <span className="text-foreground/80">Total freight + duties + VAT</span>
        <span className="font-medium text-foreground tabular-nums">
          {fmtEur(result.totalShippingEurCents + result.totalDutyEurCents + result.totalVatEurCents)}
        </span>
      </div>
    </div>
  );
};

export default PerOriginShippingRecap;
