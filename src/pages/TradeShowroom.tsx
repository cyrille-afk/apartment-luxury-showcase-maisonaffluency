import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { ShoppingCart, MapPin, Grid3X3, Search } from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import Gallery from "@/components/Gallery";
import ProductImageSearch from "@/components/trade/ProductImageSearch";
import ShowroomDesignerDirectory from "@/components/trade/ShowroomDesignerDirectory";
import { cn } from "@/lib/utils";
import { createActiveDraftQuote, fetchScopedDraftQuotes, rememberActiveQuoteId } from "@/lib/activeProjectId";

interface DraftQuote {
  id: string;
  created_at: string;
}

type ViewTab = "gallery" | "designers" | "search";

const TradeShowroom = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState<ViewTab>(
    tabParam === "designers"
      ? "designers"
      : tabParam === "search"
        ? "search"
        : "gallery",
  );

  const [draftQuotes, setDraftQuotes] = useState<DraftQuote[]>([]);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);

  // Fetch draft quotes — scoped to the active project or the current session quote.
  useEffect(() => {
    if (!user) return;
    const fetchDrafts = async () => {
      const drafts = await fetchScopedDraftQuotes(user.id);
      setDraftQuotes(drafts);
      setActiveQuoteId(drafts.length > 0 ? drafts[0].id : null);
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
        const { data, error } = await createActiveDraftQuote(user.id);

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
    rememberActiveQuoteId(quote.id);
    setDraftQuotes((prev) => [quote, ...prev]);
    setActiveQuoteId(quote.id);
  }, []);

  return (
    <>
      <Helmet>
        <title>The Maison Archive — Trade Portal — Maison Affluency</title>
      </Helmet>
      <div className="max-w-7xl">
        {/* Editorial header: pure white, no banner */}
        <div className="bg-background py-14 md:py-20 lg:py-24">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-light text-foreground tracking-tight">
                The Maison Archive
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 mt-4">
                A MATRICULATED INDEX OF 150+ COLLECTIBLE DESIGNERS, ATELIERS, AND CURATED RESIDENTIAL GALLERIES.
              </p>
            </div>
            <button
              onClick={() => setDrawerOpen(true)}
              className="shrink-0 p-2 border border-border rounded-md text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
              title="View active quote"
            >
              <ShoppingCart className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Sub-header workspace navigation */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mb-10 border-b border-[#E5E5E5] pb-3">
          {([
            { id: "gallery", label: "Interactive Galleries", Icon: MapPin },
            { id: "designers", label: "Designers & Ateliers", Icon: Grid3X3 },
            { id: "search", label: "Visual Search", Icon: Search },
          ] as const).map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                "flex items-center gap-2 font-body text-[11px] uppercase tracking-[0.15em] transition-colors",
                activeTab === id
                  ? "font-medium text-foreground underline decoration-foreground underline-offset-[10px]"
                  : "text-muted-foreground/70 hover:text-foreground",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "gallery" ? (
          <Gallery onHotspotAddToQuote={handleHotspotAddToQuote} hideIntro />
        ) : activeTab === "designers" ? (
          <ShowroomDesignerDirectory
            onSelectDesigner={(designer) => {
              navigate(`/trade/gallery/${designer.slug}`, {
                state: { from: "/trade/showroom?tab=designers" },
              });
            }}
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
