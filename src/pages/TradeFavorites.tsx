import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { Heart, Trash2, ShoppingCart, Search, Grid3X3, List, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import TradeProductLightbox, { type TradeProductLightboxItem } from "@/components/trade/TradeProductLightbox";
import { cn } from "@/lib/utils";

interface FavoritedProduct {
  favoriteId: string;
  productId: string;
  product_name: string;
  brand_name: string;
  image_url: string | null;
  category: string;
  subcategory: string | null;
  materials: string | null;
  dimensions: string | null;
  trade_price_cents: number | null;
  rrp_price_cents: number | null;
  currency: string;
  notes: string | null;
  created_at: string;
}

export default function TradeFavorites() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<FavoritedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [currency, setCurrency] = useTradeDisplayCurrency();
  const rates = useFxRates();
  const [removing, setRemoving] = useState<string | null>(null);
  const [selectedFor3D, setSelectedFor3D] = useState<Set<string>>(new Set());
  const [lightboxProduct, setLightboxProduct] = useState<TradeProductLightboxItem | null>(null);
  const [addingToQuote, setAddingToQuote] = useState(false);
  const [addedToQuote, setAddedToQuote] = useState(false);

  const favToLightboxItem = (fav: FavoritedProduct): TradeProductLightboxItem => ({
    id: fav.productId,
    product_name: fav.product_name,
    image_url: fav.image_url,
    brand_name: fav.brand_name,
    materials: fav.materials,
    dimensions: fav.dimensions,
    category: fav.category || undefined,
    subcategory: fav.subcategory || undefined,
    price: fav.trade_price_cents ? `€${(fav.trade_price_cents / 100).toLocaleString()}` : undefined,
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

      await supabase.from("trade_quote_items").insert({
        quote_id: quoteId,
        product_id: product.id,
        quantity: 1,
      });

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
        .select("id, product_id, notes, created_at, trade_products(product_name, brand_name, image_url, category, subcategory, materials, dimensions, trade_price_cents, rrp_price_cents, currency)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const mapped: FavoritedProduct[] = (data || []).map((f: any) => ({
        favoriteId: f.id,
        productId: f.product_id,
        product_name: f.trade_products?.product_name || "Unknown",
        brand_name: f.trade_products?.brand_name || "Unknown",
        image_url: f.trade_products?.image_url,
        category: f.trade_products?.category || "",
        subcategory: f.trade_products?.subcategory,
        materials: f.trade_products?.materials,
        dimensions: f.trade_products?.dimensions,
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

  useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

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
      for (const fav of favorites) {
        const { error } = await supabase.from("trade_quote_items").insert({
          quote_id: quoteId,
          product_id: fav.productId,
          quantity: 1,
        });
        if (!error) added++;
      }

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

  const filtered = search.trim()
    ? favorites.filter((f) => {
        const q = search.toLowerCase();
        return f.product_name.toLowerCase().includes(q) || f.brand_name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q);
      })
    : favorites;

  return (
    <>
      <Helmet>
        <title>Favorites — Maison Affluency Trade</title>
      </Helmet>

      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 md:px-8 py-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-lg text-foreground">Saved Products</h1>
              <p className="font-body text-xs text-muted-foreground mt-1">Your curated shortlist of products across our portfolio.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/trade/showroom")}>Back to Showroom</Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search favorites…"
              className="pl-9 font-body text-xs"
            />
          </div>
          <div className="flex items-center gap-1 border border-border rounded-md">
            <button onClick={() => setView("grid")} className={cn("p-1.5 rounded-l-md transition-colors", view === "grid" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setView("list")} className={cn("p-1.5 rounded-r-md transition-colors", view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
          <CurrencyToggle value={currency} onChange={setCurrency} />
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
          <Badge variant="secondary" className="text-[10px]">
            <Heart className="w-3 h-3 mr-1 fill-current" />{favorites.length} saved
          </Badge>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <Heart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="font-display text-sm text-foreground">
              {search ? "No favorites match your search" : "No saved products yet"}
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {search ? "Try a different search term" : "Browse the Showroom and tap the heart icon to save products here."}
            </p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((fav) => (
              <Card
                key={fav.favoriteId}
                className={cn("group overflow-hidden cursor-pointer", selectedFor3D.has(fav.productId) && "ring-2 ring-[hsl(var(--gold))]")}
                onClick={() => { setAddedToQuote(false); setLightboxProduct(favToLightboxItem(fav)); }}
              >
                <div className="relative aspect-square bg-muted">
                  {fav.image_url ? (
                    <img src={fav.image_url} alt={fav.product_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
                      <Heart className="w-8 h-8" />
                    </div>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle3D(fav.productId); }}
                    className={cn(
                      "absolute top-2 left-2 w-7 h-7 rounded-full flex items-center justify-center transition-all",
                      selectedFor3D.has(fav.productId)
                        ? "bg-[hsl(var(--gold))] text-white"
                        : "bg-background/80 backdrop-blur-sm text-muted-foreground opacity-0 group-hover:opacity-100"
                    )}
                    title="Select for 3D Studio"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFavorite(fav.favoriteId); }}
                    disabled={removing === fav.favoriteId}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                  >
                    {removing === fav.favoriteId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="p-3 text-center space-y-1">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{fav.brand_name}</p>
                  <p className="font-display text-xs text-foreground">{fav.product_name}</p>
                  {fav.trade_price_cents && (
                    <p className="font-body text-[10px] text-foreground/80">
                      {formatPriceConverted(fav.trade_price_cents, fav.currency, currency, rates)}
                    </p>
                  )}
                  {fav.materials && (
                    <p className="font-body text-[9px] text-muted-foreground truncate">{fav.materials}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((fav) => (
              <Card
                key={fav.favoriteId}
                className="flex items-center gap-4 p-3 group cursor-pointer"
                onClick={() => { setAddedToQuote(false); setLightboxProduct(favToLightboxItem(fav)); }}
              >
                <div className="w-16 h-16 rounded-md overflow-hidden bg-muted shrink-0">
                  {fav.image_url && <img src={fav.image_url} alt={fav.product_name} className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{fav.brand_name}</p>
                  <p className="font-display text-xs text-foreground">{fav.product_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    {fav.category && <Badge variant="outline" className="text-[8px]">{fav.category}</Badge>}
                    {fav.materials && <span className="font-body text-[9px] text-muted-foreground truncate">{fav.materials}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {fav.trade_price_cents && (
                    <p className="font-body text-xs text-foreground">
                      {formatPriceConverted(fav.trade_price_cents, fav.currency, currency, rates)}
                    </p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFavorite(fav.favoriteId); }}
                  disabled={removing === fav.favoriteId}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  {removing === fav.favoriteId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </Card>
            ))}
          </div>
        )}
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
