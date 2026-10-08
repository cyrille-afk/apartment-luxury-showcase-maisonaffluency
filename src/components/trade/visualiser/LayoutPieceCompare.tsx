import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { comparatorPrices } from "@/lib/comparatorCatalogue";
import { formatDimensionsMultiline, formatImperialDimensions } from "@/lib/formatDimensions";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";

export interface LayoutComparePiece {
  id: string;
  name: string;
  manufacturer: string | null;
  dimensions: string | null;
  /** RRP in EUR (the price shown in the curated pieces list). */
  priceEur: number | null;
}

const eur2 = (n: number) =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

/**
 * Side-by-side comparison of selected room pieces: manufacturer, dimensions,
 * RRP and the viewer's tier-discounted trade price. Studio-only — Client View
 * hides the trade row via the data-trade-sensitive guard.
 */
const LayoutPieceCompare = ({ pieces, onRemove, onClose }: {
  pieces: LayoutComparePiece[];
  onRemove: (id: string) => void;
  onClose: () => void;
}) => {
  const { showTradePrice, tierLabel, discountLabel, discountPct } = useTradePriceMode();
  if (pieces.length === 0) return null;

  const prices = pieces.map((p) =>
    p.priceEur != null
      ? comparatorPrices({ trade_price_cents: Math.round(p.priceEur * 100), rrp_price_cents: null }, discountPct)
      : { retail: null, trade: null });

  const dimensionCell = (p: LayoutComparePiece) => {
    const metric = formatDimensionsMultiline(p.dimensions);
    if (!metric) return <span className="text-muted-foreground">Dimensions upon request</span>;
    const imperial = formatImperialDimensions(p.dimensions);
    return (
      <>
        <span className="whitespace-pre-line">{metric}</span>
        {imperial && <span className="mt-0.5 block whitespace-pre-line text-muted-foreground">{imperial}</span>}
      </>
    );
  };

  const rowLabel = "py-2 pr-3 text-left align-top text-[10px] uppercase tracking-[0.15em] text-muted-foreground";
  const cell = "py-2 pr-4 align-top text-xs last:pr-0";

  return (
    <div role="dialog" aria-label="Compare selected pieces"
      className="absolute inset-3 z-20 overflow-auto border border-border bg-background/95 p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Compare pieces ({pieces.length})</p>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Close comparison" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className={rowLabel} scope="col">Piece</th>
            {pieces.map((p) => (
              <th key={p.id} scope="col" className={`${cell} font-medium`}>
                <span className="flex items-start justify-between gap-2">
                  <span>{p.name}</span>
                  <button type="button" aria-label={`Remove ${p.name} from comparison`}
                    className="mt-0.5 text-muted-foreground hover:text-foreground" onClick={() => onRemove(p.id)}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          <tr>
            <th scope="row" className={rowLabel}>Manufacturer</th>
            {pieces.map((p) => (
              <td key={p.id} className={cell}>{p.manufacturer ?? <span className="text-muted-foreground">Manufacturer upon request</span>}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={rowLabel}>Dimensions</th>
            {pieces.map((p) => <td key={p.id} className={cell}>{dimensionCell(p)}</td>)}
          </tr>
          <tr>
            <th scope="row" className={rowLabel}>RRP</th>
            {pieces.map((p, i) => (
              <td key={p.id} className={`${cell} tabular-nums`}>
                {prices[i].retail != null ? eur2(prices[i].retail! / 100) : <span className="text-muted-foreground">Price upon Request</span>}
              </td>
            ))}
          </tr>
          {showTradePrice && (
            <tr data-trade-sensitive="">
              <th scope="row" className={rowLabel}>Trade Price · {tierLabel} −{discountLabel}</th>
              {pieces.map((p, i) => (
                <td key={p.id} className={`${cell} tabular-nums`}>
                  {prices[i].trade != null ? eur2(prices[i].trade! / 100) : <span className="text-muted-foreground">Price upon Request</span>}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LayoutPieceCompare;
