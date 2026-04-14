/**
 * Grid/list view of hotspot products from the gallery.
 * Extracted from the original TradeShowroom for use as a tab alongside the interactive Gallery.
 */
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, Grid3X3, List, ShoppingCart, Check, Package, FileDown, Scale, Upload, Loader2, Heart, Tag } from "lucide-react";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import CsvPriceImport from "@/components/trade/CsvPriceImport";
import InlinePriceEditor from "@/components/trade/InlinePriceEditor";
import { supabase } from "@/integrations/supabase/client";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { CATEGORY_ORDER } from "@/lib/productTaxonomy";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import TradeProductLightbox, { type TradeProductLightboxItem } from "@/components/trade/TradeProductLightbox";
import { ProductCardSkeleton } from "@/components/trade/skeletons";
import { useFavorites } from "@/hooks/useFavorites";

interface ShowroomProduct {
  id: string;
  trade_product_id?: string;
  product_name: string;
  designer_name: string | null;
  materials: string | null;
  dimensions: string | null;
  description?: string | null;
  product_image_url: string | null;
  hover_image_url?: string | null;
  link_url: string | null;
  image_identifier: string;
  category?: string | null;
  subcategory?: string | null;
  pdf_url?: string;
  trade_price_cents?: number | null;
  currency?: string;
  price_unit?: string;
  price_prefix?: string | null;
}

interface ShowroomGridViewProps {
  activeQuoteId: string | null;
  onQuoteCreated: (quote: { id: string; created_at: string }) => void;
  drawerRefreshKey: number;
  onDrawerRefreshKeyChange: (fn: (k: number) => number) => void;
  onDrawerOpen: () => void;
  highlightProductId?: string | null;
  initialDesigner?: string | null;
}

// Room → section mapping
const roomToSection: Record<string, string> = {
  "An Inviting Lounge Area": "A Sociable Environment",
  "A Sophisticated Living Room": "A Sociable Environment",
  "Panoramic Cityscape Views": "A Sociable Environment",
  "A Sun Lit Reading Corner": "A Sociable Environment",
  "A Dreamy Tuscan Landscape": "An Intimate Setting",
  "A Highly Customised Dining Room": "An Intimate Setting",
  "A Relaxed Setting": "An Intimate Setting",
  "A Colourful Nook": "An Intimate Setting",
  "A Sophisticated Boudoir": "A Personal Sanctuary",
  "A Jewelry Box Like Setting": "A Personal Sanctuary",
  "A Serene Decor": "A Personal Sanctuary",
  "A Design Treasure Trove": "A Personal Sanctuary",
  "A Masterful Suite": "A Calming Environment",
  "Design Tableau": "A Calming Environment",
  "A Venitian Cocoon": "A Calming Environment",
  "Unique By Design Vignette": "A Calming Environment",
  "An Artistic Statement": "A Small Room with Personality",
  "Compact Elegance": "A Small Room with Personality",
  "Yellow Crystalline": "A Small Room with Personality",
  "Golden Hour": "A Small Room with Personality",
  "A Workspace of Distinction": "Home Office with a View",
  "Refined Details": "Home Office with a View",
  "Light & Focus": "Home Office with a View",
  "Design & Fine Art Books Corner": "Home Office with a View",
  "Curated Vignette": "The Details Make the Design",
  "The Details Make The Design": "The Details Make the Design",
  "Light & Texture": "The Details Make the Design",
  "Craftsmanship At Every Corner": "The Details Make the Design",
};

const getSection = (imageIdentifier: string): string =>
  roomToSection[imageIdentifier] || "Other";

const inferCategory = (name: string): string => {
  const lower = name.toLowerCase();
  if (["rug", "textile", "fabric", "curtain", "throw", "cushion", "headboard"].some((kw) => lower.includes(kw))) return "Rugs";
  if (["chair", "armchair", "sofa", "loveseat", "stool", "bench", "ottoman", "lounge chair", "daybed"].some((kw) => lower.includes(kw))) return "Seating";
  if (["table", "desk", "coffee table", "side table", "console"].some((kw) => lower.includes(kw))) return "Tables";
  if (["lamp", "light", "pendant", "chandelier", "sconce"].some((kw) => lower.includes(kw))) return "Lighting";
  if (["bookcase", "credenza", "cabinet", "sideboard"].some((kw) => lower.includes(kw))) return "Storage";
  return "Décor";
};

