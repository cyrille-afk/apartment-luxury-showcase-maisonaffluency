import { useState, useMemo, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Search, Grid3X3, List, FileDown, Package, ShoppingCart, Check, Scale } from "lucide-react";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import { getAllTradeProducts, getAllBrands, getAllCategories, getSubcategories, type TradeProduct } from "@/lib/tradeProducts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import SectionHero from "@/components/trade/SectionHero";
import CsvPriceImport from "@/components/trade/CsvPriceImport";
import TradeProductLightbox, { type TradeProductLightboxItem } from "@/components/trade/TradeProductLightbox";

interface DraftQuote {
  id: string;
  created_at: string;
}


const TradeGallery = () => {
  const { user, isAdmin } = useAuth();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { toast } = useToast();
  const allProducts = useMemo(() => getAllTradeProducts(), []);
  const brands = useMemo(() => getAllBrands(allProducts), [allProducts]);
  const categories = useMemo(() => getAllCategories(allProducts), [allProducts]);

  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("original");
  const fxRates = useFxRates();
  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const [lightboxProduct, setLightboxProduct] = useState<TradeProductLightboxItem | null>(null);

  // Price lookup from trade_products table
  const [priceLookup, setPriceLookup] = useState<Map<string, { cents: number; currency: string }>>(new Map());
  const [priceEntries, setPriceEntries] = useState<{ name: string; cents: number; currency: string }[]>([]);

  const normalizeName = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const tokenizeName = (s: string) =>
    normalizeName(s).split(" ").filter((t) => t.length > 2);

  useEffect(() => {
    const fetchPrices = async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("product_name, trade_price_cents, currency")
        .not("trade_price_cents", "is", null);
      if (data) {
        const lookup = new Map<string, { cents: number; currency: string }>();
        const entries: { name: string; cents: number; currency: string }[] = [];
        for (const p of data) {
          if (p.trade_price_cents) {
            const entry = { name: p.product_name, cents: p.trade_price_cents, currency: p.currency };
            entries.push(entry);
            lookup.set(p.product_name.trim().toLowerCase(), entry);
            const norm = normalizeName(p.product_name);
            if (norm) lookup.set(norm, entry);
          }
        }
        setPriceLookup(lookup);
        setPriceEntries(entries);
      }
    };
    fetchPrices();
  }, []);

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

  /** Find price by exact name, normalized name, substring, or token overlap */
  const getProductPrice = (product: TradeProduct): { cents: number; currency: string } | null => {
    const nameKey = product.product_name.trim().toLowerCase();
    if (priceLookup.has(nameKey)) return priceLookup.get(nameKey)!;
    if (product.subtitle) {
      const comboKey = `${nameKey} ${product.subtitle.trim().toLowerCase()}`;
      if (priceLookup.has(comboKey)) return priceLookup.get(comboKey)!;
    }
    // Normalized match
    const norm = normalizeName(product.product_name);
    if (priceLookup.has(norm)) return priceLookup.get(norm)!;
    // Substring match
    for (const e of priceEntries) {
      const cn = normalizeName(e.name);
      if (cn.includes(norm) || norm.includes(cn)) return e;
    }
    // Token overlap
    const targetTokens = new Set(tokenizeName(product.product_name));
    if (targetTokens.size === 0) return null;
    let best: { cents: number; currency: string } | null = null;
    let bestScore = 0;
    for (const e of priceEntries) {
      const ct = tokenizeName(e.name);
      let overlap = 0;
      for (const t of ct) { if (targetTokens.has(t)) overlap++; }
      const score = overlap / Math.max(targetTokens.size, ct.length);
      if (score > 0.5 && score > bestScore) { bestScore = score; best = e; }
    }
    return best;
  };

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

  const toCompareItem = (product: TradeProduct): CompareItem => ({
    pick: {
      title: product.product_name,
      subtitle: product.subtitle,
      image: product.image_url || "",
      materials: product.materials,
      dimensions: product.dimensions,
      category: product.category,
      subcategory: product.subcategory,
    },
    designerName: product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name,
    designerId: product.id,
    section: "designers",
  });

  const toLightboxItem = (product: TradeProduct): TradeProductLightboxItem => {
    const price = getProductPrice(product);
    return {
      id: product.id,
      product_name: product.product_name,
      subtitle: product.subtitle,
      image_url: product.image_url,
      brand_name: product.brand_name,
      materials: product.materials,
      dimensions: product.dimensions,
      category: product.category,
      subcategory: product.subcategory,
      pdf_url: product.pdf_url,
      price: price ? formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates) : null,
    };
  };

  const handleLightboxAddToQuote = (item: TradeProductLightboxItem) => {
    const product = allProducts.find((p) => p.id === item.id);
    if (product) handleAddToQuote(product);
  };

  const inputClass =
    "px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <>
      <Helmet><title>Gallery — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-7xl">
      <SectionHero
        section="gallery"
        title="Trade Gallery"
        subtitle={`${filtered.length} ${filtered.length === 1 ? "product" : "products"}${selectedBrand !== "all" ? ` from ${selectedBrand}` : ""}`}
      >
        {isAdmin && (
          <CsvPriceImport onComplete={() => {
            // Refetch prices after import
            supabase
              .from("trade_products")
              .select("product_name, trade_price_cents, currency")
              .not("trade_price_cents", "is", null)
              .then(({ data }) => {
                if (data) {
                  const lookup = new Map<string, { cents: number; currency: string }>();
                  const entries: { name: string; cents: number; currency: string }[] = [];
                  for (const p of data) {
                    if (p.trade_price_cents) {
                      const entry = { name: p.product_name, cents: p.trade_price_cents, currency: p.currency };
                      entries.push(entry);
                      lookup.set(p.product_name.trim().toLowerCase(), entry);
                      const norm = normalizeName(p.product_name);
                      if (norm) lookup.set(norm, entry);
                    }
                  }
                  setPriceLookup(lookup);
                  setPriceEntries(entries);
                }
              });
          }} />
        )}
        <button
          onClick={() => setDrawerOpen(true)}
          className="relative p-2 border border-background/30 rounded-md text-background/70 hover:text-background hover:border-background/50 transition-colors"
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
            className="px-3 py-2 bg-background/10 border border-background/30 rounded-md font-body text-xs text-background focus:outline-none transition-colors"
          >
            {draftQuotes.map((q) => (
              <option key={q.id} value={q.id} className="text-foreground bg-background">
                QU-{q.id.slice(0, 6).toUpperCase()}
              </option>
            ))}
          </select>
        )}
        <div className="flex items-center gap-1 border border-background/30 rounded-md p-0.5">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-background/20 text-background" : "text-background/50"}`}
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-background/20 text-background" : "text-background/50"}`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </SectionHero>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products, brands, materials…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full text-[16px] sm:text-sm`}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selectedBrand} onChange={(e) => setSelectedBrand(e.target.value)} className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}>
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
            className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {subcategories.length > 0 && (
            <select value={selectedSubcategory} onChange={(e) => setSelectedSubcategory(e.target.value)} className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}>
              <option value="all">All Subcategories</option>
              {subcategories.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
        </div>
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
            const price = getProductPrice(product);
            const pinned = isPinned(product.product_name, product.id);
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
                  {/* Pin button */}
                  <button
                    onClick={() => togglePin(toCompareItem(product))}
                    className={cn(
                      "absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all",
                      pinned
                        ? "bg-[hsl(var(--gold))] text-foreground shadow-md"
                        : "bg-background/70 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-background/90",
                      compareItems.length >= 3 && !pinned && "pointer-events-none"
                    )}
                    aria-label={pinned ? "Remove from selection" : "Pin to selection"}
                  >
                    <Scale className="h-3.5 w-3.5" />
                  </button>
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
                <div className="p-3 text-center">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    {product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name}
                  </p>
                  <h3 className="font-display text-sm text-foreground leading-tight mb-0.5 truncate">
                    {product.subtitle ? `${product.product_name} ${product.subtitle}` : product.product_name}
                  </h3>
                  {product.dimensions && (
                    <p className="font-body text-[10px] text-muted-foreground mt-1 truncate">{product.dimensions}</p>
                  )}
                   {product.materials && (
                    <p className="font-body text-[10px] text-muted-foreground truncate">{product.materials}</p>
                  )}
                  {price && (
                    <p className="font-display text-sm text-accent font-semibold mt-1">
                      {formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates)}
                    </p>
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
            const price = getProductPrice(product);
            const pinned = isPinned(product.product_name, product.id);
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
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name}</p>
                  <h3 className="font-display text-sm text-foreground truncate">{product.product_name}</h3>
                  <p className="font-body text-[10px] text-muted-foreground truncate">
                    {[product.dimensions, product.materials].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {price && (
                  <span className="font-display text-sm text-accent font-semibold shrink-0">
                    {formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates)}
                  </span>
                )}
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
                <button
                  onClick={() => togglePin(toCompareItem(product))}
                  className={cn(
                    "p-2 rounded-full transition-all shrink-0",
                    pinned ? "bg-[hsl(var(--gold))] text-foreground" : "text-muted-foreground hover:text-foreground",
                    compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                  )}
                  aria-label={pinned ? "Remove from selection" : "Pin"}
                >
                  <Scale className="h-3.5 w-3.5" />
                </button>
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
    </>
  );
};

export default TradeGallery;
