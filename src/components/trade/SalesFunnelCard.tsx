import { Link } from "react-router-dom";
import { ArrowRight, TrendingDown } from "lucide-react";
import { useSalesFunnel } from "@/hooks/useSalesFunnel";

/** Dashboard summary of everything stalled in the sales funnel. */
export function SalesFunnelCard() {
  const { data } = useSalesFunnel(90);
  if (!data) return null;

  const stalled = data.stages.reduce((s, stage) => s + stage.entries.length, 0);
  if (stalled === 0) return null;

  return (
    <Link
      to="/trade/admin/sales-funnel"
      className="group mb-8 block border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/40 md:px-7 md:py-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-body text-[11px] uppercase tracking-[0.2em] text-foreground">
              {stalled} unfinished {stalled === 1 ? "item" : "items"} in the funnel
            </p>
            <p className="mt-1 font-body text-sm text-muted-foreground">
              {data.stages
                .filter((s) => s.entries.length > 0)
                .map((s) => `${s.entries.length} ${s.title.toLowerCase()}`)
                .join(" · ")}
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 font-body text-[11px] uppercase tracking-[0.2em] text-foreground">
          Open funnel
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
