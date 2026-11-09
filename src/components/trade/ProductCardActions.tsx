import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import TradeFavoriteFolderPicker from "./TradeFavoriteFolderPicker";
import type { ProductMeta } from "@/lib/ensureTradeProduct";

const TradeProductPage = lazy(() => import("@/pages/TradeProductPage"));

export default function ProductCardActions({ productId, designerSlug, productSlug, meta, disabled = false }: {
  productId?: string;
  designerSlug: string;
  productSlug: string;
  meta: ProductMeta;
  disabled?: boolean;
}) {
  const [configuring, setConfiguring] = useState(false);
  return (
    <div onClick={(event) => event.stopPropagation()} className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-1 gap-2 bg-background/95 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 @[340px]:grid-cols-2">
      <Button disabled={disabled} onClick={() => setConfiguring(true)} className="h-10 min-w-0 cursor-pointer rounded-sm bg-foreground px-2 font-body text-xs font-medium tracking-normal text-background hover:bg-foreground/90">
        Configure &amp; Quote
      </Button>
      <TradeFavoriteFolderPicker productId={productId || productSlug} meta={meta} productName={meta.product_name} quickMoodboard side="top">
        <Button disabled={disabled} variant="outline" className="h-10 min-w-0 cursor-pointer rounded-sm border-foreground/30 bg-transparent px-2 font-body text-xs font-medium tracking-normal text-foreground hover:bg-muted">
          Add to Moodboard
        </Button>
      </TradeFavoriteFolderPicker>
      <Dialog open={configuring} onOpenChange={setConfiguring}>
        <DialogContent aria-describedby={undefined} overlayClassName="z-[140] bg-foreground/45" className="z-[141] block max-h-[92dvh] w-[calc(100%-2rem)] max-w-[1500px] overflow-y-auto rounded-sm p-4 pt-12 md:p-6 md:pt-12">
          <DialogTitle className="sr-only">Configure &amp; Quote — {meta.product_name}</DialogTitle>
          <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><DotCircleLoader /></div>}>
            <TradeProductPage embeddedProduct={{ id: productId, designerSlug, productSlug }} />
          </Suspense>
        </DialogContent>
      </Dialog>
    </div>
  );
}