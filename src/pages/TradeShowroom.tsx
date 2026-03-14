import { useState, useMemo, useEffect } from "react";
import { Search, Grid3X3, List, ShoppingCart, Check, Package, MapPin, ExternalLink, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getAllTradeProducts } from "@/lib/tradeProducts";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ShowroomProduct {
  id: string;
  product_name: string;
  designer_name: string | null;
  materials: string | null;
  dimensions: string | null;
  product_image_url: string | null;
  link_url: string | null;
  image_identifier: string;
  pdf_url?: string;
  trade_price_cents?: number | null;
  currency?: string;
}

const formatPrice = (cents: number, currency: string) => {
  const amount = cents / 100;
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
};

interface DraftQuote {
  id: string;
  created_at: string;
}

const TradeShowroom = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [products, setProducts] = useState<ShowroomProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedDesigner, setSelectedDesigner] = useState("all");
  const [selectedRoom, setSelectedRoom] = useState("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [addedProductIds, setAddedProductIds] = useState<Set<string>>(new Set());

  // Fetch hotspot products (deduplicated by product_name + designer_name)
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase
        .from("gallery_hotspots")
        .select("id, product_name, designer_name, materials, dimensions, product_image_url, link_url, image_identifier")
        .order("designer_name", { ascending: true });

      if (data) {
        // Build a PDF lookup from trade products (curators' picks data)
        const tradeProducts = getAllTradeProducts();
        const pdfLookup = new Map<string, string>();
        for (const tp of tradeProducts) {
          if (tp.pdf_url) {
            pdfLookup.set(tp.product_name.trim().toLowerCase(), tp.pdf_url);
          }
        }

        // Build a price lookup from trade_products table
        const { data: pricedProducts } = await supabase
          .from("trade_products")
          .select("product_name, trade_price_cents, currency")
          .not("trade_price_cents", "is", null);
        const priceLookup = new Map<string, { cents: number; currency: string }>();
        if (pricedProducts) {
          for (const pp of pricedProducts) {
            if (pp.trade_price_cents) {
              priceLookup.set(pp.product_name.trim().toLowerCase(), {
                cents: pp.trade_price_cents,
                currency: pp.currency,
              });
            }
          }
        }

        // Deduplicate by product_name (case-insensitive) AND by product_image_url
        const seenByName = new Map<string, ShowroomProduct>();
        const seenImageUrls = new Set<string>();
        for (const item of data as ShowroomProduct[]) {
          const key = item.product_name.trim().toLowerCase();
          const existing = seenByName.get(key);

          // Skip if we've already seen this exact image under a different name
          if (item.product_image_url && seenImageUrls.has(item.product_image_url) && !existing) {
            continue;
          }

          if (
            !existing ||
            (!existing.product_image_url && item.product_image_url) ||
            (!existing.materials && item.materials) ||
            (!existing.dimensions && item.dimensions)
          ) {
            const price = priceLookup.get(key);
            seenByName.set(key, {
              ...item,
              pdf_url: pdfLookup.get(key),
              trade_price_cents: price?.cents ?? null,
              currency: price?.currency,
            });
            if (item.product_image_url) seenImageUrls.add(item.product_image_url);
          }
        }
        setProducts([...seenByName.values()]);
      }
      setLoading(false);
    };
    fetchProducts();
  }, []);

  // Fetch draft quotes
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

  const designers = useMemo(() => [...new Set(products.map((p) => p.designer_name).filter(Boolean) as string[])].sort(), [products]);
  const rooms = useMemo(() => [...new Set(products.map((p) => p.image_identifier))].sort(), [products]);

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.product_name.toLowerCase().includes(q) ||
        p.designer_name?.toLowerCase().includes(q) ||
        p.materials?.toLowerCase().includes(q);
      const matchesDesigner = selectedDesigner === "all" || p.designer_name === selectedDesigner;
      const matchesRoom = selectedRoom === "all" || p.image_identifier === selectedRoom;
      return matchesSearch && matchesDesigner && matchesRoom;
    });
  }, [products, search, selectedDesigner, selectedRoom]);

  const handleCreateQuoteAndAdd = async (product: ShowroomProduct) => {
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

  const addProductToQuote = async (product: ShowroomProduct, quoteId: string) => {
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
      toast({ title: "Added to quote", description: `${product.product_name} added to QU-${quoteId.slice(0, 6).toUpperCase()}` });
    }
    setAddingProductId(null);
  };

  const handleAddToQuote = (product: ShowroomProduct) => {
    if (activeQuoteId) {
      addProductToQuote(product, activeQuoteId);
    } else {
      handleCreateQuoteAndAdd(product);
    }
  };

  const inputClass =
    "px-3 py-2 bg-background border border-border rounded-md font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors";

  return (
    <div className="max-w-7xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-display text-2xl text-foreground mb-1">Showroom Collection</h1>
          <p className="font-body text-sm text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "piece" : "pieces"} from our Singapore gallery
            {selectedDesigner !== "all" ? ` by ${selectedDesigner}` : ""}
            {selectedRoom !== "all" ? ` in "${selectedRoom}"` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            placeholder="Search products, designers, materials…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${inputClass} pl-9 w-full`}
          />
        </div>
        <select value={selectedDesigner} onChange={(e) => setSelectedDesigner(e.target.value)} className={inputClass}>
          <option value="all">All Designers ({designers.length})</option>
          {designers.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} className={inputClass}>
          <option value="all">All Rooms ({rooms.length})</option>
          {rooms.map((r) => (
            <option key={r} value={r}>{r}</option>
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
          <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
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
                  {product.product_image_url ? (
                    <img
                      src={product.product_image_url}
                      alt={product.product_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                  {/* Room badge */}
                  <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm font-body text-[9px] text-muted-foreground">
                      <MapPin className="h-2.5 w-2.5" />
                      {product.image_identifier}
                    </span>
                  </div>
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
                    {product.link_url && (
                      <a
                        href={`/${product.link_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-background/90 rounded-md text-foreground hover:bg-background transition-colors"
                        title="View in gallery"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="p-3">
                  {product.designer_name && (
                    <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      {product.designer_name}
                    </p>
                  )}
                  <h3 className="font-display text-sm text-foreground leading-tight mb-0.5 truncate">
                    {product.product_name}
                  </h3>
                  {product.dimensions && (
                    <p className="font-body text-[10px] text-muted-foreground mt-1 line-clamp-2">{product.dimensions}</p>
                  )}
                  {product.materials && (
                    <p className="font-body text-[10px] text-muted-foreground line-clamp-2">{product.materials}</p>
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
                  {product.product_image_url ? (
                    <img src={product.product_image_url} alt={product.product_name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-body text-[10px] text-muted-foreground uppercase tracking-wider">{product.designer_name || "—"}</p>
                  <h3 className="font-display text-sm text-foreground truncate">{product.product_name}</h3>
                  <p className="font-body text-[10px] text-muted-foreground truncate">
                    {product.image_identifier}
                    {product.materials ? ` · ${product.materials}` : ""}
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
                {product.link_url && (
                  <a href={`/${product.link_url}`} target="_blank" rel="noopener noreferrer"
                    className="p-2 text-muted-foreground hover:text-foreground transition-colors" title="View in gallery">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TradeShowroom;
