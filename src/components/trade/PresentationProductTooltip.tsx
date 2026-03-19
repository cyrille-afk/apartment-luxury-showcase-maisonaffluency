import { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Package, Info } from "lucide-react";
import type { PresentationProduct } from "./PresentationProductGrid";

interface Props {
  products: PresentationProduct[];
  children: React.ReactNode;
}

/** Wraps a furnishing slide image, showing a product info button that reveals a popover with all linked products */
export default function PresentationProductTooltip({ products, children }: Props) {
  const [open, setOpen] = useState(false);

  if (!products.length) return <>{children}</>;

  return (
    <div className="relative">
      {children}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/85 backdrop-blur-md border border-border text-muted-foreground hover:text-foreground hover:bg-background transition-all shadow-md"
            aria-label="View product details"
          >
            <Info className="w-3.5 h-3.5" />
            <span className="font-body text-[10px] uppercase tracking-wider">{products.length} Product{products.length !== 1 ? "s" : ""}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-80 p-0 bg-background/95 backdrop-blur-xl border-border">
          <div className="p-3 border-b border-border">
            <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">Products in this view</p>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y divide-border">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                <div className="w-10 h-10 rounded bg-muted/40 overflow-hidden shrink-0">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="w-4 h-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                    {p.brand_name.includes(" - ") ? p.brand_name.split(" - ")[0].trim() : p.brand_name}
                  </p>
                  <p className="font-display text-xs text-foreground truncate">{p.product_name}</p>
                  {p.dimensions && <p className="font-body text-[9px] text-muted-foreground truncate">{p.dimensions}</p>}
                  {p.materials && <p className="font-body text-[9px] text-muted-foreground truncate">{p.materials}</p>}
                  {p.price_label && <p className="font-display text-[11px] text-accent mt-0.5">{p.price_label}</p>}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
