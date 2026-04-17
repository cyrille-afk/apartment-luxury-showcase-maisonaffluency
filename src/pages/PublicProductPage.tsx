import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, Scale, Globe, Lock, BookOpen } from "lucide-react";
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
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";

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
  image_url: string | null;
  hover_image_url: string | null;
  gallery_images?: string[] | null;
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

      const { data: designer } = await supabase
        .from("designers")
        .select("id, name, slug, display_name")
        .eq("slug", designerSlug)
        .eq("is_published", true)
        .maybeSingle();
      if (!designer) return null;

      const { data: picks } = await supabase
        .from("designer_curator_picks_public" as any)
        .select("id, title, subtitle, image_url, hover_image_url, gallery_images, materials, dimensions, description, category, subcategory, pdf_url, pdf_urls, designer_id")
        .eq("designer_id", designer.id)
        .order("sort_order", { ascending: true });

      if (!picks || picks.length === 0) return null;

      const product = picks.find((p: any) => {
        const slug = slugify(p.title + (p.subtitle ? `-${p.subtitle}` : ""));
        return slug === productSlug;
      }) || picks.find((p: any) => slugify(p.title) === productSlug);

      if (!product) return null;

      const brandCandidates = Array.from(new Set([
        designer.display_name,
        designer.name,
      ].filter(Boolean)));

      let tradeProductQuery = supabase
        .from("trade_products")
        .select("image_url, gallery_images")
        .eq("product_name", (product as any).title)
        .eq("is_active", true)
        .limit(1);

      if (brandCandidates.length === 1) {
        tradeProductQuery = tradeProductQuery.eq("brand_name", brandCandidates[0]);
      } else if (brandCandidates.length > 1) {
        tradeProductQuery = tradeProductQuery.in("brand_name", brandCandidates);
      }

      const { data: tradeMatches } = await tradeProductQuery;
      const tradeProduct = tradeMatches?.[0] as { image_url?: string | null; gallery_images?: string[] | null } | undefined;

      return {
        product: {
          ...(product as unknown as ProductRow),
          image_url: (product as any).image_url || tradeProduct?.image_url || null,
          gallery_images: (product as any).gallery_images?.length
            ? (product as any).gallery_images
            : tradeProduct?.gallery_images || null,
        },
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

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [designerSlug, productSlug]);

  useEffect(() => {
    const onSync = () => setFavIds(readFavs());
    window.addEventListener("public_favorites_changed", onSync);
    window.addEventListener("storage", onSync);
    return () => {
      window.removeEventListener("public_favorites_changed", onSync);
      window.removeEventListener("storage", onSync);
    };
  }, []);

  const toggleFavorite = (id: string) => {
    setFavIds((prev) => {
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
      image: product.image_url || "",
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
  const overrideImages = productSlug ? PRODUCT_GALLERY_OVERRIDES[productSlug] : undefined;
  const images = overrideImages ?? Array.from(new Set([
    product.image_url,
    ...(product.gallery_images || []),
    product.hover_image_url,
  ].filter(Boolean))).slice(0, 4) as string[];

  const pageTitle = `${product.title}${product.subtitle ? ` ${product.subtitle}` : ""} by ${designerDisplay}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle} — Maison Affluency</title>
        <meta name="description" content={product.description || `${product.title} by ${designerDisplay}. ${product.materials || ""}`} />
        <link rel="canonical" href={`https://www.maisonaffluency.com/designers/${designer.slug}/${productSlug}`} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation borderless />

        <div className="pt-28 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            <div className="relative">
              <ProductImageGallery images={images} alt={product.title} />
              {product.description && (
                <div className="absolute top-3 left-3 right-3 z-10 pointer-events-none">
                  <div className="pointer-events-auto inline-block max-w-full">
                    <LightboxDescriptionDropdown description={product.description} />
                  </div>
                </div>
              )}
            </div>

            <div className="relative flex flex-col gap-5">
              <button
                onClick={() => {
                  requireAuth(() => toggleFavorite(product.id), "save pieces to your favorites");
                }}
                aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                className={cn(
                  "absolute -top-1 right-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors",
                  favorited ? "text-destructive" : "text-foreground/70 hover:text-foreground"
                )}
              >
                <Heart size={20} className={cn(favorited && "fill-current")} />
              </button>

              <div className="pr-12">
                <Link
                  to={`/designers/${designer.slug}`}
                  className="font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {designerDisplay}
                </Link>
                <h1 className="font-display text-3xl md:text-4xl mt-2 leading-tight">
                  {product.title}
                  {product.subtitle && ` ${product.subtitle}`}
                </h1>
              </div>

              <p className="font-display text-xl text-foreground/80">Price on request</p>

              <Link
                to="/trade-program"
                className="flex items-center justify-center px-5 py-4 rounded-md font-body text-xs uppercase tracking-[0.15em] transition-all w-full bg-foreground text-background hover:bg-foreground/90 mt-1"
              >
                Request a Quote or a Customisation
              </Link>

              <div className="flex flex-col gap-4 pt-4 text-foreground/85 font-body text-sm leading-relaxed">
                {product.materials && (
                  <p>{product.materials}</p>
                )}
                {product.dimensions && (
                  <p className="whitespace-pre-line">{product.dimensions}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 mt-2">
                {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0)) ? (
                  <SpecSheetButton
                    pdfUrl={product.pdf_url}
                    pdfUrls={product.pdf_urls}
                    brandName={designerDisplay}
                    productName={product.title}
                    variant="button"
                    onBeforeOpen={() => {
                      let allowed = false;
                      requireAuth(() => { allowed = true; }, "download this spec sheet");
                      return allowed;
                    }}
                  />
                ) : (
                  <button
                    onClick={() => togglePin(compareItem)}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3.5 rounded-md font-body text-xs uppercase tracking-[0.15em] transition-all border",
                      pinned
                        ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                        : "border-foreground text-foreground hover:bg-foreground/5",
                      compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                    )}
                  >
                    <Scale size={14} />
                    {pinned ? "Pinned" : "Compare"}
                  </button>
                )}
                <Link
                  to="/contact"
                  className="flex items-center justify-center px-4 py-3.5 rounded-md font-body text-xs uppercase tracking-[0.15em] transition-all bg-foreground text-background hover:bg-foreground/90"
                >
                  Contact Us
                </Link>
              </div>

              <a
                href={`mailto:?subject=${encodeURIComponent(`${product.title} by ${designerDisplay}`)}&body=${encodeURIComponent(`I thought you'd love this piece: ${typeof window !== "undefined" ? window.location.href : ""}`)}`}
                className="self-center font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors mt-1"
              >
                Send to a Friend
              </a>

              <p className="font-body text-[11px] text-muted-foreground text-center mt-2">
                For pricing and availability, please{" "}
                <Link to="/trade-program" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  join our Trade Program
                </Link>.
              </p>
            </div>
          </div>

          <div className="mt-16 pt-10 border-t border-border grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              { icon: Globe, label: "Insured Worldwide Delivery" },
              { icon: Lock, label: "Secure Payment" },
              { icon: BookOpen, label: "Certificate of Authenticity" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-muted/40 flex items-center justify-center text-foreground/70">
                  <Icon size={22} strokeWidth={1.4} />
                </div>
                <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

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
                  to={`/designers/${designer.slug}?section=picks&expanded=true`}
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