type PriceMatch = { name: string; cents: number; rrp_cents?: number; currency: string; price_unit?: string };

const TRADE_DISCOUNT = 0.08;

const normalizeProductName = (value: string): string =>
  value.toLowerCase().replace(/['']/g, "").replace(/&/g, " and ").replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9\s]/g, " ").replace(/\b(custom|details?|edition|ed|piece|volume|the|and|of|in)\b/g, " ").replace(/\s+/g, " ").trim();

const tokenizeProductName = (value: string): string[] =>
  normalizeProductName(value).split(" ").filter((token) => token.length > 2);

const findBestPriceMatch = (
  productName: string,
  exactLookup: Map<string, PriceMatch>,
  priceEntries: PriceMatch[],
): PriceMatch | undefined => {
  const direct = exactLookup.get(productName.trim().toLowerCase());
  if (direct) return direct;
  const targetNorm = normalizeProductName(productName);
  if (!targetNorm) return undefined;
  const normalized = exactLookup.get(targetNorm);
  if (normalized) return normalized;
  const targetTokens = new Set(tokenizeProductName(productName));
  let best: PriceMatch | undefined;
  let bestScore = 0;
  for (const entry of priceEntries) {
    const candidateNorm = normalizeProductName(entry.name);
    if (!candidateNorm) continue;
    if (candidateNorm.includes(targetNorm) || targetNorm.includes(candidateNorm)) {
      const score = Math.min(candidateNorm.length, targetNorm.length) / Math.max(candidateNorm.length, targetNorm.length);
      if (score > bestScore) { best = entry; bestScore = score; }
      continue;
    }
    const candidateTokens = tokenizeProductName(entry.name);
    if (!candidateTokens.length || !targetTokens.size) continue;
    let overlap = 0;
    for (const token of candidateTokens) { if (targetTokens.has(token)) overlap++; }
    const shorter = Math.min(candidateTokens.length, targetTokens.size);
    const score = shorter > 0 ? overlap / shorter : 0;
    if (score > bestScore && score > 0.5) { best = entry; bestScore = score; }
  }
  return best;
};

