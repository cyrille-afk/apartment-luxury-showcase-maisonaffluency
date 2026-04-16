import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Layers, Ruler, Heart, Scale, Info, ChevronDown } from "lucide-react";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import { cn } from "@/lib/utils";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ProductCardDescriptionOverlay from "@/components/ui/ProductCardDescriptionOverlay";

/* ------------------------------------------------------------------ */
/*  localStorage-backed favorites (mirrors PublicProductLightbox)       */
/* ------------------------------------------------------------------ */
const LS_KEY = "public_favorites";
function readFavs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]")); }
  catch { return new Set(); }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ------------------------------------------------------------------ */
/*  Data fetching                                                      */
/* ------------------------------------------------------------------ */
interface ProductRow {
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
  pdf_urls: PdfEntry[] | null;
  designer_id: string;
}

function useProductBySlug(designerSlug: string | undefined, productSlug: string | undefined) {
  return useQuery({
    queryKey: ["public-product-page", designerSlug, productSlug],
    queryFn: async () => {
      if (!designerSlug || !productSlug) return null;

      // Get designer by slug
      const { data: designer } = await supabase
        .from("designers")
        .select("id, name, slug, display_name")
        .eq("slug", designerSlug)
        .eq("is_published", true)
        .maybeSingle();
      if (!designer) return null;

      // Get all picks for this designer
      const { data: picks } = await supabase
        .from("designer_curator_picks_public" as any)
        .select("id, title, subtitle, image_url, hover_image_url, materials, dimensions, description, category, subcategory, pdf_url, pdf_urls, designer_id")
        .eq("designer_id", designer.id)
        .order("sort_order", { ascending: true });

      if (!picks || picks.length === 0) return null;

      // Match by product slug
      const product = picks.find((p: any) => {
        const slug = slugify(p.title + (p.subtitle ? `-${p.subtitle}` : ""));
        return slug === productSlug;
      }) || picks.find((p: any) => slugify(p.title) === productSlug);

      if (!product) return null;

      return {
        product: product as unknown as ProductRow,
        designer: { id: designer.id, name: designer.display_name || designer.name, slug: designer.slug },
        relatedPicks: (picks as unknown as ProductRow[]).filter((p) => p.id !== (product as any).id).slice(0, 6),
      };
    },
    enabled: !!designerSlug && !!productSlug,
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
const PublicProductPage: React.FC = () => {
  const { slug: designerSlug, productSlug } = useParams<{ slug: string; productSlug: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useProductBySlug(designerSlug, productSlug);
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();

  const [favIds, setFavIds] = useState(readFavs);
  const [activeImage, setActiveImage] = useState<"main" | "hover">("main");
  const [descOpen, setDescOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [designerSlug, productSlug]);

  // Sync favorites from other tabs
  useEffect(() => {
    const onSync = () => setFavIds(readFavs());
    window.addEventListener("public_favorites_changed", onSync);
    window.addEventListener("storage", onSync);
    return () => { window.removeEventListener("public_favorites_changed", onSync); window.removeEventListener("storage", onSync); };
  }, []);

  const toggleFavorite = (id: string) => {
    setFavIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      localStorage.setItem(LS_KEY, JSON.stringify([...next]));
      window.dispatchEvent(new Event("public_favorites_changed"));
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-28"><PageLoadingSkeleton /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <p className="font-body text-sm text-muted-foreground">Product not found.</p>
          <button onClick={() => navigate(-1)} className="font-body text-xs uppercase tracking-[0.12em] underline underline-offset-4 text-foreground hover:text-primary transition-colors">
            Go Back
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  const { product, designer, relatedPicks } = data;
  const favorited = favIds.has(product.id);

  const designerDisplay = designer.name.includes(" - ")
    ? designer.name.split(" - ")[0].trim()
    : designer.name;

  const compareItem: CompareItem = {
    pick: {
      title: product.title,
      subtitle: product.subtitle || undefined,
      image: product.image_url,
      hoverImage: product.hover_image_url || undefined,
      materials: product.materials,
      dimensions: product.dimensions,
      category: product.category || undefined,
      subcategory: product.subcategory || undefined,
    },
    designerName: designerDisplay,
    designerId: product.id,
    section: "designers",
  };

  const pinned = isPinned(product.title, product.id);
  const images = [product.image_url, product.hover_image_url].filter(Boolean) as string[];
  const currentImage = activeImage === "hover" && product.hover_image_url ? product.hover_image_url : product.image_url;

  const pageTitle = `${product.title}${product.subtitle ? ` ${product.subtitle}` : ""} by ${designerDisplay}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle} — Maison Affluency</title>
        <meta name="description" content={product.description || `${product.title} by ${designerDisplay}. ${product.materials || ""}`} />
        <link rel="canonical" href={`https://www.maisonaffluency.com/designers/${designer.slug}/${productSlug}`} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation />

        <div className="pt-24 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main content: image + details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            {/* Left: Images */}
            <div className="flex gap-4">
              {/* Thumbnails */}
              {images.length > 1 && (
                <div className="hidden md:flex flex-col gap-2 w-20 shrink-0">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(i === 0 ? "main" : "hover")}
                      className={cn(
                        "aspect-square rounded-md overflow-hidden border-2 transition-all",
                        (i === 0 ? activeImage === "main" : activeImage === "hover")
                          ? "border-foreground"
                          : "border-border hover:border-foreground/30"
                      )}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}

              {/* Main image */}
              <div className="flex-1 group relative">
                {/* Collapsible description bar */}
                {product.description && (
                  <div
                    className="absolute top-0 left-0 right-0 z-20 bg-background/90 backdrop-blur-sm border-b border-border/30 cursor-pointer rounded-t-lg"
                    onClick={() => setDescOpen(!descOpen)}
                  >
                    <div className="flex items-center gap-2 px-3.5 py-2.5">
                      <Info size={14} className="text-muted-foreground shrink-0" />
                      <p className={cn("font-body text-xs text-foreground leading-relaxed flex-1", !descOpen && "line-clamp-1")}>
                        {product.description}
                      </p>
                      <ChevronDown size={14} className={cn("text-muted-foreground shrink-0 transition-transform duration-200", descOpen && "rotate-180")} />
                    </div>
                  </div>
                )}

                <div className="aspect-square bg-muted/10 rounded-lg overflow-hidden flex items-center justify-center">
                  <img
                    src={currentImage}
                    alt={product.title}
                    className="w-full h-full object-contain"
                    style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                  />
                </div>

              </div>
            </div>

            {/* Right: Product details */}
            <div className="flex flex-col gap-4">
              {/* Designer & title */}
              <div>
                <Link
                  to={`/designers/${designer.slug}`}
                  className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {designerDisplay}
                </Link>
                <h1 className="font-display text-2xl md:text-3xl mt-1 leading-tight">
                  {product.title}
                  {product.subtitle && ` ${product.subtitle}`}
                </h1>
              </div>

              {/* Price */}
              <p className="font-display text-lg text-muted-foreground">Price on request</p>

              {/* Materials & Dimensions */}
              <div className="flex flex-col gap-3 py-4 border-y border-border">
                {product.materials && (
                  <div className="flex gap-2 items-start">
                    <Layers size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                    <p className="font-body text-sm text-muted-foreground leading-relaxed">{product.materials}</p>
                  </div>
                )}
                {product.dimensions && (
                  <div className="flex gap-2 items-start">
                    <Ruler size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                    <p className="font-body text-sm text-foreground">{product.dimensions}</p>
                  </div>
                )}
              </div>


              {/* CTAs */}
              <div className="flex flex-col gap-3 mt-2">
                <Link
                  to="/trade-program"
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  Request a Quote or a Customisation
                </Link>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      requireAuth(() => toggleFavorite(product.id), "save pieces to your favorites");
                    }}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                      favorited
                        ? "border-destructive/30 text-destructive bg-destructive/10"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    )}
                  >
                    <Heart size={14} className={cn(favorited && "fill-current")} />
                    {favorited ? "Favorited" : "Favorite"}
                  </button>

                  <button
                    onClick={() => togglePin(compareItem)}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                      pinned
                        ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                    )}
                  >
                    <Scale size={14} />
                    {pinned ? "Pinned" : "Compare"}
                  </button>
                </div>

                {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0)) && (
                  <SpecSheetButton
                    pdfUrl={product.pdf_url}
                    pdfUrls={product.pdf_urls}
                    brandName={designerDisplay}
                    productName={product.title}
                    variant="button"
                    onBeforeOpen={() => { let allowed = false; requireAuth(() => { allowed = true; }, "download this spec sheet"); return allowed; }}
                  />
                )}
              </div>

              {/* Trade CTA */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="font-body text-[11px] text-muted-foreground">
                  For pricing and availability, please{" "}
                  <Link to="/trade-program" className="underline underline-offset-2 hover:text-foreground transition-colors">
                    join our Trade Program
                  </Link>.
                </p>
              </div>
            </div>
          </div>

          {/* More from this designer */}
          {relatedPicks.length > 0 && (
            <div className="mt-20 pt-8 border-t border-border">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
                    From the Same Designer
                  </p>
                  <h2 className="font-display text-xl md:text-2xl">{designerDisplay}</h2>
                </div>
                <Link
                  to={`/designers/${designer.slug}`}
                  className="font-body text-xs uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                >
                  View All
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {relatedPicks.map((rp) => (
                  <Link
                    key={rp.id}
                    to={`/designers/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
                    className="group block"
                  >
                    <div className="relative aspect-[3/4] rounded-lg overflow-hidden bg-muted/10 border border-border group-hover:border-foreground/30 transition-all">
                      <img
                        src={rp.image_url}
                        alt={rp.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                      <ProductCardDescriptionOverlay description={rp.description} />
                    </div>
                    <div className="mt-2 text-center">
                      <p className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{designerDisplay}</p>
                      <p className="font-display text-sm mt-0.5">{rp.title}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        <Footer />
      </div>

      <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    </>
  );
};

export default PublicProductPage;
