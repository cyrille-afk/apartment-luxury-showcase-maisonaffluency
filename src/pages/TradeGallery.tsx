import { parseBudgetAmount, parseGallerySearch, matchesSize, priceForSize, type PricedVariant } from "@/lib/gallerySearchIntent";
import { useState, useMemo, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { readSavedViews, saveView, deleteView, type TradeSavedView } from "@/lib/tradeSavedViews";
import { syncSavedViews, pushSavedView, removeSavedView } from "@/lib/tradeSavedViewsSync";
import { useClientSafeMode } from "@/lib/clientSafeMode";
const EditorialDesignerProfile = lazy(() => import("./PublicDesignerProfile"));
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useNavigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, FolderOpen } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";
import AddToProjectPopover from "@/components/trade/AddToProjectPopover";
import TradeFavoriteFolderPicker from "@/components/trade/TradeFavoriteFolderPicker";

import { Search, FileDown, Package, ShoppingCart, Check, Scale, Info, X, List } from "lucide-react";
import { countTradeCollectionPieces, filterTradeProducts } from "@/lib/tradeFilter";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import CurrencyToggle, { type DisplayCurrency, convertCents, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";
import { getSubcategories, type TradeProduct } from "@/lib/tradeProducts";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { useDesigner } from "@/hooks/useDesigner";
import { useDesignerGalleryPicks } from "@/hooks/useDesignerGalleryPicks";
import { creditsDesigner } from "@/lib/designerCollaboration";
import { isTradeProductMarkedHidden, useHiddenTradeProductIds } from "@/hooks/useHiddenTradeProductIds";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useBrandDiscountCaps, effectiveDiscountForBrand, MARGIN_CAP_TOOLTIP } from "@/lib/brandDiscountCap";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { useToast } from "@/hooks/use-toast";
import QuoteDrawer from "@/components/trade/QuoteDrawer";

import CsvPriceImport from "@/components/trade/CsvPriceImport";
import InlinePriceEditor from "@/components/trade/InlinePriceEditor";
import { normalizeBrandToParent } from "@/lib/brandNormalization";
import { sortNameKey } from "@/lib/nameFormat";
import { sortTradeProducts } from "@/lib/tradeSort";
import { curateGrid, useImageTones } from "@/lib/curateGrid";
import { interleaveBySubcategory, sortCuratorPicks } from "@/lib/curatorPickSort";
import AlphabetDesignerPicker from "@/components/trade/AlphabetDesignerPicker";
import { usePublishedMakerNames } from "@/hooks/usePublishedMakerNames";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import DuplicateProductsBanner from "@/components/dev/DuplicateProductsBanner";
import { createActiveDraftQuote, fetchScopedDraftQuotes } from "@/lib/activeProjectId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import GalleryFilterSelect from "@/components/trade/GalleryFilterSelect";
import GridDensityToggle from "@/components/GridDensityToggle";
import NewInSpotlight from "@/components/NewInSpotlight";
import { readTradeGalleryState } from "@/lib/tradeGalleryState";
import { useTradeGalleryScroll } from "@/hooks/useTradeGalleryScroll";


const slugifyForUrl = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

interface DraftQuote {
  id: string;
  created_at: string;
}

const TradeGallery = () => {
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const { clientSafe } = useClientSafeMode();
  return slug && clientSafe ? (
    <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><DotCircleLoader size="md" /></div>}>
      <EditorialDesignerProfile presentation />
    </Suspense>
  ) : <StudioGallery key={location.pathname} />;
};