const ShowroomGridView = ({
  activeQuoteId,
  onQuoteCreated,
  onDrawerRefreshKeyChange,
  onDrawerOpen,
  highlightProductId,
  initialDesigner,
}: ShowroomGridViewProps) => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();

  const [products, setProducts] = useState<ShowroomProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDesigner, setSelectedDesigner] = useState(initialDesigner || "all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSection, setSelectedSection] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("original");
  const [showTradePrice, setShowTradePrice] = useState(false);
  const fxRates = useFxRates();
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());
  const [lightboxProduct, setLightboxProduct] = useState<TradeProductLightboxItem | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(highlightProductId || null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const getDisplayPrice = (price: { cents: number; currency: string; price_unit?: string } | null) => {
    if (!price) return null;
    return showTradePrice ? { ...price, cents: Math.round(price.cents * (1 - TRADE_DISCOUNT)) } : price;
  };

  const renderPriceDisplay = (
    price: { cents: number; currency: string; price_unit?: string } | null,
    className: string,
    pricePrefix?: string | null,
  ) => {
    if (!price) return null;

    const tradePrice = Math.round(price.cents * (1 - TRADE_DISCOUNT));
    const pfx = pricePrefix ? `${pricePrefix} ` : '';

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

  // Scroll to highlighted product once loaded
  useEffect(() => {
    if (!loading && highlightedId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      const timer = setTimeout(() => setHighlightedId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [loading, highlightedId]);

  // Fetch hotspot products
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("gallery_hotspots")
        .select("id, product_name, designer_name, materials, dimensions, product_image_url, link_url, image_identifier")
        .order("designer_name", { ascending: true });

      if (data) {
        const tradeProducts = getAllTradeProducts();
        const pdfLookup = new Map<string, string>();
        const metadataLookup = new Map<string, { materials?: string; dimensions?: string; description?: string; brand?: string; image_url?: string | null; category?: string; subcategory?: string }>();
        const tradeProductIdLookup = new Map<string, string>();
        for (const tp of tradeProducts) {
          const tpKey = tp.product_name.trim().toLowerCase();
          const metaEntry = { materials: tp.materials, dimensions: tp.dimensions, description: tp.description, brand: tp.brand_name, image_url: tp.image_url, category: tp.category, subcategory: tp.subcategory };
          if (tp.pdf_url) pdfLookup.set(tpKey, tp.pdf_url);
          metadataLookup.set(tpKey, metaEntry);
          tradeProductIdLookup.set(tpKey, tp.id);
          if (tp.subtitle) {
            const comboKey = `${tpKey} ${tp.subtitle.trim().toLowerCase()}`;
            metadataLookup.set(comboKey, metaEntry);
            tradeProductIdLookup.set(comboKey, tp.id);
            if (tp.pdf_url) pdfLookup.set(comboKey, tp.pdf_url);
          }
        }

        const { data: pricedProducts } = await supabase
          .from("trade_products")
          .select("id, product_name, description, trade_price_cents, rrp_price_cents, currency, gallery_images, price_unit")
          .eq("is_active", true);

        // Fetch descriptions from curator picks
        const { data: curatorDescriptions } = await supabase
          .from("designer_curator_picks")
          .select("title, description")
          .not("description", "is", null);

        const descriptionLookup = new Map<string, string>();
        const descriptionEntries: { key: string; desc: string }[] = [];
        if (curatorDescriptions) {
          for (const cd of curatorDescriptions) {
            if (cd.description?.trim()) {
              const k = cd.title.trim().toLowerCase();
              descriptionLookup.set(k, cd.description.trim());
              descriptionEntries.push({ key: k, desc: cd.description.trim() });
            }
          }
        }
        // Fuzzy description lookup: find best match when exact key misses
        const findDescription = (name: string): string | undefined => {
          const k = name.trim().toLowerCase();
          const exact = descriptionLookup.get(k);
          if (exact) return exact;
          // Check if any curator pick title is contained in the product name or vice-versa
          for (const entry of descriptionEntries) {
            if (k.includes(entry.key) || entry.key.includes(k)) return entry.desc;
          }
          return undefined;
        };

        const priceLookup = new Map<string, PriceMatch>();
        const priceEntries: PriceMatch[] = [];
        const dbProductIdLookup = new Map<string, string>();
        const hoverImageLookup = new Map<string, string>();
        if (pricedProducts) {
          for (const pp of pricedProducts) {
            const ppKey = pp.product_name.trim().toLowerCase();
            dbProductIdLookup.set(ppKey, pp.id);
            const normalizedName = normalizeProductName(pp.product_name);
            if (normalizedName) dbProductIdLookup.set(normalizedName, pp.id);
            // Build hover image lookup from gallery_images
            const gallery = pp.gallery_images as string[] | null;
            if (gallery && gallery.length > 0) {
              hoverImageLookup.set(ppKey, gallery[0]);
              if (normalizedName) hoverImageLookup.set(normalizedName, gallery[0]);
            }
            // Add trade_products descriptions to lookup
            if ((pp as any).description?.trim()) {
              descriptionLookup.set(ppKey, (pp as any).description.trim());
            }
            const rrp = pp.rrp_price_cents ?? pp.trade_price_cents;
            if (!rrp) continue;
            const entry: PriceMatch = { name: pp.product_name, cents: rrp, rrp_cents: pp.rrp_price_cents ?? undefined, currency: pp.currency, price_unit: pp.price_unit };
            priceEntries.push(entry);
            priceLookup.set(ppKey, entry);
            if (normalizedName) priceLookup.set(normalizedName, entry);
          }
        }

        const seenByName = new Map<string, ShowroomProduct>();
        const seenImageUrls = new Map<string, string>();
        for (const item of data as ShowroomProduct[]) {
          const key = item.product_name.trim().toLowerCase();
          const existing = seenByName.get(key);
          if (item.product_image_url && seenImageUrls.has(item.product_image_url) && !existing) {
            const existingKey = seenImageUrls.get(item.product_image_url)!;
            const existingItem = seenByName.get(existingKey);
            if (existingItem) {
              const price = findBestPriceMatch(item.product_name, priceLookup, priceEntries);
              const pdf = pdfLookup.get(key);
              if (price && !existingItem.trade_price_cents) { existingItem.trade_price_cents = price.cents; existingItem.currency = price.currency; existingItem.price_unit = price.price_unit; }
              if (pdf && !existingItem.pdf_url) existingItem.pdf_url = pdf;
            }
            continue;
          }
          if (!existing || (!existing.product_image_url && item.product_image_url) || (!existing.materials && item.materials) || (!existing.dimensions && item.dimensions)) {
            const price = findBestPriceMatch(item.product_name, priceLookup, priceEntries);
            const meta = metadataLookup.get(key);
            seenByName.set(key, {
              ...item,
              trade_product_id: dbProductIdLookup.get(key) || tradeProductIdLookup.get(key),
              materials: meta?.materials || item.materials,
              dimensions: meta?.dimensions || item.dimensions,
              description: findDescription(item.product_name) || meta?.description || null,
              designer_name: meta?.brand || item.designer_name,
              product_image_url: meta?.image_url || item.product_image_url || null,
              hover_image_url: hoverImageLookup.get(key) || hoverImageLookup.get(normalizeProductName(item.product_name)) || null,
              category: meta?.category || inferCategory(item.product_name),
              subcategory: meta?.subcategory || null,
              pdf_url: pdfLookup.get(key),
              trade_price_cents: price?.cents ?? null,
              currency: price?.currency,
              price_unit: price?.price_unit,
            });
            if (item.product_image_url) seenImageUrls.set(item.product_image_url, key);
          }
        }
        setProducts([...seenByName.values()]);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  const designers = useMemo(() => [...new Set(products.map((p) => p.designer_name).filter(Boolean) as string[])].sort(), [products]);
  const categories = useMemo(() => CATEGORY_ORDER.filter((cat) => products.some((p) => p.category === cat)), [products]);
  const sections = useMemo(() => {
    const sectionSet = new Set(products.map((p) => getSection(p.image_identifier)));
    return [...sectionSet].sort();
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || p.product_name.toLowerCase().includes(q) || p.designer_name?.toLowerCase().includes(q) || p.materials?.toLowerCase().includes(q);
      const matchesDesigner = selectedDesigner === "all" || p.designer_name === selectedDesigner;
      const matchesCategory = selectedCategory === "all" || p.category === selectedCategory;
      const matchesSection = selectedSection === "all" || getSection(p.image_identifier) === selectedSection;
      return matchesSearch && matchesDesigner && matchesCategory && matchesSection;
    });
  }, [products, search, selectedDesigner, selectedCategory, selectedSection]);

  const addProductToQuote = useCallback(async (product: ShowroomProduct, quoteId: string) => {
    if (!user) return;
    setAddingProductId(product.id);
    const { error } = await supabase.rpc("add_gallery_product_to_quote", {
      _user_id: user.id,
      _quote_id: quoteId,
      _product_name: product.product_name,
      _brand_name: product.designer_name || "Unknown",
      _category: "",
      _image_url: product.product_image_url || null,
      _dimensions: product.dimensions || null,
      _materials: product.materials || null,
      _quantity: 1,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setAddedProductIds((prev) => new Set(prev).add(product.id));
      onDrawerRefreshKeyChange((k) => k + 1);
      onDrawerOpen();
      toast({ title: "Added to quote", description: `${product.product_name} added to QU-${quoteId.slice(0, 6).toUpperCase()}` });
    }
    setAddingProductId(null);
  }, [user, toast, onDrawerRefreshKeyChange, onDrawerOpen]);

  const handleAddToQuote = useCallback(async (product: ShowroomProduct) => {
    if (!user) return;
    if (activeQuoteId) {
      await addProductToQuote(product, activeQuoteId);
    } else {
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
      onQuoteCreated(data as { id: string; created_at: string });
      await addProductToQuote(product, data.id);
    }
  }, [user, activeQuoteId, addProductToQuote, onQuoteCreated, toast]);

  const toCompareItem = (product: ShowroomProduct): CompareItem => ({
    pick: {
      title: product.product_name,
      image: product.product_image_url || "",
      materials: product.materials,
      dimensions: product.dimensions,
      category: product.category || inferCategory(product.product_name),
      subcategory: product.subcategory || undefined,
    },
    designerName: product.designer_name?.includes(" - ") ? product.designer_name.split(" - ")[0].trim() : (product.designer_name || "Unknown"),
    designerId: product.id,
    section: "designers",
    price: (() => {
      const raw = product.trade_price_cents;
      if (!raw || !product.currency) return null;
      const price = getDisplayPrice({ cents: raw, currency: product.currency, price_unit: product.price_unit });
      return price ? formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates, price.price_unit) : null;
    })(),
  });

  const toLightboxItem = (product: ShowroomProduct): TradeProductLightboxItem => ({
    id: product.id,
    product_name: product.product_name,
    image_url: product.product_image_url,
    brand_name: product.designer_name || "Unknown",
    materials: product.materials,
    dimensions: product.dimensions,
    description: product.description,
    category: product.category || inferCategory(product.product_name),
    subcategory: product.subcategory || undefined,
    pdf_url: product.pdf_url,
    price: (() => {
      const raw = product.trade_price_cents;
      if (!raw || !product.currency) return null;
      const price = getDisplayPrice({ cents: raw, currency: product.currency, price_unit: product.price_unit });
      return price ? formatPriceConverted(price.cents, price.currency, displayCurrency, fxRates, price.price_unit) : null;
    })(),
  });

  const handleLightboxAddToQuote = (item: TradeProductLightboxItem) => {
    const product = products.find((p) => p.id === item.id);
    if (product) handleAddToQuote(product);
  };

  const inputClass =
    "px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <CsvPriceImport onComplete={() => window.location.reload()} />
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
      <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 mb-6">
        <div className="relative flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products, designers, materials…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full text-[16px] sm:text-sm`}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={selectedDesigner} onChange={(e) => setSelectedDesigner(e.target.value)} className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}>
            <option value="all">All Designers ({designers.length})</option>
            {designers.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className={`${inputClass} flex-1 sm:flex-none text-[16px] sm:text-sm`}>
            <option value="all">All Rooms</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
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

      {/* Results count */}
      <p className="font-body text-xs text-muted-foreground mb-4">
        {filtered.length} {filtered.length === 1 ? "product" : "products"}
        {selectedDesigner !== "all" ? ` by ${selectedDesigner}` : ""}
        {selectedSection !== "all" ? ` in ${selectedSection}` : ""}
      </p>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-16 text-center">
          <p className="font-body text-sm text-muted-foreground">No products match your search criteria.</p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((product) => {
            const isAdding = addingProductId === product.id;
            const isAdded = addedProductIds.has(product.id);
            const pinned = isPinned(product.product_name, product.id);
            const isHighlighted = !!(highlightedId && product.trade_product_id === highlightedId);
            const rawCents = product.trade_price_cents;
            const price = rawCents && product.currency
              ? { cents: rawCents, currency: product.currency, price_unit: product.price_unit }
              : null;
            return (
              <div
                key={product.id}
                ref={isHighlighted ? highlightRef : undefined}
                className={cn(
                  "group border rounded-lg overflow-visible transition-all",
                  isHighlighted
                    ? "border-primary ring-2 ring-primary/30 shadow-md"
                    : "border-border hover:border-foreground/20"
                )}
              >
                <div className="aspect-square bg-muted/30 relative overflow-visible cursor-pointer" onClick={() => setLightboxProduct(toLightboxItem(product))}>
                  {product.product_image_url ? (
                    <>
                      <img src={product.product_image_url} alt={product.product_name} className={cn("w-full h-full object-cover transition-opacity duration-500", product.hover_image_url ? "group-hover:opacity-0" : "")} loading="lazy" />
                      {product.hover_image_url && (
                        <img src={product.hover_image_url} alt={`${product.product_name} - in context`} className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500" loading="lazy" />
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(toCompareItem(product)); }}
                    className={cn(
                      "absolute top-2 right-2 z-10 p-1.5 rounded-full transition-all",
                      pinned ? "bg-[hsl(var(--gold))] text-foreground shadow-md" : "bg-background/70 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-background/90",
                      compareItems.length >= 3 && !pinned && "pointer-events-none"
                    )}
                    aria-label={pinned ? "Remove from selection" : "Pin to selection"}
                  >
                    <Scale className="h-3.5 w-3.5" />
                  </button>
                  {product.trade_product_id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(product.trade_product_id!); }}
                      className={cn(
                        "absolute top-2 left-2 z-10 p-1.5 rounded-full transition-all border",
                        isFavorited(product.trade_product_id) ? "bg-destructive text-destructive-foreground shadow-md border-destructive" : "bg-background/80 text-foreground/60 border-border/50 shadow-sm opacity-0 group-hover:opacity-100 hover:bg-background hover:text-foreground",
                      )}
                      aria-label={isFavorited(product.trade_product_id) ? "Remove from favorites" : "Save to favorites"}
                    >
                      <Heart className={cn("h-3.5 w-3.5", isFavorited(product.trade_product_id) && "fill-current")} />
                    </button>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAddToQuote(product); }}
                      disabled={isAdding}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md font-body text-[10px] uppercase tracking-wider transition-colors ${
                        isAdded ? "bg-emerald-600 text-white" : "bg-foreground text-background hover:bg-foreground/90"
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
                        href={buildSpecSheetUrl(product.pdf_url, product.designer_name || product.product_name, product.product_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-[hsl(var(--pdf-red))]/80 rounded-md text-white hover:bg-[hsl(var(--pdf-red))] transition-colors"
                        title="Download spec sheet"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </a>
                    )}
                   {product.description && (
                     <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-card border border-border rounded-lg shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-40">
                       <p className="font-body text-[11px] text-foreground leading-relaxed line-clamp-4">{product.description}</p>
                       <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-card border-r border-b border-border rotate-45 -mt-1" />
                     </div>
                   )}
                  </div>
                </div>
                <div className="p-3 text-center relative">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                    {product.designer_name?.includes(" - ") ? product.designer_name.split(" - ")[0].trim() : product.designer_name}
                  </p>
                  <h3 className="font-display text-sm text-foreground leading-tight mb-0.5 truncate">{product.product_name}</h3>
                  {product.dimensions && <p className="font-body text-[10px] text-muted-foreground mt-1 truncate">{product.dimensions}</p>}
                  {product.materials && <p className="font-body text-[10px] text-muted-foreground truncate">{product.materials}</p>}
                  {isAdmin ? (
                    <div className="mt-1 flex flex-col items-center gap-1.5">
                      {renderPriceDisplay(price, "font-display text-sm inline-flex items-center justify-center gap-1.5 flex-wrap", product.price_prefix)}
                      <InlinePriceEditor
                        productName={product.product_name}
                        brandName={product.designer_name?.includes(" - ") ? product.designer_name.split(" - ")[0].trim() : (product.designer_name || "")}
                        currentPriceCents={price?.cents}
                        currency={price?.currency || "SGD"}
                        priceUnit={price?.price_unit}
                        displayCurrency={displayCurrency}
                        fxRates={fxRates}
                        onPriceUpdated={() => window.location.reload()}
                      />
                    </div>
                  ) : (
                    renderPriceDisplay(price, "font-display text-sm mt-1 inline-flex items-center justify-center gap-1.5 flex-wrap", product.price_prefix)
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
            const pinned = isPinned(product.product_name, product.id);
            const rawCents = product.trade_price_cents;
            const price = rawCents && product.currency
              ? { cents: rawCents, currency: product.currency, price_unit: product.price_unit }
              : null;
            return (
              <div key={product.id} className="flex items-center gap-4 border border-border rounded-lg p-3 hover:border-foreground/20 transition-colors">
                <div className="w-16 h-16 rounded bg-muted/30 overflow-hidden shrink-0 cursor-pointer" onClick={() => setLightboxProduct(toLightboxItem(product))}>
                  {product.product_image_url ? (
                    <img src={product.product_image_url} alt={product.product_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">
                    {product.designer_name?.includes(" - ") ? product.designer_name.split(" - ")[0].trim() : product.designer_name}
                  </p>
                  <h3 className="font-display text-sm text-foreground truncate">{product.product_name}</h3>
                  <p className="font-body text-[10px] text-muted-foreground truncate">
                    {[product.dimensions, product.materials].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {isAdmin ? (
                  <div className="shrink-0 flex flex-col items-end gap-1.5">
                    {renderPriceDisplay(price, "font-display text-sm inline-flex items-center gap-1.5 flex-wrap justify-end", product.price_prefix)}
                    <InlinePriceEditor
                      productName={product.product_name}
                      brandName={product.designer_name?.includes(" - ") ? product.designer_name.split(" - ")[0].trim() : (product.designer_name || "")}
                      currentPriceCents={price?.cents}
                      currency={price?.currency || "SGD"}
                      priceUnit={price?.price_unit}
                      displayCurrency={displayCurrency}
                      fxRates={fxRates}
                      onPriceUpdated={() => window.location.reload()}
                    />
                  </div>
                ) : (
                  renderPriceDisplay(price, "font-display text-sm shrink-0 inline-flex items-center gap-1.5 flex-wrap", product.price_prefix)
                )}
                <button
                  onClick={() => handleAddToQuote(product)}
                  disabled={isAdding}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md font-body text-[10px] uppercase tracking-wider transition-colors shrink-0 ${
                    isAdded ? "bg-emerald-600 text-white" : "border border-foreground text-foreground hover:bg-foreground hover:text-background"
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
                  <a href={buildSpecSheetUrl(product.pdf_url, product.designer_name || product.product_name, product.product_name)} target="_blank" rel="noopener noreferrer"
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

export default ShowroomGridView;
