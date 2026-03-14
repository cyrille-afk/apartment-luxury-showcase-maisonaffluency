import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Grid3X3, List, FileDown, ShoppingCart } from "lucide-react";

interface TradeProduct {
  id: string;
  brand_name: string;
  product_name: string;
  sku: string | null;
  description: string | null;
  category: string;
  subcategory: string | null;
  trade_price_cents: number | null;
  rrp_price_cents: number | null;
  currency: string;
  dimensions: string | null;
  materials: string | null;
  lead_time: string | null;
  image_url: string | null;
  spec_sheet_url: string | null;
  is_active: boolean;
}

const formatPrice = (cents: number | null, currency: string) => {
  if (!cents) return "Price on request";
  return new Intl.NumberFormat("en-SG", { style: "currency", currency }).format(cents / 100);
};

const TradeGallery = () => {
  const [products, setProducts] = useState<TradeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("trade_products")
        .select("*")
        .eq("is_active", true)
        .order("brand_name", { ascending: true });
      setProducts((data as TradeProduct[]) || []);
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const brands = useMemo(() => [...new Set(products.map((p) => p.brand_name))].sort(), [products]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(), [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.product_name.toLowerCase().includes(search.toLowerCase()) ||
        p.brand_name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku?.toLowerCase().includes(search.toLowerCase());
      const matchesBrand = selectedBrand === "all" || p.brand_name === selectedBrand;
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      return matchesSearch && matchesBrand && matchesCategory;
    });
  }, [products, search, selectedBrand, selectedCategory]);

  const inputClass =
    "px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <div className="max-w-7xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-foreground mb-1">Trade Gallery</h1>
          <p className="font-body text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "product" : "products"}
            {selectedBrand !== "all" ? ` from ${selectedBrand}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1 border border-border rounded-md p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products, brands, SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full`}
          />
        </div>
        <select
          value={selectedBrand}
          onChange={(e) => setSelectedBrand(e.target.value)}
          className={inputClass}
        >
          <option value="all">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className={inputClass}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <p className="font-body text-sm text-muted-foreground">
            {products.length === 0
              ? "No products have been added yet. Products will appear here once an admin adds them."
              : "No products match your search criteria."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((product) => (
            <div key={product.id} className="group border border-border rounded-lg overflow-hidden hover:border-foreground/20 transition-colors">
              <div className="aspect-square bg-muted/30 relative overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.product_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-body text-xs text-muted-foreground">No image</span>
                  </div>
                )}
                {product.spec_sheet_url && (
                  <a
                    href={product.spec_sheet_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute top-2 right-2 p-1.5 bg-background/90 rounded-full text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Download spec sheet"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
              <div className="p-3">
                <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{product.brand_name}</p>
                <h3 className="font-display text-sm text-foreground leading-tight mb-1 truncate">{product.product_name}</h3>
                {product.dimensions && (
                  <p className="font-body text-[10px] text-muted-foreground mb-1">{product.dimensions}</p>
                )}
                <div className="flex items-baseline justify-between gap-2 mt-2">
                  <span className="font-body text-sm text-foreground font-medium">
                    {formatPrice(product.trade_price_cents, product.currency)}
                  </span>
                  {product.rrp_price_cents && (
                    <span className="font-body text-[10px] text-muted-foreground line-through">
                      RRP {formatPrice(product.rrp_price_cents, product.currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => (
            <div key={product.id} className="flex items-center gap-4 border border-border rounded-lg p-3 hover:border-foreground/20 transition-colors">
              <div className="w-16 h-16 rounded bg-muted/30 overflow-hidden shrink-0">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.product_name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-body text-[8px] text-muted-foreground">No img</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{product.brand_name}</p>
                <h3 className="font-display text-sm text-foreground truncate">{product.product_name}</h3>
                <p className="font-body text-[10px] text-muted-foreground">
                  {[product.dimensions, product.materials].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="font-body text-sm text-foreground font-medium block">
                  {formatPrice(product.trade_price_cents, product.currency)}
                </span>
                {product.rrp_price_cents && (
                  <span className="font-body text-[10px] text-muted-foreground line-through">
                    RRP {formatPrice(product.rrp_price_cents, product.currency)}
                  </span>
                )}
              </div>
              {product.spec_sheet_url && (
                <a href={product.spec_sheet_url} target="_blank" rel="noopener noreferrer"
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="Spec sheet">
                  <FileDown className="h-4 w-4" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradeGallery;
