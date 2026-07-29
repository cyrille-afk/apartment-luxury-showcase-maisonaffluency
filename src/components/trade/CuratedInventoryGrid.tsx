import { useNavigate } from "react-router-dom";
import { Plus, ExternalLink } from "lucide-react";
import type { PickPreview } from "@/lib/tradeConciergeStream";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { cn } from "@/lib/utils";

export type CuratedInventoryItem = PickPreview;

type CuratedInventoryGridProps = {
  items: CuratedInventoryItem[];
  title?: string;
  onAddToBoard?: (item: CuratedInventoryItem) => void;
  onViewSpec?: (item: CuratedInventoryItem) => void;
  className?: string;
};

function statusTone(status?: string | null): { label: string; tone: string } {
  const s = String(status || "").toLowerCase();
  if (!s) return { label: "By Request", tone: "bg-muted text-muted-foreground border-border" };
  if (/in\s*stock|available|ready/.test(s))
    return { label: status!, tone: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  if (/lead|made\s*to\s*order|order|weeks?/.test(s))
    return { label: status!, tone: "bg-amber-50 text-amber-800 border-amber-200" };
  if (/sold|unavailable|hold/.test(s))
    return { label: status!, tone: "bg-rose-50 text-rose-700 border-rose-200" };
  return { label: status!, tone: "bg-muted text-muted-foreground border-border" };
}

/**
 * CuratedInventoryGrid
 *
 * Compact result grid rendered after the "[ Source Similar Pieces ]" pill.
 * Premium minimalist palette: warm-tinted gray card, 1px border, rounded-sm.
 * Responsive: 1 col on mobile, 2 cols on desktop.
 */
export function CuratedInventoryGrid({
  items,
  title = "Curated Inventory · Matches from Your Palette",
  onAddToBoard,
  onViewSpec,
  className,
}: CuratedInventoryGridProps) {
  const navigate = useNavigate();
  const { discountPct, tierLabel } = useTradeDiscount();

  const fmtPrice = (cents: number, currency: string) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: currency || "EUR",
        maximumFractionDigits: 0,
      }).format(cents / 100);
    } catch {
      return `${(cents / 100).toLocaleString()} ${currency || ""}`.trim();
    }
  };

  if (!items?.length) return null;

  return (
    <div className={cn("w-full max-w-[92%] self-start", className)}>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </div>
        <div className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground/80">
          {items.length} {items.length === 1 ? "piece" : "pieces"}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {items.map((item) => {
          const brand = item.brand_name || item.designer_name || "Maison Affluency";
          const material = item.materials || item.category || "Material on request";
          const status = statusTone(item.stock_status || item.lead_time);
          const handleView = () => {
            if (onViewSpec) return onViewSpec(item);
            navigate(`/trade/products/${item.id}`);
          };
          return (
            <article
              key={item.id}
              className="group flex flex-col rounded-sm border border-border bg-[hsl(30_10%_97%)] dark:bg-muted/40 overflow-hidden transition-shadow hover:shadow-[0_1px_0_hsl(var(--border)),0_8px_24px_-16px_hsl(var(--foreground)/0.18)]"
            >
              {/* Image */}
              <button
                type="button"
                onClick={handleView}
                className="relative block aspect-[4/3] w-full overflow-hidden bg-[hsl(30_8%_92%)]"
                aria-label={`Open spec for ${item.title}`}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Image on request
                  </div>
                )}
              </button>

              {/* Body */}
              <div className="flex flex-1 flex-col px-3.5 pt-3 pb-3">
                <div className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  {brand}
                </div>
                <button
                  type="button"
                  onClick={handleView}
                  className="mt-0.5 text-left font-display text-[15px] leading-snug font-semibold text-foreground line-clamp-2 hover:underline underline-offset-2 decoration-foreground/30"
                >
                  {item.title}
                </button>

                <div className="mt-1.5 font-body text-[12px] text-muted-foreground line-clamp-2">
                  {material}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="font-body text-[12px] text-foreground/80">
                    Trade Price on Request
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em]",
                      status.tone,
                    )}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-2 border-t border-border/60 pt-2.5">
                  <button
                    type="button"
                    onClick={() => onAddToBoard?.(item)}
                    disabled={!onAddToBoard}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 font-body text-[11px] text-foreground hover:bg-foreground hover:text-background transition-colors disabled:opacity-50 disabled:hover:bg-background disabled:hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add to Board
                  </button>
                  <button
                    type="button"
                    onClick={handleView}
                    className="inline-flex items-center gap-1 rounded-sm border border-border bg-background px-2 py-1 font-body text-[11px] text-foreground hover:bg-foreground hover:text-background transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Spec
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export default CuratedInventoryGrid;
