import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ExternalLink } from "lucide-react";
import type { PickPreview } from "@/lib/tradeConciergeStream";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type CuratedInventoryItem = PickPreview;

type CuratedInventoryGridProps = {
  items: CuratedInventoryItem[];
  title?: string;
  onAddToBoard?: (item: CuratedInventoryItem) => void;
  onViewSpec?: (item: CuratedInventoryItem) => void;
  className?: string;
};

type HoverDetail = {
  hoverImage: string | null;
};

function statusLabel(status?: string | null): string {
  const s = String(status || "").trim();
  return s || "By Request";
}

/**
 * CuratedInventoryGrid
 *
 * Borderless editorial result grid rendered after "[ Source Similar Pieces ]".
 * Hover reveals a secondary image cross-fade and an absolutely-positioned
 * specification block that never affects grid height.
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
  const [details, setDetails] = useState<Record<string, HoverDetail>>({});
  const requested = useRef<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(false);

  const loadDetail = useCallback(async (id: string) => {
    if (requested.current.has(id)) return;
    requested.current.add(id);
    const { data } = await supabase
      .from("designer_curator_picks")
      .select("hover_image_url, gallery_images")
      .eq("id", id)
      .maybeSingle();
    if (!data) return;
    const row = data as any;
    setDetails((prev) => ({
      ...prev,
      [id]: {
        hoverImage: row.hover_image_url || row.gallery_images?.[0] || null,
      },
    }));
  }, []);

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

  const renderCard = (item: CuratedInventoryItem) => {
          const brand = item.brand_name || item.designer_name || "Maison Affluency";
          const material = item.materials || item.category || "Material on request";
          const status = statusLabel(item.stock_status || item.lead_time);
          const detail = details[item.id];
          const handleView = () => {
            if (onViewSpec) return onViewSpec(item);
            navigate(`/trade/products/${item.id}`);
          };
          return (
            <article
              key={item.id}
              className="group relative flex flex-col"
              onMouseEnter={() => loadDetail(item.id)}
              onFocus={() => loadDetail(item.id)}
            >
              {/* Image with cross-fade */}
              <button
                type="button"
                onClick={handleView}
                className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-[hsl(30_8%_94%)] dark:bg-muted/30"
                aria-label={`Open spec for ${item.title}`}
              >
                {item.image_url ? (
                  <>
                    <img
                      src={item.image_url}
                      alt={item.title}
                      loading="lazy"
                      className={cn(
                        "h-full w-full object-cover transition-opacity duration-300 ease-out",
                        detail?.hoverImage && "group-hover:opacity-0 group-focus-within:opacity-0",
                      )}
                    />
                    {detail?.hoverImage && (
                      <img
                        src={detail.hoverImage}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100 group-focus-within:opacity-100"
                      />
                    )}
                  </>
                ) : (
                  <div className="grid h-full w-full place-items-center text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Image on request
                  </div>
                )}
              </button>

              {/* Body */}
              <div className="relative flex flex-1 flex-col pt-2.5">
                <div className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  {brand}
                </div>
                <button
                  type="button"
                  onClick={handleView}
                  className="mt-0.5 text-left font-display text-[15px] leading-snug font-semibold text-foreground line-clamp-2 hover:underline underline-offset-2 decoration-foreground/30"
                >
                  {item.title}
                </button>

                <div className="mt-0.5 font-body text-[11px] text-muted-foreground/80 line-clamp-1">
                  {material}
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-3">
                  {typeof item.price_cents === "number" && item.price_cents > 0 ? (
                    <div className="leading-tight">
                      <span className="font-display text-[15px] font-semibold text-foreground">
                        {fmtPrice(Math.round(item.price_cents * (1 - discountPct)), item.currency || "EUR")}
                      </span>
                      <span className="block font-body text-[9px] uppercase tracking-[0.12em] text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70 group-focus-within:text-muted-foreground/70">
                        {tierLabel} net · RRP {fmtPrice(item.price_cents, item.currency || "EUR")}
                      </span>
                    </div>
                  ) : (
                    <div className="font-body text-[12px] text-foreground/80">Trade Price on Request</div>
                  )}
                  <span className="whitespace-nowrap font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
                    {status}
                  </span>
                </div>




                {/* Actions */}
                <div className="mt-2.5 flex items-center gap-5">
                  <button
                    type="button"
                    onClick={() => onAddToBoard?.(item)}
                    disabled={!onAddToBoard}
                    className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.12em] text-foreground/60 transition-all duration-200 group-hover:font-semibold group-hover:text-foreground group-focus-within:font-semibold group-focus-within:text-foreground hover:text-foreground disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" />
                    Add to Board
                  </button>
                  <button
                    type="button"
                    onClick={handleView}
                    className="inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.12em] text-foreground/60 transition-colors hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View Spec
                  </button>
                </div>
              </div>
            </article>
          );
  };

  const visible = items.slice(0, 4);
  const hidden = items.slice(4);

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-8">
        {visible.map(renderCard)}
      </div>

      {hidden.length > 0 && (
        <>
          <div
            className={cn(
              "grid grid-cols-1 md:grid-cols-2 gap-x-6 overflow-hidden transition-all duration-500 ease-out",
              expanded ? "mt-8 max-h-[6000px] gap-y-8 opacity-100" : "mt-0 max-h-0 gap-y-0 opacity-0",
            )}
            aria-hidden={!expanded}
          >
            {hidden.map(renderCard)}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="font-body text-[11px] uppercase tracking-[0.16em] text-foreground/70 transition-colors hover:text-foreground"
            >
              {expanded ? "Collapse Options −" : `+ View More Curated Options (${hidden.length})`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default CuratedInventoryGrid;
