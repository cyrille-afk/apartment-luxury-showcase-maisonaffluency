import { useState, useMemo } from "react";
import { Search, Grid3X3, List, FileDown, Package } from "lucide-react";
import { getAllTradeProducts, getAllBrands, getAllCategories, getSubcategories } from "@/lib/tradeProducts";

const TradeGallery = () => {
  const allProducts = useMemo(() => getAllTradeProducts(), []);
  const brands = useMemo(() => getAllBrands(allProducts), [allProducts]);
  const categories = useMemo(() => getAllCategories(allProducts), [allProducts]);

  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const subcategories = useMemo(
    () => (selectedCategory !== "all" ? getSubcategories(allProducts, selectedCategory) : []),
    [allProducts, selectedCategory]
  );

  const filtered = useMemo(() => {
    return allProducts.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.product_name.toLowerCase().includes(q) ||
        p.brand_name.toLowerCase().includes(q) ||
        p.subtitle?.toLowerCase().includes(q) ||
        p.materials?.toLowerCase().includes(q);
      const matchesBrand = selectedBrand === "all" || p.brand_name === selectedBrand;
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      const matchesSub = selectedSubcategory === "all" || p.subcategory === selectedSubcategory;
      return matchesSearch && matchesBrand && matchesCategory && matchesSub;
    });
  }, [allProducts, search, selectedBrand, selectedCategory, selectedSubcategory]);

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
            placeholder="Search products, brands, materials…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full`}
          />
        </div>
        <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={inputClass}>
          <option value="all">All Brands ({brands.length})</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setSelectedSubcategory("all");
          }}
          className={inputClass}
        >
          <option value="all">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {subcategories.length > 0 && (
          <select value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)} className={inputClass}>
            <option value="all">All Subcategories</option>
            {subcategories.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <p className="font-body text-sm text-muted-foreground">
            No products match your search criteria.
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
                    <Package className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                )}
                {product.pdf_url && (
                  <a
                    href={product.pdf_url}
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
                <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                  {product.brand_name}
                </p>
                <h3 className="font-display text-sm text-foreground leading-tight mb-0.5 truncate">
                  {product.product_name}
                </h3>
                {product.subtitle && (
                  <p className="font-body text-[11px] text-muted-foreground truncate">{product.subtitle}</p>
                )}
                {product.dimensions && (
                  <p className="font-body text-[10px] text-muted-foreground mt-1 truncate">{product.dimensions}</p>
                )}
                {product.materials && (
                  <p className="font-body text-[10px] text-muted-foreground truncate">{product.materials}</p>
                )}
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
                    <Package className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{product.brand_name}</p>
                <h3 className="font-display text-sm text-foreground truncate">{product.product_name}</h3>
                <p className="font-body text-[10px] text-muted-foreground truncate">
                  {[product.dimensions, product.materials].filter(Boolean).join(" · ")}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                  {product.category}
                </span>
              </div>
              {product.pdf_url && (
                <a href={product.pdf_url} target="_blank" rel="noopener noreferrer"
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
