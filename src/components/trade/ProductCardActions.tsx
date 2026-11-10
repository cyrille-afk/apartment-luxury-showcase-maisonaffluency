import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import TradeFavoriteFolderPicker from "./TradeFavoriteFolderPicker";
import type { ProductMeta } from "@/lib/ensureTradeProduct";

export default function ProductCardActions({ productId, designerSlug, productSlug, meta, disabled = false }: {
  productId?: string;
  designerSlug: string;
  productSlug: string;
  meta: ProductMeta;
  disabled?: boolean;
}) {
  return (
    <div onClick={(event) => event.stopPropagation()} className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-1 gap-2 bg-background/95 p-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100 @[340px]:grid-cols-2">
      <Button disabled={disabled} asChild={!disabled} className="h-10 min-w-0 cursor-pointer rounded-sm bg-foreground px-2 font-body text-xs font-medium tracking-normal text-background hover:bg-foreground/90">
        {disabled ? "Configure & Quote" : productId ? (
          <Link to="/trade/products/$id" params={{ id: productId }} resetScroll={false}>Configure &amp; Quote</Link>
        ) : (
          <Link to="/trade/products/$slug/$productSlug" params={{ slug: designerSlug, productSlug }} resetScroll={false}>Configure &amp; Quote</Link>
        )}
      </Button>
      <TradeFavoriteFolderPicker productId={productId || productSlug} meta={meta} productName={meta.product_name} quickMoodboard side="top">
        <Button disabled={disabled} variant="outline" className="h-10 min-w-0 cursor-pointer rounded-sm border-foreground/30 bg-transparent px-2 font-body text-xs font-medium tracking-normal text-foreground hover:bg-muted">
          ADD TO PROJECT
        </Button>
      </TradeFavoriteFolderPicker>
    </div>
  );
}