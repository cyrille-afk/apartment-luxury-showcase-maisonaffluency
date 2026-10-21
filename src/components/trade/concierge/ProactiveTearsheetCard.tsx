import { FileDown, LayoutGrid, X, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { felixLineCents, felixQuantity, formatFelixMoney } from "@/lib/felixQuoteQuantity";
import { felixQuoteFinishes } from "@/lib/felixQuoteFinishes";

/**
 * Proactive nudge shown inline in the concierge chat stream after the user
 * has stopped changing finishes for a few seconds on a trade product page.
 *
 * This is intentionally lighter than the full `TearsheetProposalCard`: it
 * doesn't commit a server-shaped proposal, it just frames the current
 * finish selection ("lock this in") and offers two shortcuts that hand the
 * real work back to the concierge's existing tools.
 */
export interface ProactiveTearsheetData {
  savedQuoteId?: string;
  savedLineId?: string;
  productId: string;
  productName: string;
  brandName?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  fabricLabel?: string | null;
  baseLabel?: string | null;
  topLabel?: string | null;
  finishes?: import("@/lib/felixQuoteFinishes").FelixQuoteFinish[];
  /** Preformatted trade price, e.g. "$4,250" or "€2,600". Empty = hide row. */
  tradePriceLabel?: string | null;
  unitPriceCents?: number | null;
  priceCurrency?: string | null;
  quantity?: number;
  /** Preformatted lead time, e.g. "6 weeks". Empty = hide row. */
  leadTimeLabel?: string | null;
}

interface Props {
  data: ProactiveTearsheetData;
  resolved?: "generated" | "boarded" | "dismissed";
  onGenerate: () => void;
  onAddToBoard: () => void;
  onDismiss: () => void;
  onQuantityChange: (quantity: number) => void;
}

export function ProactiveTearsheetCard({ data, resolved, onGenerate, onAddToBoard, onDismiss, onQuantityChange }: Props) {
  // Finishes (upholstery, frame finish, …) live in the right column of the
  // 2-col card; everything else (SKU, trade price, lead time) stays below.
  const finishRows = felixQuoteFinishes(data);
  const specRows: { label: string; value: string }[] = [];
  if (data.sku) specRows.push({ label: "SKU", value: data.sku });
  if (data.tradePriceLabel) specRows.push({ label: "Trade price", value: `${data.tradePriceLabel} (Member benefit)` });
  if (data.leadTimeLabel) specRows.push({ label: "Lead time", value: data.leadTimeLabel });

  const isResolved = !!resolved;
  const quantity = felixQuantity(data.quantity);
  const lineCents = felixLineCents(data);

  return (
    <div className="w-full rounded-lg border border-border bg-background/80 overflow-hidden">
      {/* Horizontal 2-column card: square 3D preview left, identity + finishes right */}
      <div className="flex items-start gap-3 p-3 border-b border-border/60">
        {data.imageUrl && (
          <img
            src={data.imageUrl}
            alt=""
            className="h-24 w-24 aspect-square rounded object-cover shrink-0 border border-border/50"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Preview 3D · custom finish
            </div>
            {!isResolved && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss"
                className="shrink-0 p-1 -mr-1 -mt-1 text-muted-foreground hover:text-foreground"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <div className="min-w-0">
            <div className="font-display text-[13px] leading-snug text-foreground" title={data.productName}>
              {data.productName}
            </div>
            {data.brandName && (
              <div className="font-body text-[10px] text-muted-foreground truncate">{data.brandName}</div>
            )}
          </div>
          {finishRows.length > 0 && (
            <div className="space-y-1 pt-0.5">
              {finishRows.map((finish, index) => (
                <div key={`${finish.label}-${index}`} className="flex items-center gap-2 text-[11px]">
                  <span className="font-body uppercase tracking-[0.1em] text-[9px] text-muted-foreground w-20 shrink-0">
                    {finish.label}
                  </span>
                  {finish.imageUrl && (
                    <img src={finish.imageUrl} alt={`${finish.name} swatch`} className="h-6 w-6 shrink-0 object-cover border border-border" />
                  )}
                  <span className="text-foreground/90 font-body truncate" title={finish.name}>{finish.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Remaining spec rows (SKU, trade price, lead time) */}
      {specRows.length > 0 && (
        <div className="px-3 py-2 space-y-0.5">
          {specRows.map((row, index) => (
            <div key={`${row.label}-${index}`} className="flex items-center gap-2 text-[11px]">
              <span className="font-body uppercase tracking-[0.1em] text-[9px] text-muted-foreground w-24 shrink-0 break-words">
                {row.label}
              </span>
              <span className="text-foreground/90 font-body">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quantity + line total share one horizontal axis */}
      <div className="px-3 py-2 border-t border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-body text-[10px] uppercase text-muted-foreground">Qty</span>
            <Button variant="ghost" size="icon-sm" aria-label={`Decrease quantity for ${data.productName}`} title="Decrease quantity" disabled={isResolved || quantity <= 1} onClick={() => onQuantityChange(quantity - 1)}><Minus /></Button>
            <Input type="number" min={1} step={1} aria-label={`Quantity for ${data.productName}`} value={quantity} disabled={isResolved} onChange={(event) => onQuantityChange(felixQuantity(event.currentTarget.valueAsNumber))} className="h-8 w-14 px-1 text-center tabular-nums" />
            <Button variant="ghost" size="icon-sm" aria-label={`Increase quantity for ${data.productName}`} title="Increase quantity" disabled={isResolved} onClick={() => onQuantityChange(quantity + 1)}><Plus /></Button>
          </div>
          <div data-trade-sensitive className="flex items-baseline gap-2 font-body text-[11px]">
            <span className="text-muted-foreground uppercase tracking-[0.1em] text-[9px]">Line total</span>
            <span className="text-foreground tabular-nums" aria-label={`Line total for ${data.productName}`}>{lineCents !== null && data.priceCurrency ? formatFelixMoney(lineCents, data.priceCurrency) : "Price upon Request"}</span>
          </div>
        </div>
      </div>

      {/* Framing copy */}
      {!isResolved && (
        <p className="px-3 pb-2 font-body text-[10.5px] leading-relaxed text-muted-foreground">
          Generating a tearsheet locks this exact spec — pricing and lead time — into a snapshot for your project records.
        </p>
      )}

      {/* Actions */}
      <div className="flex items-stretch gap-2 p-3 pt-2 border-t border-border/60 bg-muted/30">
        {isResolved ? (
          <div className="flex-1 font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {resolved === "generated" && "Tearsheet requested"}
            {resolved === "boarded" && "Added to project board"}
            {resolved === "dismissed" && "Dismissed"}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={onGenerate}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded font-body text-[10px] uppercase tracking-[0.14em] bg-foreground text-background hover:opacity-90 transition-opacity"
            >
              <FileDown size={11} />
              Generate tearsheet
            </button>
            <button
              type="button"
              onClick={onAddToBoard}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded font-body text-[10px] uppercase tracking-[0.14em] border border-border text-foreground hover:bg-background transition-colors"
            >
              <LayoutGrid size={11} />
              Add to project board
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default ProactiveTearsheetCard;
