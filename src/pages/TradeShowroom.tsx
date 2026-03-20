import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { ShoppingCart, MapPin, Grid3X3, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import SectionHero from "@/components/trade/SectionHero";
import Gallery from "@/components/Gallery";
import ShowroomGridView from "@/components/trade/ShowroomGridView";
import ProductImageSearch from "@/components/trade/ProductImageSearch";
import { cn } from "@/lib/utils";

interface DraftQuote {
  id: string;
  created_at: string;
}

type ViewTab = "gallery" | "grid" | "search";

const TradeShowroom = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");
  const highlightId = searchParams.get("highlight");
  const designerParam = searchParams.get("designer");

  const [activeTab, setActiveTab] = useState<ViewTab>(tabParam === "grid" ? "grid" : tabParam === "search" ? "search" : "gallery");
  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);

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

  const addProductToQuote = useCallback(
    async (
      product: {
        product_name: string;
        designer_name: string | null;
        product_image_url: string | null;
        materials: string | null;
        dimensions: string | null;
      },
      quoteId: string,
    ) => {
      if (!user) return;
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
        setDrawerRefreshKey((k) => k + 1);
        setDrawerOpen(true);
        toast({
          title: "Added to quote",
          description: `${product.product_name} added to QU-${quoteId.slice(0, 6).toUpperCase()}`,
        });
      }
    },
    [user, toast],
  );

  const handleHotspotAddToQuote = useCallback(
    async (product: {
      product_name: string;
      designer_name: string | null;
      product_image_url: string | null;
      materials: string | null;
      dimensions: string | null;
    }) => {
      if (!user) return;

      if (activeQuoteId) {
        await addProductToQuote(product, activeQuoteId);
      } else {
        const { data, error } = await supabase
          .from("trade_quotes")
          .insert({ user_id: user.id, status: "draft" })
          .select("id, created_at")
          .single();
        if (error || !data) {
          toast({ title: "Error creating quote", description: error?.message, variant: "destructive" });
          return;
        }
        const newQuote = data as DraftQuote;
        setDraftQuotes((prev) => [newQuote, ...prev]);
        setActiveQuoteId(newQuote.id);
        await addProductToQuote(product, newQuote.id);
      }
    },
    [user, activeQuoteId, addProductToQuote, toast],
  );

  const handleQuoteCreated = useCallback((quote: { id: string; created_at: string }) => {
    setDraftQuotes((prev) => [quote, ...prev]);
    setActiveQuoteId(quote.id);
  }, []);

  return (
    <>
      <Helmet>
        <title>Showroom — Trade Portal — Maison Affluency</title>
      </Helmet>
      <div className="max-w-7xl">
        <SectionHero
          section="showroom"
          title="Showroom"
          subtitle={activeTab === "gallery"
            ? "Navigate the gallery rooms and discover products through interactive hotspots"
            : "Browse all showroom products with filters and search"
          }
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 border border-background/30 rounded-md text-background/70 hover:text-background hover:border-background/50 transition-colors"
            title="View active quote"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </SectionHero>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          <button
            onClick={() => setActiveTab("gallery")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 font-body text-xs uppercase tracking-[0.1em] transition-colors border-b-2 -mb-px",
              activeTab === "gallery"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <MapPin className="h-3.5 w-3.5" />
            Interactive Gallery
          </button>
          <button
            onClick={() => setActiveTab("grid")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 font-body text-xs uppercase tracking-[0.1em] transition-colors border-b-2 -mb-px",
              activeTab === "grid"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            Product Grid
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 font-body text-xs uppercase tracking-[0.1em] transition-colors border-b-2 -mb-px",
              activeTab === "search"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            Visual Search
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "gallery" ? (
          <Gallery onHotspotAddToQuote={handleHotspotAddToQuote} hideIntro />
        ) : activeTab === "grid" ? (
          <ShowroomGridView
            activeQuoteId={activeQuoteId}
            onQuoteCreated={handleQuoteCreated}
            drawerRefreshKey={drawerRefreshKey}
            onDrawerRefreshKeyChange={setDrawerRefreshKey}
            onDrawerOpen={() => setDrawerOpen(true)}
            highlightProductId={highlightId}
            initialDesigner={designerParam}
          />
        ) : (
          <ProductImageSearch
            onSelectImage={(result) => {
              handleHotspotAddToQuote({
                product_name: result.title,
                designer_name: null,
                product_image_url: result.imageUrl,
                materials: null,
                dimensions: null,
              });
            }}
          />
        )}
      </div>

      <QuoteDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        quoteId={activeQuoteId}
        refreshKey={drawerRefreshKey}
      />
    </>
  );
};

export default TradeShowroom;
