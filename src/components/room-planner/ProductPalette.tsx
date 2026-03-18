import { useState, useMemo } from "react";
import { Search, Plus, Package } from "lucide-react";
import { getAllTradeProducts, type TradeProduct } from "@/lib/tradeProducts";

interface ProductPaletteProps {
  onProductSelect: (product: TradeProduct) => void;
  selectedProductId: string | null;
}

const ProductPalette = ({ onProductSelect, selectedProductId }: ProductPaletteProps) => {
  const [search, setSearch] = useState("");
  const products = useMemo(() => getAllTradeProducts(), []);

  const filtered = useMemo(() => {
    if (!search.trim()) return products.slice(0, 50); // show first 50 by default
    const q = search.toLowerCase();
    return products.filter(
      (p) =>
        p.product_name.toLowerCase().includes(q) ||
        p.brand_name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    ).slice(0, 50);
  }, [products, search]);

  return (
    <div className="flex flex-col h-full border-l border-border bg-background">
      <div className="p-3 border-b border-border">
        <h3 className="font-display text-sm text-foreground mb-2">Products</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-background font-body text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.length === 0 && (
          <p className="font-body text-xs text-muted-foreground text-center py-8">No products found</p>
        )}
        {filtered.map((product) => (
          <button
            key={product.id}
            onClick={() => onProductSelect(product)}
            className={`w-full flex items-center gap-2.5 p-2 rounded-md text-left transition-colors ${
              selectedProductId === product.id
                ? "bg-muted ring-1 ring-foreground/20"
                : "hover:bg-muted/50"
            }`}
          >
            {product.image_url ? (
              <img
                src={product.image_url}
                alt=""
                className="w-10 h-10 rounded object-cover bg-muted shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-body text-xs text-foreground truncate">{product.product_name}</p>
              <p className="font-body text-[10px] text-muted-foreground truncate">{product.brand_name}</p>
            </div>
            <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-border">
        <p className="font-body text-[10px] text-muted-foreground leading-relaxed">
          Select a product, then click on the 3D floor to place it in the scene.
        </p>
      </div>
    </div>
  );
};

export default ProductPalette;
