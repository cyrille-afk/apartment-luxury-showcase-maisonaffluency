import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, Scale, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { cloudinaryUrl } from "@/lib/cloudinary";
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
        .select("id, name, slug, display_name, biography")
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
        designer: { id: designer.id, name: designer.display_name || designer.name, slug: designer.slug, biography: designer.biography || "" },
        relatedPicks: (picks as unknown as ProductRow[]).filter((p) => p.id !== (product as any).id),
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
  const location = useLocation();
  const fromPath = (location.state as { from?: string } | null)?.from;
  const { data, isLoading } = useProductBySlug(designerSlug, productSlug);
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();

  const [favIds, setFavIds] = useState(readFavs);
  const [relatedIndex, setRelatedIndex] = useState(0);

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
        <div className="pt-32 md:pt-[12rem]"><PageLoadingSkeleton /></div>
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
  // If admin has set gallery_images, use them as the sole source of truth (admin controls order & count).
  // Otherwise fall back to image_url + hover_image_url.
  const galleryFromAdmin = (product.gallery_images || []).filter(Boolean) as string[];
  const images = (galleryFromAdmin.length > 0
    ? galleryFromAdmin
    : Array.from(new Set([product.image_url, product.hover_image_url].filter(Boolean)))
  ) as string[];

  const pageTitle = `${product.title}${product.subtitle ? ` ${product.subtitle}` : ""} by ${designerDisplay}`;

  // Build brand summary from biography: strip media URLs (lines starting with http) and pipe-delimited captions.
  const brandSummary = (() => {
    const bio = (designer as any).biography as string | undefined;
    if (!bio) return "";
    const cleaned = bio
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line && !/^https?:\/\//i.test(line.split("|")[0].trim()))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length <= 480) return cleaned;
    return cleaned.slice(0, 480).replace(/\s+\S*$/, "") + "…";
  })();

  // Carousel: 3 visible at a time
  const visibleCount = 3;
  const maxIndex = Math.max(0, relatedPicks.length - visibleCount);
  const safeIndex = Math.min(relatedIndex, maxIndex);
  const visibleRelated = relatedPicks.slice(safeIndex, safeIndex + visibleCount);

  return (
    <>
      <Helmet>
        <title>{pageTitle} — Maison Affluency</title>
        <meta name="description" content={product.description || `${product.title} by ${designerDisplay}. ${product.materials || ""}`} />
        <link rel="canonical" href={`https://www.maisonaffluency.com/designers/${designer.slug}/${productSlug}`} />
      </Helmet>

      <div className="min-h-screen bg-background text-foreground">
        <Navigation borderless />

        <div className="pt-32 md:pt-[12rem] pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => {
              if (fromPath) navigate(fromPath);
              else navigate(`/designers/${designer.slug}`);
            }}
            className="inline-flex items-center gap-1.5 mb-6 font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            <div className="relative">
              <ProductImageGallery
                images={images}
                alt={product.title}
                overlay={product.description ? <LightboxDescriptionDropdown description={product.description} /> : null}
              />
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
              {
                label: "Insured Worldwide Delivery",
                image: cloudinaryUrl("v1773473193/quality-control_dvxvmb", { width: 480, height: 480, quality: "auto:good", crop: "fill" }),
              },
              {
                label: "Secure Payment",
                image: cloudinaryUrl("v1773730098/Screen_Shot_2026-03-17_at_2.47.21_PM_lg1da3", { width: 480, height: 480, quality: "auto:good", crop: "fill", gravity: "north" }),
              },
              {
                label: "Certificate of Authenticity",
                image: cloudinaryUrl("details-console_hk6uxt", { width: 480, height: 480, quality: "auto:good", crop: "fill" }),
              },
            ].map(({ label, image }) => (
              <div key={label} className="flex flex-col items-center text-center gap-3">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-muted/40">
                  <img src={image} alt={label} className="w-full h-full object-cover" loading="lazy" />
                </div>
                <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          {relatedPicks.length > 0 && (
            <div className="mt-20 pt-8 border-t border-border">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Left: brand summary */}
                <div className="lg:col-span-4 lg:pr-4 flex flex-col justify-between">
                  <div>
                    <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      From the Same Designer
                    </p>
                    <h2 className="font-display text-2xl md:text-3xl leading-tight mb-5">
                      <Link
                        to={`/designers/${designer.slug}`}
                        className="hover:text-primary transition-colors"
                      >
                        {designerDisplay}
                      </Link>
                    </h2>
                    {brandSummary && (
                      <p className="font-body text-sm text-foreground/75 leading-relaxed text-justify">
                        {brandSummary}
                      </p>
                    )}
                  </div>

                  {relatedPicks.length > visibleCount && (
                    <div className="hidden lg:flex items-center gap-3 mt-8">
                      <button
                        type="button"
                        onClick={() => setRelatedIndex((i) => Math.max(0, i - 1))}
                        disabled={safeIndex === 0}
                        aria-label="Previous"
                        className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRelatedIndex((i) => Math.min(maxIndex, i + 1))}
                        disabled={safeIndex >= maxIndex}
                        aria-label="Next"
                        className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Right: 3-up product grid */}
                <div className="lg:col-span-8">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                    {visibleRelated.map((rp) => (
                      <Link
                        key={rp.id}
                        to={`/designers/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
                        state={{ from: location.pathname + location.search }}
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
                        <div className="mt-3 text-center">
                          <p className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{designerDisplay}</p>
                          <p className="font-display text-base mt-1">{rp.title}</p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Mobile arrows */}
                  {relatedPicks.length > visibleCount && (
                    <div className="flex lg:hidden items-center justify-center gap-3 mt-6">
                      <button
                        type="button"
                        onClick={() => setRelatedIndex((i) => Math.max(0, i - 1))}
                        disabled={safeIndex === 0}
                        aria-label="Previous"
                        className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRelatedIndex((i) => Math.min(maxIndex, i + 1))}
                        disabled={safeIndex >= maxIndex}
                        aria-label="Next"
                        className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-foreground hover:border-foreground/60 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
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
