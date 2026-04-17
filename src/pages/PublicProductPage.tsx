import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, Scale, ArrowLeft, ChevronLeft, ChevronRight, Layers, Ruler, Clock, Globe } from "lucide-react";
import ShareMenu from "@/components/ShareMenu";
import { buildPieceOgUrl } from "@/lib/whatsapp-share";
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
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";
import { SUBCATEGORY_MAP } from "@/lib/productTaxonomy";

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
  lead_time: string | null;
  origin: string | null;
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
        .select("id, title, subtitle, image_url, hover_image_url, gallery_images, materials, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id")
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
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const isGridUrl = (p?: string | null) => !!p && /[?&](category|subcategory)=/.test(p);
  const storedFrom = typeof window !== "undefined" ? sessionStorage.getItem("product_from_path") : null;
  const fromPath = stateFrom || (isGridUrl(storedFrom) ? storedFrom! : undefined);

  useEffect(() => {
    if (stateFrom) {
      try { sessionStorage.setItem("product_from_path", stateFrom); } catch {}
    } else if (storedFrom && !isGridUrl(storedFrom)) {
      // Discard stale non-grid path
      try { sessionStorage.removeItem("product_from_path"); } catch {}
    }
  }, [stateFrom, storedFrom]);
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
  const rawSubcategory = product.subcategory?.trim();
  const normalizedSubcategory = rawSubcategory
    ? Object.entries(SUBCATEGORY_MAP).find(([, values]) =>
        values.some((value) => value.toLowerCase() === rawSubcategory.toLowerCase())
      )?.[0] || rawSubcategory
    : null;

  const fallbackGridParams = new URLSearchParams();
  if (product.category) fallbackGridParams.set("category", product.category);
  if (normalizedSubcategory) fallbackGridParams.set("subcategory", normalizedSubcategory);
  const fallbackGridQuery = fallbackGridParams.toString();
  const fallbackGridPath = `/designers${fallbackGridQuery ? `?${fallbackGridQuery}` : ""}`;

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
              if (fromPath) {
                navigate(fromPath);
                return;
              }

              navigate(fallbackGridPath);
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

            <div className="relative flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/designers/${designer.slug}`}
                    className="font-body text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors"
                  >
                    {designerDisplay}
                  </Link>
                  <h1 className="font-display text-2xl md:text-3xl mt-1 leading-tight">
                    {product.title}
                    {product.subtitle && ` by ${product.subtitle}`}
                  </h1>
                </div>
                <div className="shrink-0 mt-1">
                  <ShareMenu
                    url={buildPieceOgUrl(designerDisplay, product.title)}
                    message={`${product.title} by ${designerDisplay} — Maison Affluency: ${buildPieceOgUrl(designerDisplay, product.title)}`}
                    iconSize="w-4 h-4"
                    showLabel={false}
                  />
                </div>
              </div>

              {/* Materials & dimensions with gold icons */}
              <div className="flex flex-col gap-2">
                {product.materials && (
                  <div className="flex gap-1.5 items-start">
                    <Layers size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                    <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed">
                      {product.materials}
                    </p>
                  </div>
                )}
                {product.dimensions && (
                  <div className="flex gap-1.5 items-start">
                    <Ruler size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                    <p className="font-body text-xs md:text-sm text-foreground font-medium whitespace-pre-line">
                      {product.dimensions}
                    </p>
                  </div>
                )}
                {product.origin && (
                  <div className="flex gap-1.5 items-start">
                    <Globe size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                    <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {product.origin}
                    </p>
                  </div>
                )}
                {product.lead_time && (
                  <div className="flex gap-1.5 items-start">
                    <Clock size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                    <p className="font-body text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                      {product.lead_time}
                    </p>
                  </div>
                )}
              </div>

              {/* Primary CTA — Price on Request */}
              <Link
                to="/trade-program"
                className="mt-2 flex items-center justify-center gap-2 px-5 py-3.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full bg-foreground text-background hover:bg-foreground/90"
              >
                Price on Request
              </Link>

              {/* Secondary actions: Favorite / Pin / Spec Sheet */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => toggleFavorite(product.id)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border",
                    favorited
                      ? "border-destructive/30 text-destructive bg-destructive/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <Heart size={13} className={cn(favorited && "fill-current")} />
                  {favorited ? "Favorited" : "Favorite"}
                </button>

                <button
                  onClick={() => togglePin(compareItem)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border",
                    pinned
                      ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                  )}
                >
                  <Scale size={13} />
                  {pinned ? "Pinned" : "Pin to Selection"}
                </button>

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
                  <Link
                    to="/contact"
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  >
                    Contact Us
                  </Link>
                )}
              </div>


              <p className="font-body text-[11px] text-muted-foreground text-center">
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
                label: "Certificate of Authenticity",
                image: cloudinaryUrl("v1776392079/Screen_Shot_2026-04-17_at_10.14.17_AM_ovaxxl", { width: 480, height: 480, quality: "auto:good", crop: "fill" }),
              },
              {
                label: "Secure Payment",
                image: cloudinaryUrl("v1776398554/Screen_Shot_2026-04-17_at_12.02.10_PM_gtnutz", { width: 480, height: 480, quality: "auto:good", crop: "fill" }),
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
                <div className="lg:col-span-4 lg:pr-4">
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

                {/* Right: 3-up product grid */}
                <div className="lg:col-span-8 flex flex-col">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
                    {visibleRelated.map((rp) => (
                      <Link
                        key={rp.id}
                        to={`/designers/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
                        state={{ from: location.pathname + location.search }}
                        className="group block"
                      >
                        <div className="aspect-square rounded-lg overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/40 transition-colors">
                          <img
                            src={rp.image_url}
                            alt={rp.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                        <p className="font-body text-xs text-muted-foreground mt-2 text-center group-hover:text-foreground transition-colors truncate">
                          {rp.title}
                        </p>
                      </Link>
                    ))}
                  </div>

                  {/* Pagination: centered dots with arrows on the right */}
                  {relatedPicks.length > visibleCount && (
                    <div className="mt-6 relative flex items-center justify-center">
                      {/* Dots (centered) */}
                      <div className="flex items-center gap-1.5">
                        {Array.from({ length: maxIndex + 1 }).map((_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setRelatedIndex(i)}
                            aria-label={`Go to page ${i + 1}`}
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              i === safeIndex
                                ? "w-6 bg-foreground"
                                : "w-1.5 bg-foreground/30 hover:bg-foreground/60"
                            )}
                          />
                        ))}
                      </div>
                      {/* Arrows (absolute right) */}
                      <div className="absolute right-0 flex items-center gap-3">
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
