import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { PickPreview } from "@/lib/tradeConciergeStream";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { cn } from "@/lib/utils";

export type ProjectBoardItem = PickPreview;

type ProjectBoardDrawerProps = {
  open: boolean;
  onClose: () => void;
  items: ProjectBoardItem[];
  projectName?: string;
  onRemove?: (id: string) => void;
  onReviewLog?: () => void;
  onExportTearsheets?: () => void;
};

/** New York Trade Multiplier applied to the board subtotal. */
const NY_TRADE_MULTIPLIER_PCT = 0.15;

function leadWeeks(item: ProjectBoardItem): number {
  const src = `${item.lead_time || ""} ${item.stock_status || ""}`;
  const m = src.match(/(\d+)\s*(?:-|–|to)?\s*(\d+)?\s*week/i);
  if (!m) return 0;
  return Number(m[2] || m[1]) || 0;
}

function leadLabel(item: ProjectBoardItem): string {
  const w = leadWeeks(item);
  if (w) return `${w} Weeks`;
  return "By Request";
}

export function ProjectBoardDrawer({
  open,
  onClose,
  items,
  projectName = "Active Project",
  onRemove,
  onReviewLog,
  onExportTearsheets,
}: ProjectBoardDrawerProps) {
  const { discountPct, tierLabel } = useTradeDiscount();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const currency = items.find((i) => i.currency)?.currency || "EUR";

  const fmt = (cents: number) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(cents / 100);
    } catch {
      return `${(cents / 100).toLocaleString()} ${currency}`;
    }
  };

  const { subtotal, multiplierCut, total, maxLead } = useMemo(() => {
    const sub = items.reduce((acc, i) => {
      const net =
        typeof i.price_cents === "number" && i.price_cents > 0
          ? Math.round(i.price_cents * (1 - discountPct))
          : 0;
      return acc + net;
    }, 0);
    const cut = Math.round(sub * NY_TRADE_MULTIPLIER_PCT);
    const max = items.reduce((acc, i) => Math.max(acc, leadWeeks(i)), 0);
    return { subtotal: sub, multiplierCut: cut, total: sub - cut, maxLead: max };
  }, [items, discountPct]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[120]",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/30 backdrop-blur-[1px] transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Project board"
        className={cn(
          "absolute right-0 top-0 flex h-full w-[92vw] max-w-[380px] flex-col bg-[hsl(38_28%_96%)] dark:bg-muted shadow-[-24px_0_48px_-32px_hsl(var(--foreground)/0.45)] transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
          <div>
            <div className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Current Selection
            </div>
            <h2 className="mt-1 font-display text-[19px] font-light leading-tight text-foreground">
              {projectName}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close project board"
            className="mt-0.5 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <p className="py-10 text-center font-body text-[12px] text-muted-foreground">
              No pieces specified yet. Add items from the curated inventory.
            </p>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((item) => {
                const net =
                  typeof item.price_cents === "number" && item.price_cents > 0
                    ? Math.round(item.price_cents * (1 - discountPct))
                    : null;
                return (
                  <li key={item.id} className="flex gap-3 py-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden bg-[hsl(30_8%_92%)] dark:bg-background/40">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                        {item.brand_name || item.designer_name || "Maison Affluency"}
                      </div>
                      <div className="truncate font-display text-[13px] font-medium text-foreground">
                        {item.title}
                      </div>
                      <div className="mt-0.5 flex items-baseline justify-between gap-2">
                        <span className="font-body text-[12px] text-foreground">
                          {net ? fmt(net) : "Price on request"}
                        </span>
                        <span className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                          {leadLabel(item)}
                        </span>
                      </div>
                      {onRemove && (
                        <button
                          type="button"
                          onClick={() => onRemove(item.id)}
                          className="mt-1 font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Summary */}
        <div className="mx-5 mb-3 mt-3 rounded-sm bg-[hsl(38_20%_92%)] dark:bg-background/40 px-4 py-3">
          <dl className="space-y-1.5 font-body text-[11.5px] text-foreground/80">
            <div className="flex items-baseline justify-between gap-3">
              <dt>Subtotal · {tierLabel} net</dt>
              <dd className="text-foreground">{fmt(subtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt>New York Trade Multiplier (15%)</dt>
              <dd className="text-foreground">− {fmt(multiplierCut)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt>Est. White-Glove Shipping</dt>
              <dd className="text-foreground">Included</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 border-t border-border/60 pt-2">
              <dt className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Estimated Procurement Total
              </dt>
              <dd className="font-display text-[15px] font-semibold text-foreground">{fmt(total)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Maximum Lead Time Projected
              </dt>
              <dd className="font-body text-[11.5px] text-foreground">
                {maxLead ? `${maxLead} Weeks` : "On request"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Footer actions */}
        <footer className="flex items-center gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onReviewLog}
            className="flex-1 rounded-sm border border-border bg-background px-3 py-2 font-body text-[10.5px] uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-foreground hover:text-background"
          >
            Review Procurement Log
          </button>
          <button
            type="button"
            onClick={onExportTearsheets}
            className="flex-1 rounded-sm bg-foreground px-3 py-2 font-body text-[10.5px] uppercase tracking-[0.12em] text-background transition-opacity hover:opacity-90"
          >
            Export Final PDF Tearsheets
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

export default ProjectBoardDrawer;