const StudioGallery = () => {
  const { user, isAdmin } = useAuth();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();
  const { toast } = useToast();
  const { allProducts: tradeProducts, publicTradeHiddenProducts, liveProducts, brands, categories, duplicateGroups, isLoading: productsLoading } = useTradeProducts();
  const publishedMakerNames = usePublishedMakerNames();
  // Drive the dropdown from the live published-profile list so it always
  // matches the maker count; fall back to product-derived brands while loading.
  const dropdownBrands = useMemo(() => {
    if (publishedMakerNames) return publishedMakerNames;
    return brands;
  }, [brands, publishedMakerNames]);
  const { ids: hiddenTradeProductIds } = useHiddenTradeProductIds();
  const [searchParams, setSearchParams] = useSearchParams();
  const savedGallery = useRef(readTradeGalleryState(window.location.pathname)).current;

  const [search, setSearch] = useState(savedGallery.search ?? "");
  const searchIntent = useMemo(() => parseGallerySearch(search), [search]);
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const fieldBudget = useMemo(() => {
    const min = parseBudgetAmount(budgetMin);
    const max = parseBudgetAmount(budgetMax);
    return { min: min.cents, max: max.cents, currency: min.currency ?? max.currency ?? null };
  }, [budgetMin, budgetMax]);
  const [selectedBrand, setSelectedBrand] = useState(savedGallery.brand ?? "all");
  const [selectedCategory, setSelectedCategory] = useState(() => searchParams.get("category") || savedGallery.category || "all");
  const [selectedSubcategory, setSelectedSubcategory] = useState(() => searchParams.get("subcategory") || savedGallery.subcategory || "all");
  const allProducts = useMemo(() => (
    search.trim() || selectedBrand !== "all" || selectedCategory !== "all" || selectedSubcategory !== "all"
      ? [...tradeProducts, ...publicTradeHiddenProducts]
      : tradeProducts
  ), [tradeProducts, publicTradeHiddenProducts, search, selectedBrand, selectedCategory, selectedSubcategory]);
  const [selectedEdition, setSelectedEdition] = useState(savedGallery.edition ?? "all");
  const [sortBy, setSortBy] = useState<"curated" | "designer" | "title" | "recent">(savedGallery.sortBy ?? "curated");
  const [savedViews, setSavedViews] = useState<TradeSavedView[]>(() => readSavedViews());
  useEffect(() => {
    let alive = true;
    syncSavedViews().then((v) => { if (alive && v) setSavedViews(v); }).catch((err) => console.warn("Saved views sync failed", err));
    return () => { alive = false; };
  }, []);
  const [viewMode, setViewMode] = useState<"grid" | "list">(savedGallery.viewMode ?? "grid");
  const [density, setDensity] = useState<"comfortable" | "compact">(() => {
    if (typeof window === "undefined") return "comfortable";
    // Default to 4-column (compact); new storage key resets the legacy 3-column default
    return (localStorage.getItem("trade:gridDensity:v2") as "comfortable" | "compact") || "compact";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("trade:gridDensity:v2", density);
  }, [density]);
  const [displayCurrency, setDisplayCurrency] = useTradeDisplayCurrency();
  const { showTradePrice } = useTradePriceMode();
  const { discountPct: TRADE_DISCOUNT } = useTradeDiscount();
  const brandCaps = useBrandDiscountCaps();
  const fxRates = useFxRates();
  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const [designerSlugMap, setDesignerSlugMap] = useState<Map<string, string>>(new Map());
  const [slugBrandMap, setSlugBrandMap] = useState<Map<string, string>>(new Map());
  const [lastFavoritedRealId, setLastFavoritedRealId] = useState<string | null>(null);
  const [lastFavoritedName, setLastFavoritedName] = useState<string>("");

  const navigate = useNavigate();
  const location = useLocation();
  const { slug: routeBrandSlug } = useParams<{ slug: string }>();
  const { data: galleryDesigner, isLoading: designerLoading } = useDesigner(routeBrandSlug, { includeTradeOnly: true });
  const { picks: galleryPicks, isLoading: galleryPicksLoading } = useDesignerGalleryPicks(galleryDesigner);
  useTradeGalleryScroll(location.pathname, location.search, { search, brand: selectedBrand, category: selectedCategory, subcategory: selectedSubcategory, edition: selectedEdition, sortBy, viewMode }, productsLoading || designerLoading || galleryPicksLoading);

  const openProductSheet = useCallback((product: TradeProduct) => {
    if (product.hidden_in_trade) {
      if (product.public_product_slug) navigate(`/designers/collection-particuliere/${product.public_product_slug}`, {
        state: { from: location.pathname + location.search },
      });
      return;
    }
    if (product.trade_product_id) {
      navigate(`/trade/products/${product.trade_product_id}`, {
        state: { from: location.pathname + location.search },
      });
      return;
    }

    const brand = product.brand_name.includes(" - ")
      ? product.brand_name.split(" - ")[0].trim()
      : product.brand_name;
    const designerSlug =
      designerSlugMap.get(brand.toLowerCase()) ||
      designerSlugMap.get(product.brand_name.toLowerCase()) ||
      slugifyForUrl(brand);
    const productSlug = slugifyForUrl(product.product_name);
    navigate(`/trade/products/${designerSlug}/${productSlug}`, {
      state: { from: location.pathname + location.search },
    });
  }, [designerSlugMap, navigate, location.pathname, location.search]);

  // Price lookup from trade_products table
  const [priceLookup, setPriceLookup] = useState<Map<string, { cents: number; currency: string; price_unit?: string; price_prefix?: string | null; brand_name?: string | null; variants?: PricedVariant[] }>>(new Map());
  const [priceEntries, setPriceEntries] = useState<{ name: string; cents: number; currency: string; price_unit?: string; price_prefix?: string | null; brand_name?: string | null; variants?: PricedVariant[] }[]>([]);

  const normalizeName = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const stripDesignerSuffix = (s: string) =>
    s.replace(/\s+by\s+[^,–—]+$/i, "").trim();
  const tokenizeName = (s: string) =>
    normalizeName(s).split(" ").filter((t) => t.length > 2);

  const refreshPrices = async () => {
    // Source of truth for trade gallery prices is the Designer Editor only
    // (designer_curator_picks). trade_products may contain scraped/CSV values
    // that haven't been manually reviewed, so we deliberately do NOT read
    // prices from there in the gallery views.
    const { data: cpData } = await supabase
      .from("designer_curator_picks")
      .select("title, trade_price_cents, currency, price_prefix, size_variants, designers(name, founder)");

    const lookup = new Map<string, { cents: number; currency: string; price_unit?: string; price_prefix?: string | null; brand_name?: string | null; variants?: PricedVariant[] }>();
    const entries: { name: string; cents: number; currency: string; price_unit?: string; price_prefix?: string | null; brand_name?: string | null; variants?: PricedVariant[] }[] = [];

    const addEntry = (name: string, cents: number, currency: string, price_unit?: string, price_prefix?: string | null, brand_name?: string | null, variants?: PricedVariant[]) => {
      const entry = { name, cents, currency, price_unit, price_prefix, brand_name, variants };
      entries.push(entry);
      const aliases = new Set([name, stripDesignerSuffix(name)].filter(Boolean));
      for (const alias of aliases) {
        lookup.set(alias.trim().toLowerCase(), entry);
        const norm = normalizeName(alias);
        if (norm) lookup.set(norm, entry);
      }
    };

    for (const p of cpData ?? []) {
      const designer = Array.isArray((p as any).designers) ? (p as any).designers[0] : (p as any).designers;
      const brandName = designer?.name ? normalizeBrandToParent(designer.name) : null;
      const variants = Array.isArray((p as any).size_variants) ? ((p as any).size_variants as PricedVariant[]) : [];
      if (p.trade_price_cents) {
        addEntry(p.title, p.trade_price_cents, p.currency, undefined, p.price_prefix, brandName, variants);
        continue;
      }
      // Fallback: derive a "from" price from size_variants when the row-level
      // trade_price_cents wasn't filled in but per-variant prices exist
      // (e.g. Niko Sofa where each size has its own price).
      const variantPrices = variants
        .map((v) => Number(v?.price_cents))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (variantPrices.length > 0) {
        const minPrice = Math.min(...variantPrices);
        const prefix = variantPrices.length > 1 ? (p.price_prefix || "from") : p.price_prefix;
        addEntry(p.title, minPrice, p.currency, undefined, prefix, brandName, variants);
      }
    }

    setPriceLookup(lookup);
    setPriceEntries(entries);
  };

  useEffect(() => {
    refreshPrices();
  }, []);

  // Fetch user's draft quotes — scoped to the active project or the current session quote.
  useEffect(() => {
    if (!user) return;
    const fetchDrafts = async () => {
      const drafts = await fetchScopedDraftQuotes(user.id);
      setDraftQuotes(drafts);
      setActiveQuoteId(drafts.length > 0 ? drafts[0].id : null);
    };
    fetchDrafts();
  }, [user]);

  const handleCreateQuoteAndAdd = async (product: TradeProduct) => {
    if (!user || product.hidden_in_trade) return;
    setAddingProductId(product.id);
    const { data, error } = await createActiveDraftQuote(user.id);
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
    if (!user || product.hidden_in_trade) return;
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
    () => (selectedCategory !== "all" ? getSubcategories([...tradeProducts, ...publicTradeHiddenProducts], selectedCategory) : []),
    [tradeProducts, publicTradeHiddenProducts, selectedCategory]
  );

  /**
   * Find price by exact or normalized name only.
   *
   * Substring/token-overlap matching used to leak prices between unrelated
   * products that happened to share a word (e.g. "PEDRO Coffee Table" picking
   * up the price of "Pedro the Croc Box"). Designer Editor is the source of
   * truth: no exact match → no price shown.
   */
  const getProductPrice = (product: TradeProduct): { cents: number; currency: string; price_unit?: string; price_prefix?: string | null } | null => {
    if (product.hidden_in_trade) return null;
    const nameKey = product.product_name.trim().toLowerCase();
    if (priceLookup.has(nameKey)) return priceLookup.get(nameKey)!;
    if (product.subtitle) {
      const comboKey = `${nameKey} ${product.subtitle.trim().toLowerCase()}`;
      if (priceLookup.has(comboKey)) return priceLookup.get(comboKey)!;
      const byKey = `${nameKey} by ${product.subtitle.trim().toLowerCase()}`;
      if (priceLookup.has(byKey)) return priceLookup.get(byKey)!;
    }
    const norm = normalizeName(product.product_name);
    if (priceLookup.has(norm)) return priceLookup.get(norm)!;

    // Last-resort match is brand-scoped and token-overlap based. This covers
    // curated title drift such as "Madison Avenue Cocktail Table" in the grid
    // versus "Madison Avenue Side Table by Yabu Pushelberg" in Designer Editor,
    // without reviving broad cross-brand substring leakage.
    const productBrand = normalizeName(normalizeBrandToParent(product.brand_name));
    const productTokens = new Set(tokenizeName(product.product_name));
    if (productTokens.size >= 3) {
      let best: typeof priceEntries[number] | null = null;
      let bestScore = 0;
      for (const entry of priceEntries) {
        if (!entry.brand_name || normalizeName(entry.brand_name) !== productBrand) continue;
        const entryTokens = tokenizeName(stripDesignerSuffix(entry.name));
        if (entryTokens.length < 3) continue;
        const overlap = entryTokens.filter((t) => productTokens.has(t)).length;
        const score = overlap / Math.max(productTokens.size, entryTokens.length);
        if (score >= 0.7 && score > bestScore) {
          best = entry;
          bestScore = score;
        }
      }
      if (best) return best;
    }
    return null;
  };

  /** Tier rate, capped by the supplier's own `max_trade_discount` when set. */
  const brandDiscountPct = (brandName?: string | null) =>
    effectiveDiscountForBrand(TRADE_DISCOUNT, brandName, brandCaps);

  const getDisplayPrice = (
    p: { cents: number; currency: string; price_unit?: string; price_prefix?: string | null } | null,
    brandName?: string | null,
  ) => {
    if (!p) return null;
    const { pct } = brandDiscountPct(brandName);
    return showTradePrice ? { ...p, cents: Math.round(p.cents * (1 - pct)) } : p;
  };

  const renderPriceDisplay = (
    price: { cents: number; currency: string; price_unit?: string; price_prefix?: string | null } | null,
    className: string,
    brandName?: string | null,
  ) => {
    if (!price) return null;

    const { pct, capped } = brandDiscountPct(brandName);
    const tradePrice = Math.round(price.cents * (1 - pct));
    const pfx = price.price_prefix ? `${price.price_prefix} ` : '';
    const retailLabel = `${pfx}${formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates, price.price_unit)}`;
    const tradeLabel = `${pfx}${formatPriceConverted(tradePrice, price.currency, displayCurrency, fxRates, price.price_unit)}`;

     return (
       <>
       <span data-trade-sensitive={showTradePrice ? "" : undefined} className={className}>
        {showTradePrice ? (
          <>
            <span className="text-muted-foreground font-normal">
              RRP: {retailLabel}
            </span>
            <span className="text-muted-foreground/50" aria-hidden="true">|</span>
            <span className="text-accent font-semibold">
              TRADE: {tradeLabel}
            </span>
            {capped && (
              <span
                title={MARGIN_CAP_TOOLTIP}
                aria-label={MARGIN_CAP_TOOLTIP}
                className="inline-flex items-center gap-1 rounded border border-border px-1 py-0.5 text-[9px] uppercase tracking-wider text-muted-foreground"
              >
                <Info className="h-2.5 w-2.5" /> Margin cap
              </span>
            )}
          </>
        ) : (
          <span className="text-foreground font-normal">
            RRP: {retailLabel}
          </span>
        )}
      </span>
       {showTradePrice && <span data-client-placeholder aria-hidden="true" className="h-3 w-20 animate-pulse bg-muted/60" />}
       </>
    );
  };

  const routeBrandName = routeBrandSlug ? slugBrandMap.get(routeBrandSlug) : undefined;

  // Build reverse lookup: brand display name -> slug, so dropdown changes can navigate.
  const brandToSlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const [slug, brand] of slugBrandMap.entries()) {
      if (brand && !m.has(brand)) m.set(brand, slug);
    }
    return m;
  }, [slugBrandMap]);

  // Sync route slug -> dropdown selection (so the <select> visibly reflects the URL).
  const prevSlugRef = useRef<string | undefined>(routeBrandSlug);
  useEffect(() => {
    const cameFromSlug = prevSlugRef.current !== undefined && routeBrandSlug === undefined;
    prevSlugRef.current = routeBrandSlug;
    if (routeBrandName && selectedBrand !== routeBrandName) {
      setSelectedBrand(routeBrandName);
    } else if (cameFromSlug && selectedBrand !== "all") {
      // Navigated from /trade/gallery/:slug back to /trade/gallery (e.g. the
      // Gallery breadcrumb): the component stays mounted, so reset the
      // persisted brand selection to show the full gallery again.
      setSelectedBrand("all");
    }
  }, [routeBrandName, routeBrandSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedCategory === "all") next.delete("category"); else next.set("category", selectedCategory);
    if (selectedSubcategory === "all") next.delete("subcategory"); else next.set("subcategory", selectedSubcategory);
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [selectedCategory, selectedSubcategory, searchParams, setSearchParams]);

  // Dropdown -> URL: keep route in sync with dropdown so paginate/search/share stays consistent.
  const handleBrandChange = (value: string) => {
    setSelectedBrand(value);
    setSelectedEdition("all");
    if (value === "all") {
      if (routeBrandSlug) navigate("/trade/gallery", { replace: false });
      return;
    }
    const targetSlug = brandToSlug.get(value);
    if (targetSlug && targetSlug !== routeBrandSlug) {
      navigate(`/trade/gallery/${targetSlug}`, { replace: false });
    } else if (!targetSlug && routeBrandSlug) {
      navigate("/trade/gallery", { replace: false });
    }
  };

  const activeBrand = routeBrandName || (selectedBrand === "all" ? null : selectedBrand);
  const editions = useMemo(() => {
    const byKey = new Map<string, string>();
    for (const p of allProducts) {
      // Scope collections to the chosen designer: offering every studio's
      // collections once a designer is picked makes no sense.
      if (activeBrand && p.brand_name !== activeBrand && p.reedition_by !== activeBrand) continue;
      const ed = (p.edition || "").trim();
      if (!ed) continue;
      const key = ed.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, ed);
    }
    // Named collections (e.g. "CC-Tapis Edition", "Erased Heritage Collection")
    // come first; pure size labels ("Edition of 12") follow, both alphabetical.
    const isSizeLabel = (ed: string) =>
      /^(edition of|limited edition|numbered|unique piece|copies\b|\d+\s+copies)/i.test(ed);
    return [...byKey.values()].sort((a, b) => {
      const aSize = isSizeLabel(a) ? 1 : 0;
      const bSize = isSizeLabel(b) ? 1 : 0;
      return aSize - bSize || sortNameKey(a).localeCompare(sortNameKey(b));
    });
  }, [allProducts, activeBrand]);
  // Direct navigation (or a saved view) can leave a collection selected that
  // doesn't belong to the active designer — clear it.
  useEffect(() => {
    if (productsLoading || !publishedMakerNames) return;
    if (selectedEdition !== "all" && !editions.some((ed) => ed.toLowerCase() === selectedEdition.toLowerCase())) {
      setSelectedEdition("all");
    }
  }, [editions, selectedEdition, productsLoading, publishedMakerNames]);
  // Pieces per collection beside each entry in the collection dropdown. The
  // collection filter itself is excluded so the number is what picking it
  // would show, given the designer / category / search already applied.
  const collectionCounts = useMemo(() => {
    const visible = allProducts.filter((p) => !isTradeProductMarkedHidden(p, hiddenTradeProductIds));
    return countTradeCollectionPieces(visible, {
      search: searchIntent.text,
      brand: routeBrandName || (selectedBrand === "all" ? null : selectedBrand),
      category: selectedCategory,
      subcategory: selectedSubcategory,
    });
  }, [allProducts, hiddenTradeProductIds, search, routeBrandName, selectedBrand, selectedCategory, selectedSubcategory]);
  const editionCounts = useMemo(
    () => Object.fromEntries(editions.map((ed) => [ed, collectionCounts.byCollection.get(ed.toLowerCase()) ?? 0])),
    [editions, collectionCounts],
  );
  const matchedProducts = useMemo(() => {
    const visible = allProducts.filter((p) => !isTradeProductMarkedHidden(p, hiddenTradeProductIds));
    return filterTradeProducts(visible, {
      search: searchIntent.text,
      brand: routeBrandName || (selectedBrand === "all" ? null : selectedBrand),
      category: selectedCategory,
      subcategory: selectedSubcategory,
      edition: selectedEdition,
    });
  }, [allProducts, hiddenTradeProductIds, search, routeBrandName, selectedBrand, selectedCategory, selectedSubcategory, selectedEdition]);
  const imageTones = useImageTones(matchedProducts.map((p) => p.image_url || ""));
  const canonicalProducts = useMemo(() => {
    if (!routeBrandSlug || !galleryDesigner || galleryDesigner.trade_only) return null;
    // The merged grid deduplicates by brand/title. Resolve saved pick IDs from
    // the live rows as well so no public card disappears due to a name collision.
    const byId = new Map([...allProducts, ...liveProducts].map((product) => [product.id, product]));
    return galleryPicks.flatMap((pick) => {
      const product = byId.get(pick.id);
      if (!product || isTradeProductMarkedHidden(product, hiddenTradeProductIds)) return [];
      // Filter the shared public sequence, not the trade brand name: a credited
      // designer may feature a piece owned by a different atelier.
      const [kept] = filterTradeProducts([product], {
        search: searchIntent.text,
        category: selectedCategory,
        subcategory: selectedSubcategory,
        edition: selectedEdition,
      });
      if (!kept) return [];
      return [{ ...product, image_url: pick.image_url, hover_image_url: pick.hover_image_url || undefined }];
    });
  }, [routeBrandSlug, galleryDesigner, galleryPicks, allProducts, liveProducts, hiddenTradeProductIds, search, selectedCategory, selectedSubcategory, selectedEdition]);
  // Budget/size phrases typed in search ("260 cm table under €20,000"), plus the
  // standalone Min/Max budget fields. Budget compares the shown price mode
  // (trade or RRP) of the matching size; unpriced pieces can't be confirmed, so they drop out.
  const fitsIntent = (p: TradeProduct) => {
    const { sizeMm, sizeMode, budgetCents } = searchIntent;
    const hasFieldBudget = fieldBudget.min !== null || fieldBudget.max !== null;
    if (!sizeMm && !budgetCents && !hasFieldBudget) return true;
    const base = getProductPrice(p);
    const variants = (base as { variants?: PricedVariant[] } | null)?.variants;
    if (sizeMm) {
      const sizeOk = matchesSize(p.dimensions, sizeMm, sizeMode) ||
        (variants || []).some((v) => [v.label, v.base, v.top].some((t) => matchesSize(t, sizeMm, sizeMode)));
      if (!sizeOk) return false;
    }
    if (!hasFieldBudget && !budgetCents) return true;
    // Budget is tested against the matching size's own price, never the cheapest "From".
    if (!base) return false;
    const cents = priceForSize(base.cents, p.dimensions, variants, sizeMm, sizeMode);
    if (!cents) return false;
    const price = getDisplayPrice({ ...base, cents }, p.brand_name)!;
    const cur = ((budgetCents != null ? searchIntent.budgetCurrency : fieldBudget.currency) || (displayCurrency === "original" ? "EUR" : displayCurrency)) as DisplayCurrency;
    if (price.currency !== cur && !fxRates[`${price.currency}_${cur}`]) return false;
    const shown = convertCents(price.cents, price.currency, cur, fxRates);
    if (budgetCents != null && shown > budgetCents) return false;
    if (fieldBudget.min !== null && shown < fieldBudget.min) return false;
    if (fieldBudget.max !== null && shown > fieldBudget.max) return false;
    return true;
  };
  const filtered = useMemo(
    () => {
      if (canonicalProducts) return canonicalProducts.filter(fitsIntent);
      // Trade-only designers have no public counterpart. Use their saved order.
      if (routeBrandName || selectedBrand !== "all") {
        return interleaveBySubcategory(sortCuratorPicks(
          matchedProducts.filter(fitsIntent).map((p) => ({ ...p, sort_order: p.sort_order ?? null })),
        ));
      }
      return curateGrid(matchedProducts.filter(fitsIntent), (p) => normalizeBrandToParent(p.brand_name).trim().toLowerCase(), (p) => imageTones[p.image_url || ""]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchedProducts, canonicalProducts, fitsIntent, routeBrandName, selectedBrand, imageTones, Object.keys(imageTones).length],
  );

  // Explicit sort options layered on top of the curated sequence.
  const sorted = useMemo(
    () => sortTradeProducts(filtered, sortBy),
    [filtered, sortBy],
  );

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
      const p = getDisplayPrice(getProductPrice(product), product.brand_name);
      return p ? formatPriceConverted(p.cents, p.currency, displayCurrency, fxRates, p.price_unit) : null;
    })(),
  });

  // Fetch designer slug map for product-sheet navigation
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("designers")
        .select("name, display_name, slug")
        .eq("is_published", true);
      if (!data) return;
      const map = new Map<string, string>();
      const reverseMap = new Map<string, string>();
      for (const d of data as Array<{ name: string; display_name: string | null; slug: string }>) {
        if (d.name) map.set(d.name.trim().toLowerCase(), d.slug);
        if (d.display_name) map.set(d.display_name.trim().toLowerCase(), d.slug);
        reverseMap.set(d.slug, normalizeBrandToParent(d.display_name || d.name));
      }
      setDesignerSlugMap(map);
      setSlugBrandMap(reverseMap);
    })();
  }, []);

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

  const filterInputClass =
    "h-11 w-full min-w-0 border border-border bg-background px-4 font-body text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors";

  return (
    <>
      <Helmet><title>Gallery — Trade Portal — Maison Affluency</title></Helmet>
    <div className="w-full max-w-7xl mx-auto bg-[hsl(var(--trade-gallery-bg))]">
      {routeBrandSlug && galleryDesigner && !galleryDesigner.trade_only && (
        <div className="mb-4 border-b border-border/40 pb-4 md:mb-5 md:pb-5">
          <NewInSpotlight
            designer={galleryDesigner}
            showEyebrow={false}
            variant="underlaid"
            profileOnly
            pageDesignerName={galleryDesigner.name}
          />
        </div>
      )}
      <div className="flex items-end justify-between gap-4 pb-2 border-b border-[#E5E5E5]">
        <div>
          <h1 className="font-display text-base md:text-lg font-normal tracking-wide text-foreground">Trade Gallery</h1>
          <p className="mt-0.5 font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "collected piece" : "collected pieces"}
            {selectedBrand !== "all" ? ` from ${selectedBrand}` : ""}
          </p>
        </div>
        {isAdmin && (
          <CsvPriceImport minimal onComplete={() => refreshPrices()} />
        )}
      </div>

      <DuplicateProductsBanner groups={duplicateGroups} />

        <div className="flex items-center justify-between gap-3 mt-2 mb-3">
          <div className="flex min-w-0 items-center gap-3 w-full sm:w-[26rem]" data-testid="gallery-search-currency">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" aria-label="Search pieces" placeholder="e.g. 260 cm table under €20,000" value={search} onChange={(e) => setSearch(e.target.value)} className="h-11 border-border pl-9 font-body" />
            </div>
            <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} variant="dropdown" className="[&>button]:h-11 [&>button]:px-3 [&>button]:tracking-normal" />
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-1.5 text-muted-foreground/60 hover:text-foreground transition-colors"
            title="View active quote"
          >
            <ShoppingCart className="h-4 w-4" />
            {addedProductIds.size > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-[9px] font-medium rounded-full flex items-center justify-center">
                {addedProductIds.size}
              </span>
            )}
          </button>
        </div>

      <DuplicateProductsBanner groups={duplicateGroups} />

      {/* Primary toolbar: search/currency, filters, then results/view controls. */}
      <div className="mb-4 border-y border-border py-4" data-testid="gallery-filter-toolbar">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className={cn("grid min-w-0 grid-cols-1 gap-3 xl:flex-1", subcategories.length > 0 ? "sm:grid-cols-4" : "sm:grid-cols-3")} data-testid="gallery-primary-filters">
            <div className="min-w-0 [&>div]:w-full">
              {productsLoading ? (
                <div className={`${filterInputClass} gallery-filter-pill flex items-center rounded-full text-muted-foreground`} aria-busy="true">Loading designers…</div>
              ) : (
                <AlphabetDesignerPicker brands={dropdownBrands} value={selectedBrand} onChange={handleBrandChange} allLabel="Studio / Creator" hideCount selectClassName={`${filterInputClass} gallery-filter-pill !w-full !min-w-0 rounded-full text-base sm:text-sm`} />
              )}
            </div>
            <GalleryFilterSelect value={selectedCategory} onChange={(value) => { setSelectedCategory(value); setSelectedSubcategory("all"); }} label="Filter by category" allLabel="All Categories" options={categories} />
            {subcategories.length > 0 && <GalleryFilterSelect value={selectedSubcategory} onChange={setSelectedSubcategory} label="Filter by subcategory" allLabel="All Subcategories" options={subcategories} />}
            <GalleryFilterSelect value={selectedEdition} onChange={setSelectedEdition} label="Filter by collection or edition" allLabel="All Collections" options={editions} counts={editionCounts} allCount={collectionCounts.total} />
          </div>
          <div className="ml-auto flex shrink-0 items-center justify-end gap-3" data-testid="gallery-view-controls">
            <span role="status" aria-live="polite" className="whitespace-nowrap font-body text-xs text-muted-foreground">{productsLoading ? "…" : filtered.length} {filtered.length === 1 ? "Item" : "Items"} Found</span>
            <div className="flex items-center gap-1">
              <GridDensityToggle value={density === "compact" ? 4 : 3} onChange={(columns) => { setViewMode("grid"); setDensity(columns === 4 ? "compact" : "comfortable"); }} className="!flex shrink-0" />
              <Button type="button" variant={viewMode === "list" ? "default" : "outline"} size="icon" aria-label="Display list" aria-pressed={viewMode === "list"} title="Display list" onClick={() => setViewMode("list")} className={cn("h-10 w-10", viewMode === "list" && "bg-foreground text-background hover:bg-foreground/90")}><List /></Button>
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center" data-testid="gallery-secondary-tools">
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort pieces" className={`${filterInputClass} text-base sm:w-52 sm:text-sm`}>
            <option value="curated">Sort: Curated order</option>
            <option value="designer">Sort: Designer A–Z</option>
            <option value="title">Sort: Title A–Z</option>
            <option value="recent">Sort: Most recently added</option>
          </select>
          <div className="flex items-center gap-2" data-testid="gallery-budget-filter">
            <span className="whitespace-nowrap font-body text-xs uppercase tracking-[0.1em] text-muted-foreground">Budget</span>
            <Input type="text" inputMode="decimal" aria-label="Minimum budget" placeholder="Min" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className={`${filterInputClass} w-24 rounded-full text-base sm:text-sm`} />
            <span aria-hidden="true" className="text-muted-foreground">–</span>
            <Input type="text" inputMode="decimal" aria-label="Maximum budget" placeholder="Max" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className={`${filterInputClass} w-24 rounded-full text-base sm:text-sm`} />
          </div>
          <select value="" aria-label="Saved views"
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__save") {
                  const name = window.prompt("Name this view");
                  if (name && name.trim()) {
                    const next = saveView({ name, search, brand: selectedBrand, category: selectedCategory, subcategory: selectedSubcategory, edition: selectedEdition, sortBy });
                    setSavedViews(next);
                    const saved = next[next.length - 1];
                    pushSavedView(saved).catch((err) => console.warn("Saved view sync failed", err));
                  }
                  return;
                }
                if (val.startsWith("__del:")) {
                  const v = savedViews.find((x) => x.id === val.slice(6));
                  if (v && window.confirm(`Delete saved view "${v.name}"?`)) {
                    setSavedViews(deleteView(v.id));
                    removeSavedView(v.id).catch((err) => console.warn("Saved view delete sync failed", err));
                  }
                  return;
                }
                const v = savedViews.find((x) => x.id === val);
                if (!v) return;
                setSearch(v.search);
                setSelectedCategory(v.category);
                setSelectedSubcategory(v.subcategory);
                setSelectedEdition(v.edition);
                setSortBy(v.sortBy);
                if (v.brand !== selectedBrand) handleBrandChange(v.brand);
              }}
            className={`${filterInputClass} text-base sm:w-52 sm:text-sm`}>
            <option value="" disabled>Saved views{savedViews.length ? ` (${savedViews.length})` : ""}</option>
            {savedViews.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            <option value="__save">+ Save current view…</option>
            {savedViews.length > 0 && <optgroup label="Delete">{savedViews.map((v) => <option key={`d-${v.id}`} value={`__del:${v.id}`}>Delete “{v.name}”</option>)}</optgroup>}
          </select>
        </div>
      </div>
      {/* Active filter chips */}
      {(() => {
        const activeFilters: { key: string; label: string; clear: () => void }[] = [];
        if (search.trim()) activeFilters.push({ key: "search", label: `“${search.trim()}”`, clear: () => setSearch("") });
        const activeBrand = routeBrandName || (selectedBrand !== "all" ? selectedBrand : null);
        if (activeBrand) activeFilters.push({ key: "brand", label: activeBrand, clear: () => handleBrandChange("all") });
        if (selectedCategory !== "all") activeFilters.push({ key: "category", label: selectedCategory, clear: () => { setSelectedCategory("all"); setSelectedSubcategory("all"); } });
        if (selectedSubcategory !== "all") activeFilters.push({ key: "subcategory", label: selectedSubcategory, clear: () => setSelectedSubcategory("all") });
        if (budgetMin.trim() || budgetMax.trim()) activeFilters.push({
          key: "budget",
          label: `Budget ${budgetMin.trim()} – ${budgetMax.trim() || "∞"}`,
          clear: () => { setBudgetMin(""); setBudgetMax(""); },
        });
        if (selectedEdition !== "all") activeFilters.push({ key: "edition", label: selectedEdition, clear: () => setSelectedEdition("all") });
        if (activeFilters.length === 0) return null;
        return (
          <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="active-filter-chips">
            {activeFilters.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={f.clear}
                aria-label={`Clear filter: ${f.label}`}
                title="Clear this filter"
                className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1 font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                <span className="max-w-[14rem] truncate">{f.label}</span>
                <X className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground" aria-hidden="true" />
              </button>
            ))}
            {activeFilters.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("all");
                  setSelectedSubcategory("all");
                  setSelectedEdition("all");
                  if (routeBrandName || selectedBrand !== "all") handleBrandChange("all");
                }}
                className="ml-1 font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground/70 underline underline-offset-4 transition-colors hover:text-foreground"
              >
                Clear all
              </button>
            )}
          </div>
        );
      })()}
      {/* Content */}
      {(productsLoading || (routeBrandSlug && (designerLoading || galleryPicksLoading))) ? (
        <div className="flex min-h-48 items-center justify-center"><DotCircleLoader size="md" /></div>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <p className="font-body text-sm text-muted-foreground">
            No products match your search criteria.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className={cn(
          "grid grid-cols-2 gap-x-4 gap-y-6 transition-[grid-template-columns] duration-300 sm:gap-x-6 lg:gap-x-8 lg:gap-y-8",
          density === "compact" ? "md:grid-cols-4 gap-y-5 lg:gap-y-6" : "md:grid-cols-3",
        )}>
          {sorted.map((product) => {
            const isAdding = addingProductId === product.id;
            const isAdded = addedProductIds.has(product.id);
            const price = getProductPrice(product);
            const pinned = isPinned(product.product_name, product.id);
            return (
              <div key={product.id} className="group relative min-w-0">
                <div className="relative aspect-square w-full overflow-hidden bg-[hsl(var(--product-canvas))] cursor-pointer" onClick={() => openProductSheet(product)}>
                  {product.image_url ? (
                    <>
                      <img
                        src={product.image_url}
                        alt={product.product_name}
                        width={800}
                        height={1000}
                        decoding="async"
                        className={cn(
                          "absolute inset-0 w-full h-full object-contain object-center mix-blend-multiply p-6 transition-all duration-700",
                          product.hover_image_url ? "opacity-100 group-hover:opacity-0 group-hover:scale-105" : "group-hover:scale-105"
                        )}
                        loading="lazy"
                      />
                      {product.hover_image_url && (
                        <img
                          src={product.hover_image_url}
                          alt={`${product.product_name} hover view`}
                          width={800}
                          height={1000}
                          decoding="async"
                          className="absolute inset-0 w-full h-full object-contain object-center mix-blend-multiply p-6 opacity-0 group-hover:opacity-100 transition-all duration-700 scale-105 group-hover:scale-100"
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
                   <div className="absolute top-2 left-2 z-10">
                     <TradeFavoriteFolderPicker
                       productId={product.id}
                       meta={{
                         product_name: product.product_name,
                         brand_name: product.brand_name,
                         category: product.category,
                         image_url: product.image_url,
                         dimensions: product.dimensions,
                         materials: product.materials,
                       }}
                       align="start"
                       side="bottom"
                     >
                       <button
                         onClick={(e) => e.stopPropagation()}
                         className={cn(
                           "p-1.5 rounded-full transition-all",
                           isFavorited(product.id)
                             ? "bg-background/90 text-destructive shadow-md"
                             : "bg-background/70 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-background/90"
                         )}
                         aria-label={isFavorited(product.id) ? "Manage folders" : "Add to favorites"}
                       >
                         <Heart className={cn("h-3.5 w-3.5", isFavorited(product.id) && "fill-current")} />
                       </button>
                     </TradeFavoriteFolderPicker>
                   </div>

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
                    <Button variant="outline" size="sm"
                      onClick={() => handleAddToQuote(product)}
                      disabled={isAdding || product.hidden_in_trade}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-body text-[10px] uppercase tracking-wider transition-colors ${
                        isAdded
                          ? "bg-primary text-primary-foreground"
                          : "bg-foreground text-background hover:bg-foreground/90"
                      } disabled:opacity-60`}
                    >
                      {isAdding ? (
                        <DotCircleLoader size="sm" />
                      ) : isAdded ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <ShoppingCart className="h-3 w-3" />
                      )}
                      {product.hidden_in_trade ? "Hidden in Trade" : isAdded ? "Added" : "Add to Quote"}
                    </Button>
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
                 <div className="flex flex-col pt-2 pb-1 text-left">
                   <div className="flex items-baseline justify-between gap-3">
                     <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-muted-foreground line-clamp-1">
                       {product.brand_name}
                     </p>
                     {renderPriceDisplay(price, "font-sans text-[10px] uppercase tracking-[0.14em] inline-flex items-start gap-1.5 flex-wrap justify-end shrink-0 text-right", product.brand_name) || (
                       <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-muted-foreground shrink-0">Price upon Request</span>
                     )}
                   </div>
                   <h3 className="mt-1.5 min-h-[2.5rem] font-display text-[14px] leading-snug text-foreground sm:text-[15px] line-clamp-2">
                     {product.product_name}
                   </h3>
                   {product.hidden_in_trade && <p className="font-body text-xs text-muted-foreground" data-trade-sensitive>Public listing · Hidden in Trade</p>}
                   {creditsDesigner(product, "Emma Donnersberg") && (
                     <p className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{product.edition}</p>
                   )}
                   {isAdmin && !product.hidden_in_trade && (
                     <div className="mt-auto flex flex-col items-start gap-1.5 pt-3">
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
                   )}
                 </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-2" data-testid="gallery-product-list">
          {sorted.map((product) => {
            const isAdding = addingProductId === product.id;
            const isAdded = addedProductIds.has(product.id);
            const price = getProductPrice(product);
            const pinned = isPinned(product.product_name, product.id);
            return (
              <div key={product.id} className="flex flex-wrap items-center gap-3 border border-border rounded-lg p-3 hover:border-foreground/20 transition-colors sm:flex-nowrap">
                <div className="w-16 h-16 rounded bg-muted/30 overflow-hidden shrink-0">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.product_name} width={160} height={200} decoding="async" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openProductSheet(product)}>
                   <h3 className="font-display text-sm text-foreground truncate hover:text-primary transition-colors">{product.product_name}</h3>
                   {product.hidden_in_trade && <p className="font-body text-xs text-muted-foreground" data-trade-sensitive>Public listing · Hidden in Trade</p>}
                   {creditsDesigner(product, "Emma Donnersberg") && (
                     <p className="font-sans text-[10px] uppercase tracking-wider text-muted-foreground">{product.edition}</p>
                   )}
                </div>
                {product.hidden_in_trade ? <span className="font-body text-xs text-muted-foreground">Price upon Request</span> : isAdmin ? (
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {renderPriceDisplay(price, "font-display text-sm inline-flex items-center gap-1.5 flex-wrap justify-end", product.brand_name)}
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
                  renderPriceDisplay(price, "font-display text-sm shrink-0 inline-flex items-center gap-1.5 flex-wrap", product.brand_name)
                )}
                <Button variant="outline" size="sm"
                  onClick={() => handleAddToQuote(product)}
                  disabled={isAdding || product.hidden_in_trade}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-body text-[10px] uppercase tracking-wider transition-colors shrink-0 ${
                    isAdded
                      ? "bg-primary text-primary-foreground"
                      : "border border-foreground text-foreground hover:bg-foreground hover:text-background"
                  } disabled:opacity-60`}
                >
                  {isAdding ? (
                    <DotCircleLoader size="sm" />
                  ) : isAdded ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <ShoppingCart className="h-3 w-3" />
                  )}
                  {product.hidden_in_trade ? "Hidden in Trade" : isAdded ? "Added" : "Add"}
                </Button>
                {product.pdf_url && (
                  <a href={buildSpecSheetUrl(product.pdf_url, product.brand_name, product.product_name)} target="_blank" rel="noopener noreferrer"
                    className="p-2 text-[hsl(var(--pdf-red))] hover:text-[hsl(var(--pdf-red))]/80 transition-colors" title="Spec sheet">
                    <FileDown className="h-4 w-4" />
                  </a>
                )}
                <TradeFavoriteFolderPicker
                  productId={product.id}
                  meta={{
                    product_name: product.product_name,
                    brand_name: product.brand_name,
                    category: product.category,
                    image_url: product.image_url,
                    dimensions: product.dimensions,
                    materials: product.materials,
                  }}
                  align="end"
                  side="top"
                >
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "p-2 rounded-full transition-all shrink-0",
                      isFavorited(product.id) ? "text-destructive" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-label={isFavorited(product.id) ? "Manage folders" : "Favorite"}
                  >
                    <Heart className={cn("h-3.5 w-3.5", isFavorited(product.id) && "fill-current")} />
                  </button>
                </TradeFavoriteFolderPicker>

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
