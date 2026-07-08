import { FileDown, LayoutGrid, X } from "lucide-react";

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
  productId: string;
  productName: string;
  brandName?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  fabricLabel?: string | null;
  baseLabel?: string | null;
  topLabel?: string | null;
  /** Preformatted trade price, e.g. "$4,250" or "€2,600". Empty = hide row. */
  tradePriceLabel?: string | null;
  /** Preformatted lead time, e.g. "6 weeks". Empty = hide row. */
  leadTimeLabel?: string | null;
}

interface Props {
  data: ProactiveTearsheetData;
  resolved?: "generated" | "boarded" | "dismissed";
  onGenerate: () => void;
  onAddToBoard: () => void;
  onDismiss: () => void;
}

export function ProactiveTearsheetCard({ data, resolved, onGenerate, onAddToBoard, onDismiss }: Props) {
  const specRows: { label: string; value: string }[] = [];
  if (data.sku) specRows.push({ label: "SKU", value: data.sku });
  if (data.fabricLabel) specRows.push({ label: "Material", value: data.fabricLabel });
  if (data.baseLabel) specRows.push({ label: "Base", value: data.baseLabel });
  if (data.topLabel) specRows.push({ label: "Top", value: data.topLabel });
  if (data.tradePriceLabel) specRows.push({ label: "Trade price", value: `${data.tradePriceLabel} (Member benefit)` });
  if (data.leadTimeLabel) specRows.push({ label: "Lead time", value: data.leadTimeLabel });

  const isResolved = !!resolved;

  return (
    <div className="w-full rounded-lg border border-border bg-background/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 p-3 border-b border-border/60">
        {data.imageUrl && (
          <img
            src={data.imageUrl}
            alt=""
            className="w-14 h-14 rounded object-cover shrink-0 border border-border/50"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-body text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Preview 3D · custom finish
          </div>
          <div className="font-display text-[13px] leading-snug text-foreground truncate" title={data.productName}>
            {data.productName}
          </div>
          {data.brandName && (
            <div className="font-body text-[10px] text-muted-foreground truncate">{data.brandName}</div>
          )}
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

      {/* Spec rows */}
      {specRows.length > 0 && (
        <div className="px-3 py-2 space-y-0.5">
          {specRows.map((row) => (
            <div key={row.label} className="flex items-baseline gap-2 text-[11px]">
              <span className="font-body uppercase tracking-[0.1em] text-[9px] text-muted-foreground w-20 shrink-0">
                {row.label}
              </span>
              <span className="text-foreground/90 font-body">{row.value}</span>
            </div>
          ))}
        </div>
      )}

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
              Generate free tearsheet
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
