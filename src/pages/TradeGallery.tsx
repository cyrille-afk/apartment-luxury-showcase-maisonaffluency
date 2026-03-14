import { useState, useMemo, useEffect } from "react";
import { Search, Grid3X3, List, FileDown, Package, ShoppingCart, Check } from "lucide-react";
import { getAllTradeProducts, getAllBrands, getAllCategories, getSubcategories, type TradeProduct } from "@/lib/tradeProducts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import QuoteDrawer from "@/components/trade/QuoteDrawer";

interface DraftQuote {
  id: string;
  created_at: string;
}

const TradeGallery = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const allProducts = useMemo(() => getAllTradeProducts(), []);
  const brands = useMemo(() => getAllBrands(allProducts), [allProducts]);
  const categories = useMemo(() => getAllCategories(allProducts), [allProducts]);

  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);

  // Fetch user's draft quotes
  useEffect(() => {
    if (!user) return;
    const fetchDrafts = async () => {
      const { data } = await supabase
        .from("trade_quotes")
        .select("id, created_at")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      const drafts = (data as DraftQuote[]) || [];
      setDraftQuotes(drafts);
      if (drafts.length > 0) setActiveQuoteId(drafts[0].id);
    };
    fetchDrafts();
  }, [user]);

  const handleCreateQuoteAndAdd = async (product: TradeProduct) => {
    if (!user) return;
    setAddingProductId(product.id);
    const { data, error } = await supabase
      .from("trade_quotes")
      .insert({ user_id: user.id, status: "draft" })
      .select("id, created_at")
      .single();
    if (error || !data) {
      toast({ title: "Error creating quote", description: error?.message, variant: "destructive" });
      setAddingProductId(null);
      return;
    }
    const newQuote = data as DraftQuote;
    setDraftQuotes((prev) => [newQuote, ...prev]);
    setActiveQuoteId(newQuote.id);
    await addProductToQuote(product, newQuote.id);
  };

  const addProductToQuote = async (product: TradeProduct, quoteId: string) => {
    if (!user) return;
    setAddingProductId(product.id);
    const { error } = await supabase.rpc("add_gallery_product_to_quote", {
      _user_id: user.id,
      _quote_id: quoteId,
      _product_name: product.product_name,
      _brand_name: product.brand_name,
      _category: product.category || "",
      _image_url: product.image_url || null,
      _dimensions: product.dimensions || null,
      _materials: product.materials || null,
      _quantity: 1,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAddedProductIds((prev) => new Set(prev).add(product.id));
      setDrawerRefreshKey((k) => k + 1);
      setDrawerOpen(true);
      toast({ title: "Added to quote", description: `${product.product_name} added to QU-${quoteId.slice(0, 6).toUpperCase()}` });
    }
    setAddingProductId(null);
  };

  const handleAddToQuote = (product: TradeProduct) => {
    if (activeQuoteId) {
      addProductToQuote(product, activeQuoteId);
    } else {
      handleCreateQuoteAndAdd(product);
    }
  };

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
        <div className="flex items-center gap-3">
          {/* Active quote selector */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
            title="View active quote"
          >
            <ShoppingCart className="h-4 w-4" />
            {addedProductIds.size > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-medium rounded-full flex items-center justify-center">
                {addedProductIds.size}
              </span>
            )}
          </button>
          {draftQuotes.length > 0 && (
            <select
              value={activeQuoteId || ""}
              onChange={(e) => setActiveQuoteId(e.target.value)}
              className={`${inputClass} text-xs`}
            >
              {draftQuotes.map((q) => (
                <option key={q.id} value={q.id}>
                  QU-{q.id.slice(0, 6).toUpperCase()}
                </option>
              ))}
            </select>
          )}
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
          {filtered.map((product) => {
            const isAdding = addingProductId === product.id;
            const isAdded = addedProductIds.has(product.id);
            return (
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
                  {/* Overlay actions */}
                  <div className="absolute inset-x-0 bottom-0 p-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleAddToQuote(product)}
                      disabled={isAdding}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-body text-[10px] uppercase tracking-wider transition-colors ${
                        isAdded
                          ? "bg-emerald-600 text-white"
                          : "bg-foreground text-background hover:bg-foreground/90"
                      } disabled:opacity-60`}
                    >
                      {isAdding ? (
                        <div className="w-3 h-3 border border-background/30 border-t-background rounded-full animate-spin" />
                      ) : isAdded ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <ShoppingCart className="h-3 w-3" />
                      )}
                      {isAdded ? "Added" : "Add to Quote"}
                    </button>
                    {product.pdf_url && (
                      <a
                        href={product.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors"
                        title="Download spec sheet"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
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
            );
          })}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => {
            const isAdding = addingProductId === product.id;
            const isAdded = addedProductIds.has(product.id);
            return (
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
                <button
                  onClick={() => handleAddToQuote(product)}
                  disabled={isAdding}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-body text-[10px] uppercase tracking-wider transition-colors shrink-0 ${
                    isAdded
                      ? "bg-emerald-600 text-white"
                      : "border border-foreground text-foreground hover:bg-foreground hover:text-background"
                  } disabled:opacity-60`}
                >
                  {isAdding ? (
                    <div className="w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
                  ) : isAdded ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <ShoppingCart className="h-3 w-3" />
                  )}
                  {isAdded ? "Added" : "Add"}
                </button>
                {product.pdf_url && (
                  <a href={product.pdf_url} target="_blank" rel="noopener noreferrer"
                    className="p-2 text-[hsl(var(--pdf-red))] hover:text-[hsl(var(--pdf-red))]/80 transition-colors" title="Spec sheet">
                    <FileDown className="h-4 w-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      <QuoteDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        quoteId={activeQuoteId}
        refreshKey={drawerRefreshKey}
      />
    </div>
  );
};

export default TradeGallery;
