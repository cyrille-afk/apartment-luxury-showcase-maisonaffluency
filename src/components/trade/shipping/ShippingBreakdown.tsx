import { ShippingBreakdown as Breakdown, formatMoney, labelForMode } from "@/lib/shippingEstimator";
import { Truck, Clock } from "lucide-react";

export default function ShippingBreakdown({ breakdown }: { breakdown: Breakdown }) {
  if (!breakdown.available) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <Truck className="h-6 w-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="font-body text-sm text-muted-foreground">{breakdown.reason || "No estimate available"}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-foreground" />
          <span className="font-display text-sm text-foreground">
            {breakdown.selected_carrier} · {breakdown.selected_mode ? labelForMode(breakdown.selected_mode) : ""}
          </span>
        </div>
        {breakdown.transit_days_min !== null && (
          <div className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground">
            <Clock className="h-3 w-3" />
            {breakdown.transit_days_min}–{breakdown.transit_days_max} days
          </div>
        )}
      </div>

      <table className="w-full text-sm">
        <tbody>
          {breakdown.detail.map((line, i) => (
            <tr key={i} className="border-b border-border/50 last:border-0">
              <td className="px-4 py-2 font-body text-muted-foreground">{line.label}</td>
              <td className="px-4 py-2 text-right font-body text-foreground tabular-nums">
                {formatMoney(line.value_cents, breakdown.currency)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 border-t-2 border-foreground/10">
            <td className="px-4 py-3 font-display text-foreground">Total estimate</td>
            <td className="px-4 py-3 text-right font-display text-foreground text-base tabular-nums">
              {formatMoney(breakdown.total_cents, breakdown.currency)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
