import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, FolderOpen, Tag } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import AddToProjectPopover from "@/components/trade/AddToProjectPopover";
import { Search, Grid3X3, List, FileDown, Package, ShoppingCart, Check, Scale } from "lucide-react";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";
import { getSubcategories, type TradeProduct } from "@/lib/tradeProducts";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import SectionHero from "@/components/trade/SectionHero";
import CsvPriceImport from "@/components/trade/CsvPriceImport";
import InlinePriceEditor from "@/components/trade/InlinePriceEditor";
import { GalleryInlineSuggestions } from "@/components/trade/GalleryInlineSuggestions";

const slugifyForUrl = (s: string) =>
  s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface DraftQuote {
  id: string;
  created_at: string;
}

const TradeGallery = () => {
  const { user, isAdmin } = useAuth();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const { allProducts, brands, categories } = useTradeProducts();

  const [search, setSearch] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSubcategory, setSelectedSubcategory] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("original");
  const [showTradePrice, setShowTradePrice] = useState(false);
  const TRADE_DISCOUNT = 0.08;
  const fxRates = useFxRates();
  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const [lightboxProduct, setLightboxProduct] = useState<TradeProductLightboxItem | null>(null);
  const [lastFavoritedRealId, setLastFavoritedRealId] = useState<string | null>(null);
  const [lastFavoritedName, setLastFavoritedName] = useState<string>("");

  // Price lookup from trade_products table
  const [priceLookup, setPriceLookup] = useState<Map<string, { cents: number; currency: string; price_unit?: string }>>(new Map());
  const [priceEntries, setPriceEntries] = useState<{ name: string; cents: number; currency: string; price_unit?: string }[]>([]);

  const normalizeName = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const tokenizeName = (s: string) =>
    normalizeName(s).split(" ").filter((t) => t.length > 2);

  const refreshPrices = async () => {
    const [{ data: tpData }, { data: cpData }] = await Promise.all([
      supabase
        .from("trade_products")
        .select("product_name, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix")
        .not("trade_price_cents", "is", null),
      supabase
        .from("designer_curator_picks")
        .select("title, trade_price_cents, currency, price_prefix")
        .not("trade_price_cents", "is", null),
    ]);

    const lookup = new Map<string, { cents: number; currency: string; price_unit?: string; price_prefix?: string | null }>();
    const entries: { name: string; cents: number; currency: string; price_unit?: string; price_prefix?: string | null }[] = [];

    const addEntry = (name: string, cents: number, currency: string, price_unit?: string, price_prefix?: string | null) => {
      const entry = { name, cents, currency, price_unit, price_prefix };
      entries.push(entry);
      lookup.set(name.trim().toLowerCase(), entry);
      const norm = normalizeName(name);
      if (norm) lookup.set(norm, entry);
    };

    // Trade products prices
    for (const p of tpData ?? []) {
      if (p.trade_price_cents) addEntry(p.product_name, p.trade_price_cents, p.currency, p.price_unit, p.price_prefix);
    }

    // Curator picks prices (only add if not already present from trade_products)
    for (const p of cpData ?? []) {
      if (p.trade_price_cents && !lookup.has(p.title.trim().toLowerCase())) {
        addEntry(p.title, p.trade_price_cents, p.currency, undefined, p.price_prefix);
      }
    }

    setPriceLookup(lookup);
    setPriceEntries(entries);
  };

  useEffect(() => {
    refreshPrices();
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
  const getProductPrice = (product: TradeProduct): { cents: number; currency: string; price_unit?: string; price_prefix?: string | null } | null => {
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
    let best: { cents: number; currency: string; price_unit?: string; price_prefix?: string | null } | null = null;
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

  const getDisplayPrice = (p: { cents: number; currency: string; price_unit?: string; price_prefix?: string | null } | null) => {
    if (!p) return null;
    return showTradePrice ? { ...p, cents: Math.round(p.cents * (1 - TRADE_DISCOUNT)) } : p;
  };

  const renderPriceDisplay = (
    price: { cents: number; currency: string; price_unit?: string; price_prefix?: string | null } | null,
    className: string,
  ) => {
    if (!price) return null;

    const tradePrice = Math.round(price.cents * (1 - TRADE_DISCOUNT));
    const pfx = price.price_prefix ? `${price.price_prefix} ` : '';

    return (
      <span className={className}>
        {showTradePrice ? (
          <>
            <span className="line-through text-muted-foreground/60 font-normal text-xs">
              {`${pfx}${formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates, price.price_unit)}`}
            </span>
            <span className="text-accent font-semibold">
              {`${pfx}${formatPriceConverted(tradePrice, price.currency, displayCurrency, fxRates, price.price_unit)}`}
            </span>
            <span className="font-body text-[9px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full uppercase tracking-wider">–8%</span>
          </>
        ) : (
          <span className="text-foreground font-semibold">
            {`${pfx}${formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates, price.price_unit)}`}
          </span>
        )}
      </span>
    );
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
      const matchesBrand = selectedBrand === "all" || p.brand_name === selectedBrand || p.reedition_by === selectedBrand;
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
      hoverImage: product.hover_image_url,
      materials: product.materials,
      dimensions: product.dimensions,
      category: product.category,
      subcategory: product.subcategory,
    },
    designerName: product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name,
    designerId: product.id,
    section: "designers",
    price: (() => {
      const p = getDisplayPrice(getProductPrice(product));
      return p ? formatPriceConverted(p.cents, p.currency, displayCurrency, fxRates, p.price_unit) : null;
    })(),
  });

  const toLightboxItem = (product: TradeProduct): TradeProductLightboxItem => {
    const price = getDisplayPrice(getProductPrice(product));
    return {
      id: product.id,
      product_name: product.product_name,
      subtitle: product.subtitle,
      image_url: product.image_url,
      hover_image_url: product.hover_image_url,
      brand_name: product.brand_name,
      materials: product.materials,
      dimensions: product.dimensions,
      description: product.description,
      category: product.category,
      subcategory: product.subcategory,
      pdf_url: product.pdf_url,
      price: price ? formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates, price.price_unit) : null,
    };
  };

  const handleLightboxAddToQuote = (item: TradeProductLightboxItem) => {
    const product = allProducts.find((p) => p.id === item.id);
    if (product) handleAddToQuote(product);
  };

  const handleFavorite = async (product: TradeProduct) => {
    const realId = await toggleFavorite(product.id, {
      product_name: product.product_name,
      brand_name: product.brand_name,
      category: product.category,
      image_url: product.image_url,
      dimensions: product.dimensions,
      materials: product.materials,
    });
    if (realId) {
      setLastFavoritedRealId(realId);
      setLastFavoritedName(product.product_name);
      toast({ title: "Added to favorites", description: product.product_name });
    } else {
      setLastFavoritedRealId(null);
      toast({ title: "Removed from favorites", description: product.product_name });
    }
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
          <CsvPriceImport onComplete={() => refreshPrices()} />
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
            <option value="all">All Designers & Makers ({brands.length})</option>
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
          <button
            onClick={() => setShowTradePrice((v) => !v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-md border font-body text-xs transition-colors",
              showTradePrice
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
            title={showTradePrice ? "Showing trade price (–8%)" : "Showing retail price"}
          >
            <Tag className="h-3.5 w-3.5" />
            {showTradePrice ? "Retail" : "Trade"}
          </button>
        </div>
      </div>

      {/* Minimal suggestion strip above grid */}
      <GalleryInlineSuggestions selectedCategory={selectedCategory} selectedSubcategory={selectedSubcategory} selectedBrand={selectedBrand} onProductClick={(id) => {
        const match = allProducts.find(p => p.id === id);
        if (match) setLightboxProduct(toLightboxItem(match));
      }} />

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <p className="font-body text-sm text-muted-foreground">
            No products match your search criteria.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4")}>
          {filtered.map((product) => {
            const isAdding = addingProductId === product.id;
            const isAdded = addedProductIds.has(product.id);
            const price = getProductPrice(product);
            const pinned = isPinned(product.product_name, product.id);
            return (
              <div key={product.id} className="group relative border border-border rounded-lg hover:border-foreground/20 transition-colors">
                <div className="aspect-square bg-muted/30 relative overflow-hidden rounded-t-lg cursor-pointer" onClick={() => setLightboxProduct(toLightboxItem(product))}>
                  {product.image_url ? (
                    <>
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        className={cn(
                          "absolute inset-0 w-full h-full object-cover transition-all duration-700",
                          product.hover_image_url ? "opacity-100 group-hover:opacity-0 group-hover:scale-105" : "group-hover:scale-105"
                        )}
                        loading="lazy"
                      />
                      {product.hover_image_url && (
                        <img
                          src={product.hover_image_url}
                          alt={`${product.product_name} hover view`}
                          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-all duration-700 scale-105 group-hover:scale-100"
                          loading="lazy"
                        />
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <ProductCardDescriptionOverlay description={product.description} />
                   {/* Favorite button */}
                   <button
                     onClick={(e) => { e.stopPropagation(); handleFavorite(product); }}
                     className={cn(
                       "absolute top-2 left-2 z-10 p-1.5 rounded-full transition-all",
                       isFavorited(product.id)
                         ? "bg-background/90 text-destructive shadow-md"
                         : "bg-background/70 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-background/90"
                     )}
                     aria-label={isFavorited(product.id) ? "Remove from favorites" : "Add to favorites"}
                   >
                     <Heart className={cn("h-3.5 w-3.5", isFavorited(product.id) && "fill-current")} />
                   </button>
                   {/* Pin button */}
                   <button
                     onClick={(e) => { e.stopPropagation(); togglePin(toCompareItem(product)); }}
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
                  <div className="absolute inset-x-0 bottom-0 p-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
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
                        href={buildSpecSheetUrl(product.pdf_url, product.brand_name, product.product_name)}
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
                {/* Description in portal tooltip */}
                <div className="p-3 text-center">
                   <p className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                     {product.reedition_by
                       ? `${product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name} by ${product.reedition_by}`
                       : product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name}
                   </p>
                   <h3 className="font-display text-sm text-foreground leading-tight mb-0.5 truncate">
                     {product.product_name}
                   </h3>
                  {isAdmin ? (
                    <div className="mt-1 flex flex-col items-center gap-1.5">
                      {renderPriceDisplay(price, "font-display text-sm inline-flex items-center justify-center gap-1.5 flex-wrap")}
                      <InlinePriceEditor
                        productName={product.product_name}
                        brandName={product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name}
                        currentPriceCents={price?.cents}
                        currency={price?.currency || "SGD"}
                        priceUnit={price?.price_unit}
                        displayCurrency={displayCurrency}
                        fxRates={fxRates}
                        onPriceUpdated={() => refreshPrices()}
                      />
                    </div>
                  ) : (
                    renderPriceDisplay(price, "font-display text-sm mt-1 inline-flex items-center justify-center gap-1.5 flex-wrap")
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
                   <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                     {product.reedition_by
                       ? `${product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name} by ${product.reedition_by}`
                       : product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name}
                   </p>
                   <h3 className="font-display text-sm text-foreground truncate">{product.product_name}</h3>
                </div>
                {isAdmin ? (
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {renderPriceDisplay(price, "font-display text-sm inline-flex items-center gap-1.5 flex-wrap justify-end")}
                    <InlinePriceEditor
                      productName={product.product_name}
                      brandName={product.brand_name.includes(' - ') ? product.brand_name.split(' - ')[0].trim() : product.brand_name}
                      currentPriceCents={price?.cents}
                      currency={price?.currency || "SGD"}
                      priceUnit={price?.price_unit}
                      displayCurrency={displayCurrency}
                      fxRates={fxRates}
                      onPriceUpdated={() => refreshPrices()}
                    />
                  </div>
                ) : (
                  renderPriceDisplay(price, "font-display text-sm shrink-0 inline-flex items-center gap-1.5 flex-wrap")
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
                  <a href={buildSpecSheetUrl(product.pdf_url, product.brand_name, product.product_name)} target="_blank" rel="noopener noreferrer"
                    className="p-2 text-[hsl(var(--pdf-red))] hover:text-[hsl(var(--pdf-red))]/80 transition-colors" title="Spec sheet">
                    <FileDown className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => handleFavorite(product)}
                  className={cn(
                    "p-2 rounded-full transition-all shrink-0",
                    isFavorited(product.id) ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label={isFavorited(product.id) ? "Remove from favorites" : "Favorite"}
                >
                  <Heart className={cn("h-3.5 w-3.5", isFavorited(product.id) && "fill-current")} />
                </button>
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
      <TradeProductLightbox
        product={lightboxProduct}
        onClose={() => setLightboxProduct(null)}
        onAddToQuote={handleLightboxAddToQuote}
        isAdding={!!addingProductId}
        isAdded={lightboxProduct ? addedProductIds.has(lightboxProduct.id) : false}
        onSelectRelated={(rp) => setLightboxProduct(rp)}
      />
    </>
  );
};

export default TradeGallery;
