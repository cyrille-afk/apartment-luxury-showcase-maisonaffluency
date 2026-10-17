/**
 * Product title + edition badge block for the trade product sheet.
 * The edition badge must always render AFTER the product title — never in
 * front of the designer name above it.
 */
import { productEditionBadge } from "@/lib/editionLabel";

interface ProductTitleBlockProps {
  title: string;
  subtitleLine?: string | null;
  product: { edition?: string | null; edition_number?: string | null; edition_signing?: string | null };
  isEcartProduct: boolean;
  showBadge: boolean;
}

export function ProductTitleBlock({ title, subtitleLine, product, isEcartProduct, showBadge }: ProductTitleBlockProps) {
  const badge = showBadge ? productEditionBadge(product, isEcartProduct) : null;
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 mt-1">
        <h1 className="font-display text-[1.5rem] md:text-[1.85rem] leading-tight">
          {title}
          {showBadge && subtitleLine && (
            <span className="block mt-1 text-[0.8em] text-muted-foreground">
              {subtitleLine}
            </span>
          )}
        </h1>
      {badge ? (
        <span className="inline-block rounded-[1px] bg-muted px-2.5 py-1 font-body text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {badge}
        </span>
      ) : null}
      </div>
    </>
  );
}
