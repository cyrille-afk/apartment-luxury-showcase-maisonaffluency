import { LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useExportCurrency } from "@/lib/displayMoney";
import { formatDimensions, resolveDimensions } from "@/lib/productDimensions";
import { tradePriceCents } from "@/lib/tradePricing";
import type { VisualiserAlternativeProduct } from "@/lib/visualiserAlternatives";

export type PricedVisualiserAlternative = VisualiserAlternativeProduct & { retailEurCents?: number | null };

type Props = {
  active: PricedVisualiserAlternative | null;
  alternatives: PricedVisualiserAlternative[];
  loading?: boolean;
  swappingId?: string | null;
  onClose: () => void;
  onSwap: (product: PricedVisualiserAlternative) => void;
};

export default function CuratedAlternativesDrawer({ active, alternatives, loading = false, swappingId = null, onClose, onSwap }: Props) {
  const { discountPct } = useTradeDiscount();
  const { convert, format } = useExportCurrency("EUR");
  return (
    <Sheet open={Boolean(active)} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md" overlayClassName="bg-foreground/15 backdrop-blur-[2px]">
        {active && <>
          <SheetHeader className="shrink-0 border-b border-border/70 px-6 py-6 pr-14 text-left">
            <p className="font-body text-[10px] font-light uppercase tracking-[0.22em] text-muted-foreground">Curated alternatives</p>
            <SheetTitle className="font-display text-2xl font-normal leading-tight">{active.product_name}</SheetTitle>
            <SheetDescription className="font-body text-xs font-light leading-relaxed">
              Same function and compatible proportions. A swap keeps its place and angle, with default catalogue finishes.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5" aria-live="polite">
            {loading ? (
              <div className="flex min-h-48 items-center justify-center gap-2 text-xs text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />Finding 3D-ready alternatives…</div>
            ) : alternatives.length === 0 ? (
              <div className="border-y border-border/70 py-10 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-muted-foreground" />
                <p className="mt-4 font-display text-lg">No compatible 3D alternatives yet</p>
                <p className="mx-auto mt-2 max-w-64 font-body text-xs font-light leading-relaxed text-muted-foreground">Try another piece, or add a catalogue model in the same functional category.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {alternatives.map(product => {
                  const dimensions = formatDimensions(resolveDimensions(product));
                  const rrp = convert(product.retailEurCents, "EUR");
                  const trade = convert(tradePriceCents(product.retailEurCents, discountPct), "EUR");
                  return (
                    <article key={product.id} className="border-b border-border/70 pb-6 last:border-0">
                      <div className="aspect-[4/3] overflow-hidden bg-muted/35">
                        {product.image_url ? <img src={product.image_url} alt={product.product_name} className="h-full w-full object-contain p-4" loading="lazy" /> : <div className="flex h-full items-center justify-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">3D catalogue piece</div>}
                      </div>
                      <p className="mt-4 font-body text-[9px] font-light uppercase tracking-[0.22em] text-muted-foreground">{product.brand_name}</p>
                      <h3 className="mt-1 font-display text-xl font-normal leading-tight text-foreground">{product.product_name}</h3>
                      {dimensions && <p className="mt-2 font-body text-[10px] font-light tracking-wide text-muted-foreground">{dimensions}</p>}
                      <div className="mt-3 flex items-end justify-between gap-4">
                        <div>
                          <p className="font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground">RRP</p>
                          <p className="mt-0.5 font-body text-sm text-foreground">{format(rrp)}</p>
                          <p data-trade-sensitive className="mt-1 font-body text-[10px] text-muted-foreground">Trade · {format(trade)}</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" disabled={Boolean(swappingId)} onClick={() => onSwap(product)} className="shrink-0 cursor-pointer">
                          {swappingId === product.id && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                          Swap in Room
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>}
      </SheetContent>
    </Sheet>
  );
}
