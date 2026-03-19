import { Package, FileDown } from "lucide-react";

export interface PresentationProduct {
  id: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  dimensions?: string | null;
  materials?: string | null;
  price_label?: string | null;
  spec_sheet_url?: string | null;
  pdf_url?: string | null;
}

interface Props {
  products: PresentationProduct[];
  roomSection?: string | null;
}

/** Trade Gallery–style grid card for use inside the presentation viewer (max 2 per page) */
export default function PresentationProductGrid({ products, roomSection }: Props) {
  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-8">
      {roomSection && (
        <div className="text-center mb-6">
          <span className="font-body text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">Room Section</span>
          <h3 className="font-display text-lg text-foreground mt-1">{roomSection}</h3>
        </div>
      )}
      <div className={`grid ${products.length === 1 ? "grid-cols-1 max-w-sm mx-auto" : "grid-cols-2"} gap-6`}>
        {products.map((p) => (
          <div key={p.id} className="group border border-border rounded-lg overflow-hidden hover:border-foreground/20 transition-colors">
            <div className="aspect-square bg-muted/30 relative overflow-hidden">
              {p.image_url ? (
                <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              {p.pdf_url && (
                <a
                  href={p.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute bottom-2 right-2 p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors opacity-0 group-hover:opacity-100"
                  title="Download spec sheet"
                >
                  <FileDown className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="p-4 text-center">
              <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                {p.brand_name.includes(" - ") ? p.brand_name.split(" - ")[0].trim() : p.brand_name}
              </p>
              <h4 className="font-display text-sm text-foreground leading-tight mb-1">{p.product_name}</h4>
              {p.dimensions && <p className="font-body text-[10px] text-muted-foreground">{p.dimensions}</p>}
              {p.materials && <p className="font-body text-[10px] text-muted-foreground">{p.materials}</p>}
              {p.price_label && (
                <p className="font-display text-sm text-accent font-semibold mt-2">{p.price_label}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
