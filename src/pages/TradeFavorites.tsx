import { useState, useEffect, useCallback, useRef } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Helmet } from "react-helmet-async";
import { Heart, Trash2, ShoppingCart, Search, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type DisplayCurrency, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";

const CURRENCY_OPTIONS: DisplayCurrency[] = ["original", "SGD", "EUR", "USD", "GBP", "CHF", "AED", "HKD", "AUD"];
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import TradeProductLightbox, { type TradeProductLightboxItem } from "@/components/trade/TradeProductLightbox";
import { cn } from "@/lib/utils";
import { prefillLineShippingFromCatalog } from "@/lib/prefillLineShipping";
import { TRADE_FAVORITE_FOLDERS_EVENT } from "@/components/trade/TradeFavoriteFolderPicker";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { dimensionBadgeLabel } from "@/lib/productDimensions";

interface FavoritedProduct {
  favoriteId: string;
  productId: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  sku: string | null;
  category: string;
  subcategory: string | null;
  materials: string | null;
  materials_description: string | null;
  dimensions: string | null;
  width_mm: number | null;
  depth_mm: number | null;
  height_mm: number | null;
  size_variants: Array<{ label?: string | null; base?: string | null; top?: string | null }> | null;
  lead_time: string | null;
  origin: string | null;
  trade_price_cents: number | null;
  rrp_price_cents: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
}

interface FolderItem {
  id: string;
  name: string;
  count: number;
}

export default function TradeFavorites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [favorites, setFavorites] = useState<FavoritedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [favoritesViewMode, setFavoritesViewMode] = useState<"grid" | "list">("grid");
  const [currency, setCurrency] = useTradeDisplayCurrency();
  const { showTradePrice } = useTradePriceMode();
  const rates = useFxRates();
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedFor3D, setSelectedFor3D] = useState<Set<string>>(new Set());
  const [lightboxProduct, setLightboxProduct] = useState<TradeProductLightboxItem | null>(null);
  const [addingToQuote, setAddingToQuote] = useState(false);
  const [addedToQuote, setAddedToQuote] = useState(false);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(() => searchParams.get("folder"));
  const [folderAssignments, setFolderAssignments] = useState<Record<string, string[]>>({});

  const displayPriceCents = (fav: FavoritedProduct) =>
    showTradePrice ? fav.trade_price_cents : fav.rrp_price_cents;

  const favToLightboxItem = (fav: FavoritedProduct): TradeProductLightboxItem => ({
    id: fav.productId,
    product_name: fav.product_name,
    image_url: fav.image_url,
    brand_name: fav.brand_name,
    materials: fav.materials,
    materials_description: fav.materials_description,
    dimensions: fav.dimensions,
    lead_time: fav.lead_time,
    origin: fav.origin,
    category: fav.category || undefined,
    subcategory: fav.subcategory || undefined,
    price: displayPriceCents(fav)
      ? formatPriceConverted(displayPriceCents(fav) as number, fav.currency, currency, rates)
      : undefined,
  });

  const handleLightboxAddToQuote = useCallback(async (product: TradeProductLightboxItem) => {
    if (!user) return;
    setAddingToQuote(true);
    try {
      let { data: drafts } = await supabase
        .from("trade_quotes")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1);

      let quoteId: string;
      if (drafts && drafts.length > 0) {
        quoteId = drafts[0].id;
      } else {
        const { data: newQuote, error } = await supabase
          .from("trade_quotes")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (error || !newQuote) throw error || new Error("Failed");
        quoteId = newQuote.id;
      }

      const { data: inserted } = await supabase.from("trade_quote_items").insert({
        quote_id: quoteId,
        product_id: product.id,
        quantity: 1,
      }).select("id");
      const insertedIds = (inserted || []).map((r: any) => r.id);
      await prefillLineShippingFromCatalog(insertedIds);

      setAddedToQuote(true);
      toast({ title: "Added to quote", description: product.product_name });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingToQuote(false);
    }
  }, [user, toast]);

  const fetchFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("trade_favorites")
        .select("id, product_id, notes, created_at, trade_products(product_name, brand_name, image_url, sku, category, subcategory, materials, materials_description, dimensions, width_mm, depth_mm, height_mm, size_variants, lead_time, origin, trade_price_cents, rrp_price_cents, currency)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: FavoritedProduct[] = (data || []).map((f: any) => ({
        favoriteId: f.id,
        productId: f.product_id,
        product_name: f.trade_products?.product_name || "Unknown",
        brand_name: f.trade_products?.brand_name || "Unknown",
        image_url: f.trade_products?.image_url,
        sku: f.trade_products?.sku,
        category: f.trade_products?.category || "",
        subcategory: f.trade_products?.subcategory,
        materials: f.trade_products?.materials,
        materials_description: f.trade_products?.materials_description,
        dimensions: f.trade_products?.dimensions,
        width_mm: f.trade_products?.width_mm,
        depth_mm: f.trade_products?.depth_mm,
        height_mm: f.trade_products?.height_mm,
        size_variants: f.trade_products?.size_variants,
        lead_time: f.trade_products?.lead_time,
        origin: f.trade_products?.origin,
        trade_price_cents: f.trade_products?.trade_price_cents,
        rrp_price_cents: f.trade_products?.rrp_price_cents,
        currency: f.trade_products?.currency || "SGD",
        notes: f.notes,
        created_at: f.created_at,
      }));
      setFavorites(mapped);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchFolders = useCallback(async () => {
    if (!user) return;
    try {
      const { data: fdata } = await supabase
        .from("favorite_folders")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      const folderList = (fdata || []) as { id: string; name: string }[];

      // Load all assignments for this user to build a map of favoriteId -> folderIds
      const { data: items } = await supabase
        .from("favorite_folder_items")
        .select("folder_id, favorite_id")
        .in("folder_id", folderList.map((f) => f.id));
      const assignments: Record<string, string[]> = {};
      (items || []).forEach((i: any) => {
        if (!assignments[i.favorite_id]) assignments[i.favorite_id] = [];
        assignments[i.favorite_id].push(i.folder_id);
      });
      setFolderAssignments(assignments);

      // Count items per folder
      const counts = new Map<string, number>();
      (items || []).forEach((i: any) => {
        counts.set(i.folder_id, (counts.get(i.folder_id) || 0) + 1);
      });

      setFolders(
        folderList.map((f) => ({
          id: f.id,
          name: f.name,
          count: counts.get(f.id) || 0,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch folders", err);
    }
  }, [user]);

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);
  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  useEffect(() => {
    const handler = () => { fetchFolders(); fetchFavorites(); };
    window.addEventListener(TRADE_FAVORITE_FOLDERS_EVENT, handler);
    return () => window.removeEventListener(TRADE_FAVORITE_FOLDERS_EVENT, handler);
  }, [fetchFolders, fetchFavorites]);

  // Sync folder + search to URL query params (replace, no scroll reset)
  const lastQsRef = useRef("");
  useEffect(() => {
    const next = new URLSearchParams();
    if (activeFolder) next.set("folder", activeFolder);
    if (search.trim()) next.set("search", search.trim());
    const qs = next.toString();
    if (qs === lastQsRef.current) return;
    lastQsRef.current = qs;
    navigate(
      { pathname: location.pathname, search: qs ? `?${qs}` : "" },
      { replace: true, preventScrollReset: true }
    );
  }, [activeFolder, search, navigate, location.pathname]);

  const removeFavorite = useCallback(async (favoriteId: string) => {
    setRemoving(favoriteId);
    try {
      const { error } = await supabase.from("trade_favorites").delete().eq("id", favoriteId);
      if (error) throw error;
      setFavorites((prev) => prev.filter((f) => f.favoriteId !== favoriteId));
      toast({ title: "Removed from favorites" });
    } catch (err: any) {
      toast({ title: "Error removing", description: err.message, variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  }, [toast]);

  const addAllToQuote = useCallback(async () => {
    if (!user || favorites.length === 0) return;
    try {
      // Find or create a draft quote
      let { data: drafts } = await supabase
        .from("trade_quotes")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1);

      let quoteId: string;
      if (drafts && drafts.length > 0) {
        quoteId = drafts[0].id;
      } else {
        const { data: newQuote, error } = await supabase
          .from("trade_quotes")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (error || !newQuote) throw error || new Error("Failed to create quote");
        quoteId = newQuote.id;
      }

      // Add each favorited product
      let added = 0;
      const insertedIds: string[] = [];
      for (const fav of favorites) {
        const { data: ins, error } = await supabase.from("trade_quote_items").insert({
          quote_id: quoteId,
          product_id: fav.productId,
          quantity: 1,
        }).select("id");
        if (!error) {
          added++;
          (ins || []).forEach((r: any) => insertedIds.push(r.id));
        }
      }
      await prefillLineShippingFromCatalog(insertedIds);

      toast({ title: `${added} products added to quote`, description: `Quote QU-${quoteId.slice(0, 6).toUpperCase()}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }, [user, favorites, toast]);

  const toggle3D = useCallback((productId: string) => {
    setSelectedFor3D((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId); else next.add(productId);
      return next;
    });
  }, []);

  const sendTo3DStudio = useCallback(() => {
    if (selectedFor3D.size === 0) return;
    const ids = Array.from(selectedFor3D).join(",");
    navigate(`/trade/axonometric-requests?favorites=${ids}`);
  }, [selectedFor3D, navigate]);

  const filtered = (() => {
    let result = favorites;
    if (activeFolder) {
      result = result.filter((f) => (folderAssignments[f.favoriteId] ?? []).includes(activeFolder));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((f) =>
        f.product_name.toLowerCase().includes(q) ||
        f.brand_name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    }
    return result;
  })();

  return (
    <>
      <Helmet>
        <title>Favorites — Maison Affluency Trade</title>
      </Helmet>

      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display font-light text-2xl text-foreground tracking-tight">Saved Products</h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-3">
                YOUR CURATED SHORTLIST // SOURCED PIECES ACROSS ALL PORTFOLIOS
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-[calc(100dvh-13rem)] bg-muted/20">
      <div className="max-w-6xl mx-auto px-6 py-8 md:px-8 md:py-10 space-y-8">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-x-7 gap-y-5 border-b border-border pb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search favorites…"
              className="pl-9 font-body text-xs"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {CURRENCY_OPTIONS.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={cn(
                  "font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors",
                  currency === c && "text-foreground underline underline-offset-[6px] decoration-foreground"
                )}
              >
                {c === "original" ? "Original" : c}
              </button>
            ))}
          </div>
          <span className="hidden h-4 w-px bg-border lg:block" aria-hidden="true" />
          <div className="flex items-center gap-5" role="group" aria-label="Favorites layout">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFavoritesViewMode("grid")}
              aria-pressed={favoritesViewMode === "grid"}
              className={cn(
                "h-auto rounded-none px-0 py-1 font-mono text-[10px] font-normal uppercase tracking-[0.15em] hover:bg-transparent",
                favoritesViewMode === "grid"
                  ? "font-medium text-foreground underline decoration-foreground underline-offset-[6px]"
                  : "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              [ ▦ Editorial Grid ]
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setFavoritesViewMode("list")}
              aria-pressed={favoritesViewMode === "list"}
              className={cn(
                "h-auto rounded-none px-0 py-1 font-mono text-[10px] font-normal uppercase tracking-[0.15em] hover:bg-transparent",
                favoritesViewMode === "list"
                  ? "font-medium text-foreground underline decoration-foreground underline-offset-[6px]"
                  : "text-muted-foreground/60 hover:text-foreground"
              )}
            >
              [ ☰ Technical List ]
            </Button>
          </div>
          {favorites.length > 0 && (
            <Button variant="outline" size="sm" onClick={addAllToQuote} className="gap-1.5">
              <ShoppingCart className="w-3.5 h-3.5" />
              Add All to Quote
            </Button>
          )}
          {selectedFor3D.size > 0 && (
            <Button size="sm" onClick={sendTo3DStudio} className="gap-1.5 bg-[hsl(var(--gold))] text-white hover:bg-[hsl(var(--gold))]/90">
              <Wand2 className="w-3.5 h-3.5" />
              Send {selectedFor3D.size} to 3D Studio
            </Button>
          )}
        </div>

        {/* Folder tabs (Artemest-style) */}
        {(folders.length > 0 || favorites.length > 0) && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveFolder(null)}
              className={cn(
                "px-3 py-1.5 rounded-full font-body text-[11px] uppercase tracking-[0.12em] border transition-colors",
                activeFolder === null
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              )}
            >
              All ({favorites.length})
            </button>
            {folders.map((f) => {
              const active = activeFolder === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFolder(f.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full font-body text-[11px] uppercase tracking-[0.12em] border transition-colors",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                  )}
                >
                  {f.name} ({f.count})
                </button>
              );
            })}
          </div>
        )}

        {/* Content */}
        {loading ? (
          favoritesViewMode === "grid" ? <div className="columns-1 gap-8 sm:columns-2 lg:columns-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={cn("mb-10 w-full animate-pulse bg-muted", i % 3 === 1 ? "aspect-[4/5]" : "aspect-[5/4]")} />
            ))}
          </div> : <div className="border-t border-border">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse border-b border-border bg-muted/40" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[44vh] items-center justify-center px-6 text-center">
            <div>
            <p className="font-display font-light text-base text-foreground">
              {search ? "No matches found in your archive." : activeFolder ? "This folder is currently empty." : "The archive is currently empty."}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
              {search
                ? "TRY A DIFFERENT SEARCH TERM OR CLEAR FILTERS TO EXPLORE THE FULL ARCHIVE."
                : activeFolder
                ? "SAVE PIECES TO THIS FOLDER USING THE HEART ICON AS YOU BROWSE THE CATALOGUE."
                : "BROWSE THE CATALOGUE OR CONSULT THE AI CURATORIAL GUIDE TO BEGIN SHORTLISTING ARCHITECTURAL PIECES FOR YOUR ACTIVE WORKSPACES."}
            </p>
            {!search && !activeFolder && (
              <button
                onClick={() => navigate("/trade/archive")}
                className="mt-8 font-mono text-[10px] uppercase tracking-[0.15em] text-foreground hover:text-muted-foreground transition-colors"
              >
                [ BROWSE SHOWROOM COLLECTION → ]
              </button>
            )}
            </div>
          </div>
        ) : favoritesViewMode === "grid" ? (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((fav) => (
              <article
                key={fav.favoriteId}
                className="group flex flex-col cursor-pointer"
                onClick={() => { setAddedToQuote(false); setLightboxProduct(favToLightboxItem(fav)); }}
              >
                <div className={cn(
                  "relative aspect-[4/5] w-full overflow-hidden bg-background",
                  selectedFor3D.has(fav.productId) && "outline outline-1 outline-foreground outline-offset-4"
                )}>
                  {fav.image_url ? (
                    <img src={fav.image_url} alt={fav.product_name} className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.015]" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <Heart className="w-8 h-8" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle3D(fav.productId); }}
                    className={cn(
                       "absolute left-3 top-3 flex h-8 w-8 items-center justify-center bg-background/90 backdrop-blur-sm transition-all",
                      selectedFor3D.has(fav.productId)
                         ? "text-foreground"
                         : "text-muted-foreground opacity-0 group-hover:opacity-100 focus:opacity-100"
                    )}
                    title="Select for 3D Studio"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFavorite(fav.favoriteId); }}
                    disabled={removing === fav.favoriteId}
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center bg-background/90 text-muted-foreground opacity-0 backdrop-blur-sm transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  >
                    {removing === fav.favoriteId ? <DotCircleLoader size="sm" className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="space-y-1.5 pt-4 text-center">
                  <p className="font-display text-[15px] font-light leading-snug text-foreground">{fav.product_name}</p>
                  <p className="font-display text-xs font-light text-muted-foreground">{fav.brand_name}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <div className="min-w-[980px]">
            <div className="grid grid-cols-[40px_minmax(100px,0.75fr)_minmax(170px,1.45fr)_minmax(140px,1.1fr)_minmax(155px,1fr)_minmax(110px,0.8fr)_minmax(105px,0.8fr)_28px] items-center gap-x-5 border-y border-border py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              <span aria-hidden="true" />
              <span>SKU / Item ID</span>
              <span>Product Name</span>
              <span>Designer / Maker</span>
              <span>Dimensions W × D × H</span>
              <span>Lead Time</span>
              <span>{showTradePrice ? "Trade Price" : "MSRP / Price"}</span>
              <span aria-hidden="true" />
            </div>
            {filtered.map((fav) => (
              <div
                key={fav.favoriteId}
                className="group grid min-h-16 grid-cols-[40px_minmax(100px,0.75fr)_minmax(170px,1.45fr)_minmax(140px,1.1fr)_minmax(155px,1fr)_minmax(110px,0.8fr)_minmax(105px,0.8fr)_28px] items-center gap-x-5 border-b border-border py-3.5 text-left cursor-pointer transition-colors hover:bg-background/60"
                onClick={() => { setAddedToQuote(false); setLightboxProduct(favToLightboxItem(fav)); }}
              >
                <div className="h-10 w-10 overflow-hidden bg-background">
                  {fav.image_url ? <img src={fav.image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Heart className="m-3 h-4 w-4 text-muted-foreground/30" />}
                </div>
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{fav.sku || fav.productId.slice(0, 8)}</span>
                <span className="font-display text-sm font-light text-foreground">{fav.product_name}</span>
                <span className="font-body text-[11px] text-muted-foreground">{fav.brand_name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">{dimensionBadgeLabel(fav)}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{fav.lead_time || "On request"}</span>
                <span className="font-mono text-[11px] text-foreground">
                  {displayPriceCents(fav)
                    ? formatPriceConverted(displayPriceCents(fav) as number, fav.currency, currency, rates)
                    : "Price upon Request"}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFavorite(fav.favoriteId); }}
                  disabled={removing === fav.favoriteId}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  {removing === fav.favoriteId ? <DotCircleLoader size="sm" className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
      </div>

      <TradeProductLightbox
        product={lightboxProduct}
        onClose={() => setLightboxProduct(null)}
        onAddToQuote={handleLightboxAddToQuote}
        isAdding={addingToQuote}
        isAdded={addedToQuote}
        onSelectRelated={(rp) => setLightboxProduct(rp)}
      />
    </>
  );
}
