import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart, Trash2 } from "lucide-react";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";
import { motion, AnimatePresence } from "framer-motion";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import PublicProductLightbox, { type PublicLightboxItem } from "@/components/PublicProductLightbox";

const LS_KEY = "public_favorites";

function readLocalFavorites(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(ids: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("public_favorites_changed"));
}

interface FavPick {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  hover_image_url: string | null;
  materials: string | null;
  dimensions: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  pdf_url: string | null;
  designer_id: string;
  designer_name?: string;
  designer_slug?: string;
}

const PublicFavorites = () => {
  const [favIds, setFavIds] = useState<string[]>(() => readLocalFavorites());
  const [picks, setPicks] = useState<FavPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxItem, setLightboxItem] = useState<PublicLightboxItem | null>(null);

  // Fetch picks data for the favorited IDs
  useEffect(() => {
    if (favIds.length === 0) {
      setPicks([]);
      setLoading(false);
      return;
    }

    const fetchPicks = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("designer_curator_picks_public")
        .select("id, title, subtitle, image_url, hover_image_url, materials, dimensions, description, category, subcategory, pdf_url, designer_id, size_variants")
        .in("id", favIds);

      if (!data || data.length === 0) {
        setPicks([]);
        setLoading(false);
        return;
      }

      // Fetch designer names
      const designerIds = [...new Set(data.map((p) => p.designer_id))];
      const { data: designers } = await supabase
        .from("designers")
        .select("id, name, slug")
        .in("id", designerIds);

      const designerMap = new Map(designers?.map((d) => [d.id, d]) || []);

      const enriched: FavPick[] = data.map((p) => {
        const d = designerMap.get(p.designer_id);
        return {
          ...p,
          designer_name: d?.name || "",
          designer_slug: d?.slug || "",
        };
      });

      // Preserve the order the user favorited them
      const orderMap = new Map(favIds.map((id, i) => [id, i]));
      enriched.sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0));

      setPicks(enriched);
      setLoading(false);
    };

    fetchPicks();
  }, [favIds]);

  const removeFavorite = (id: string) => {
    const next = favIds.filter((fid) => fid !== id);
    setFavIds(next);
    writeLocalFavorites(next);
  };

  const clearAll = () => {
    setFavIds([]);
    writeLocalFavorites([]);
  };

  const lightboxItems: PublicLightboxItem[] = useMemo(
    () =>
      picks.map((p) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        image_url: p.image_url,
        hover_image_url: p.hover_image_url,
        brand_name: p.designer_name || "",
        materials: p.materials,
        dimensions: p.dimensions,
        description: p.description,
        category: p.category,
        subcategory: p.subcategory,
        pdf_url: p.pdf_url,
      })),
    [picks]
  );

  return (
    <>
      <Helmet>
        <title>My Favorites — Maison Affluency</title>
        <meta name="description" content="Your curated selection of favorite pieces from Maison Affluency." />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="max-w-6xl mx-auto px-4 md:px-12 pt-24 md:pt-28 pb-20">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Gallery
          </Link>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-display text-2xl md:text-3xl tracking-wide">My Favorites</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {picks.length} {picks.length === 1 ? "piece" : "pieces"} saved
              </p>
            </div>
            {picks.length > 0 && (
              <button
                onClick={clearAll}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors tracking-wide uppercase"
              >
                Clear All
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : picks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h2 className="font-display text-lg tracking-wide mb-2">No favorites yet</h2>
              <p className="text-sm text-muted-foreground max-w-md">
                Browse our designers and click the heart icon on any piece to save it here.
              </p>
              <Link
                to="/designers"
                className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                Explore Designers
              </Link>
            </div>
          ) : (
            <motion.div
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
            >
              <AnimatePresence>
                {picks.map((pick) => (
                  <motion.div
                    key={pick.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                    className="group relative cursor-pointer"
                  >
                    <div
                      className="aspect-[3/4] rounded-lg overflow-hidden bg-muted"
                      onClick={() => {
                        const item = lightboxItems.find((li) => li.id === pick.id);
                        if (item) setLightboxItem(item);
                      }}
                    >
                      <img
                        src={pick.image_url}
                        alt={pick.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading="lazy"
                      />
                      <ProductCardDescriptionOverlay description={pick.description} />
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(pick.id);
                      }}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="Remove from favorites"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="mt-2 px-0.5">
                      <p className="font-display text-xs tracking-wide truncate">{pick.title}</p>
                      {pick.designer_name && (
                        <Link
                          to={`/designers/${pick.designer_slug}`}
                          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {pick.designer_name}
                        </Link>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <Footer />
      </div>

      <PublicProductLightbox
        product={lightboxItem}
        allPicks={lightboxItems}
        onClose={() => setLightboxItem(null)}
        onSelectRelated={(item) => setLightboxItem(item)}
      />
    </>
  );
};

export default PublicFavorites;
