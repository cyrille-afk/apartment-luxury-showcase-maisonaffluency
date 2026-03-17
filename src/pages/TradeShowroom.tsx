import { useState, useEffect, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import SectionHero from "@/components/trade/SectionHero";
import Gallery from "@/components/Gallery";

interface DraftQuote {
  id: string;
  created_at: string;
}

const TradeShowroom = () => {
  const { user } = useAuth();
  const { toast } = useToast();

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
        // Create a new draft quote first
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

  return (
    <>
      <Helmet>
        <title>Showroom — Trade Portal — Maison Affluency</title>
      </Helmet>
      <div className="max-w-7xl">
        <SectionHero
          section="showroom"
          title="Interactive Showroom"
          subtitle="Navigate the gallery rooms and discover products through interactive hotspots"
        >
          <button
            onClick={() => setDrawerOpen(true)}
            className="relative p-2 border border-background/30 rounded-md text-background/70 hover:text-background hover:border-background/50 transition-colors"
            title="View active quote"
          >
            <ShoppingCart className="h-4 w-4" />
          </button>
        </SectionHero>

        <div className="mt-6">
          <Gallery onHotspotAddToQuote={handleHotspotAddToQuote} hideIntro />
        </div>
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
