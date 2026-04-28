import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, Scale, ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Layers, Ruler, Clock, Globe, Sparkles } from "lucide-react";
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
import { normalizeCategoryContext } from "@/lib/categoryNormalization";
import { renderParagraph } from "@/components/EditorialBiography";
import { formatDimensionsMultiline } from "@/lib/formatDimensions";
import ExpandableSpec from "@/components/ExpandableSpec";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { categoryUrl } from "@/lib/categorySlugs";
import { buildProductBreadcrumbs } from "@/lib/productBreadcrumbs";
import { getBasePlaceholder, getTopPlaceholder, getMaterialPlaceholder } from "@/lib/variantPlaceholders";
import { computeVariantAxes, parseMaterialsFallback } from "@/lib/parseSizeVariants";
import { formatHandcrafted } from "@/lib/formatHandcrafted";

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
  size_variants: { label?: string; base?: string; top?: string; price_cents?: number }[] | null;
  variant_placeholder: string | null;
  base_axis_label: string | null;
  top_axis_label: string | null;
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
        .select("id, title, subtitle, image_url, hover_image_url, gallery_images, materials, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, size_variants, variant_placeholder, base_axis_label, top_axis_label")
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
        designer: { id: designer.id, name: designer.name, slug: designer.slug, biography: designer.biography || "" },
        relatedPicks: (picks as unknown as ProductRow[]).filter((p) => p.id !== (product as any).id),
      };
    },
    enabled: !!designerSlug && !!productSlug,
    staleTime: 5 * 60_000,
  });
}

/* ------------------------------------------------------------------ */
/*  Variant selectors (controlled — enables cross-axis disabling)     */
/* ------------------------------------------------------------------ */
const VariantSelectors: React.FC<{ product: any; onMaterialChange?: (label: string | null) => void }> = ({ product, onMaterialChange }) => {
  const axes = computeVariantAxes(product.size_variants);
  const {
    isDualAxis,
    baseOptions,
    topOptions,
    dualSizeOptions,
    hasSingleAxisSplit,
    singleSizeOptions,
    singleMaterialOptions,
    singleAxisParsed,
    hasVariants,
  } = axes;

  const [selBase, setSelBase] = useState<string | null>(null);
  const [selTop, setSelTop] = useState<string | null>(null);
  const [selDualSize, setSelDualSize] = useState<string | null>(null);
  const [selMat, setSelMat] = useState<string | null>(null);
  const [selSize, setSelSize] = useState<string | null>(null);

  // Single-axis split: cross-disable based on the other selection.
  const disabledMatIdx = hasSingleAxisSplit && selSize
    ? singleMaterialOptions
        .map((m, i) => (singleAxisParsed.some((p) => p.material === m && p.size === selSize) ? -1 : i))
        .filter((i) => i >= 0)
    : [];
  const disabledSizeIdx = hasSingleAxisSplit && selMat
    ? singleSizeOptions
        .map((s, i) => (singleAxisParsed.some((p) => p.size === s && p.material === selMat) ? -1 : i))
        .filter((i) => i >= 0)
    : [];

  // Dual-axis: cross-disable base × top × size based on existing variants.
  const variantsList = product.size_variants || [];
  const matchesDual = (v: any, b: string | null, t: string | null, s: string | null) =>
    (b == null || (v.base || "").trim() === b) &&
    (t == null || (v.top || "").trim() === t) &&
    (s == null || (v.label || "").trim() === s);
  const disabledBaseIdx = isDualAxis && (selTop || selDualSize)
    ? baseOptions.map((b, i) => (variantsList.some((v: any) => matchesDual(v, b, selTop, selDualSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledTopIdx = isDualAxis && (selBase || selDualSize)
    ? topOptions.map((t, i) => (variantsList.some((v: any) => matchesDual(v, selBase, t, selDualSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledDualSizeIdx = isDualAxis && (selBase || selTop)
    ? dualSizeOptions.map((s, i) => (variantsList.some((v: any) => matchesDual(v, selBase, selTop, s)) ? -1 : i)).filter((i) => i >= 0)
    : [];

  return (
    <>
      {/* Material / finish dropdown(s) */}
      {isDualAxis ? (
        <>
          <ExpandableSpec
            icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
            text={baseOptions.join("\n")}
            placeholder={getBasePlaceholder(product)}
            emphasized
            value={selBase != null ? Math.max(0, baseOptions.indexOf(selBase)) : undefined}
            onChange={(idx) => {
              const v = baseOptions[idx] ?? null;
              setSelBase(v);
              onMaterialChange?.(v);
              if (v && selTop && !variantsList.some((x: any) => matchesDual(x, v, selTop, selDualSize))) setSelTop(null);
              if (v && selDualSize && !variantsList.some((x: any) => matchesDual(x, v, selTop, selDualSize))) setSelDualSize(null);
            }}
            disabledIndices={disabledBaseIdx}
            helperText={
              disabledBaseIdx.length > 0 && (selTop || selDualSize)
                ? `Some ${(getBasePlaceholder(product) || "base").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                : undefined
            }
          />
          <ExpandableSpec
            icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
            text={topOptions.join("\n")}
            placeholder={getTopPlaceholder(product)}
            emphasized
            value={selTop != null ? Math.max(0, topOptions.indexOf(selTop)) : undefined}
            onChange={(idx) => {
              const v = topOptions[idx] ?? null;
              setSelTop(v);
              if (v && selBase && !variantsList.some((x: any) => matchesDual(x, selBase, v, selDualSize))) setSelBase(null);
              if (v && selDualSize && !variantsList.some((x: any) => matchesDual(x, selBase, v, selDualSize))) setSelDualSize(null);
            }}
            disabledIndices={disabledTopIdx}
            helperText={
              disabledTopIdx.length > 0 && (selBase || selDualSize)
                ? `Some ${(getTopPlaceholder(product) || "top").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                : undefined
            }
          />
        </>
      ) : hasSingleAxisSplit ? (
        <ExpandableSpec
          icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
          text={singleMaterialOptions.join("\n")}
          placeholder={getMaterialPlaceholder(product)}
          emphasized
          value={selMat != null ? Math.max(0, singleMaterialOptions.indexOf(selMat)) : undefined}
          onChange={(idx) => {
            const m = singleMaterialOptions[idx] ?? null;
            setSelMat(m);
            onMaterialChange?.(m);
            if (m && selSize && !singleAxisParsed.some((p) => p.material === m && p.size === selSize)) setSelSize(null);
          }}
          disabledIndices={disabledMatIdx}
          helperText={
            disabledMatIdx.length > 0 && selSize
              ? `Some materials aren't offered in ${selSize} — greyed out.`
              : undefined
          }
        />
      ) : product.materials ? (
        (() => {
          const parsed = parseMaterialsFallback(product.materials);
          return (
            <ExpandableSpec
              icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
              text={product.materials}
              placeholder={getMaterialPlaceholder(product)}
              autoSplit
              autoDetectedHint
              onChange={(idx) => onMaterialChange?.(parsed[idx] ?? null)}
            />
          );
        })()
      ) : null}

      {/* Size dropdown */}
      {isDualAxis && dualSizeOptions.length > 0 ? (
        <ExpandableSpec
          icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
          text={dualSizeOptions.join("\n")}
          emphasized
          placeholder="Select your size"
          value={selDualSize != null ? Math.max(0, dualSizeOptions.indexOf(selDualSize)) : undefined}
          onChange={(idx) => {
            const s = dualSizeOptions[idx] ?? null;
            setSelDualSize(s);
            if (s && selBase && !variantsList.some((x: any) => matchesDual(x, selBase, selTop, s))) setSelBase(null);
            if (s && selTop && !variantsList.some((x: any) => matchesDual(x, selBase, selTop, s))) setSelTop(null);
          }}
          disabledIndices={disabledDualSizeIdx}
          helperText={
            disabledDualSizeIdx.length > 0 && (selBase || selTop)
              ? `Some sizes aren't available with the current finish selection — greyed out.`
              : undefined
          }
        />
      ) : hasSingleAxisSplit ? (
        <ExpandableSpec
          icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
          text={singleSizeOptions.join("\n")}
          emphasized
          placeholder="Select your size"
          value={selSize != null ? Math.max(0, singleSizeOptions.indexOf(selSize)) : undefined}
          onChange={(idx) => {
            const s = singleSizeOptions[idx] ?? null;
            setSelSize(s);
            if (s && selMat && !singleAxisParsed.some((p) => p.size === s && p.material === selMat)) setSelMat(null);
          }}
          disabledIndices={disabledSizeIdx}
          helperText={
            disabledSizeIdx.length > 0 && selMat
              ? `Some sizes aren't available in ${selMat} — greyed out.`
              : undefined
          }
        />
      ) : hasVariants && !isDualAxis && singleAxisParsed.length > 1 && (() => {
        const labels = Array.from(new Set(singleAxisParsed.map((p) => p.size).filter(Boolean)));
        return labels.length > 1 ? (
          <ExpandableSpec
            icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
            text={labels.join("\n")}
            emphasized
            placeholder="Select your size"
          />
        ) : product.dimensions ? (
          <ExpandableSpec icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />} text={product.dimensions} />
        ) : null;
      })()}
      {!hasVariants && product.dimensions && (
        <ExpandableSpec icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />} text={product.dimensions} />
      )}
    </>
  );
};

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
  const [bioExpanded, setBioExpanded] = useState(false);
  const [galleryActiveIndex, setGalleryActiveIndex] = useState<number | undefined>(undefined);

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
  const { rawSubcategory, normalizedSubcategory, normalizedParentCategory } =
    normalizeCategoryContext(product.subcategory);

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
    // Extend to the end of the sentence containing the 480-char mark so we never cut mid-thought.
    const sentenceEnd = cleaned.slice(480).search(/[.!?](\s|$)/);
    if (sentenceEnd !== -1) return cleaned.slice(0, 480 + sentenceEnd + 1).trim();
    return cleaned.slice(0, 480).replace(/\s+\S*$/, "") + "…";
  })();

  // Carousel: 3 visible at a time
  const visibleCount = 3;
  const maxIndex = Math.max(0, relatedPicks.length - visibleCount);
  const safeIndex = Math.min(relatedIndex, maxIndex);
  const visibleRelated = relatedPicks.slice(safeIndex, safeIndex + visibleCount);

  // Per-product finish → gallery image index mapping. When a buyer picks a finish
  // in the materials/base dropdown, we jump the gallery to the most relevant photo.
  // Keys are normalized (lowercased, alphanumerics only); values are 0-based image indices.
  const FINISH_IMAGE_MAP: Record<string, Record<string, number>> = {
    // Apparatus Studio — Lantern Table Lamp: image #5 (the swatch board) when
    // the buyer picks "Tarnished Silver [Lacquered]".
    "apparatus-studio:lantern-table-lamp-table-lamp": {
      tarnishedsilverlacquered: 4,
      tarnishedsilver: 4,
    },
  };
  const normFinish = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const productFinishMap =
    FINISH_IMAGE_MAP[`${designer.slug}:${productSlug}`] || null;

  const [galleryActiveIndex, setGalleryActiveIndex] = useState<number | undefined>(undefined);
  const handleMaterialChange = (label: string | null) => {
    if (!label || !productFinishMap) return;
    const idx = productFinishMap[normFinish(label)];
    if (typeof idx === "number" && idx >= 0 && idx < images.length) {
      setGalleryActiveIndex(idx);
    }
  };

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
          <Breadcrumbs
            items={buildProductBreadcrumbs({
              root: { label: "Home", to: "/" },
              category: product.category,
              subcategory: product.subcategory,
              title: product.title,
            })}
            className="mb-6"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            <div className="relative">
              <ProductImageGallery
                images={images}
                alt={product.title}
                activeIndex={galleryActiveIndex}
                overlay={
                  computeVariantAxes(product.size_variants).hasVariants || product.description ? (
                    <div className="flex flex-col items-end gap-2">
                      {computeVariantAxes(product.size_variants).hasVariants && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-background border border-[hsl(var(--gold)/0.4)] px-2.5 py-1 font-body text-[9px] uppercase tracking-[0.18em] text-foreground/80 shadow-sm">
                          <span className="h-1 w-1 rounded-full bg-[hsl(var(--gold))]" aria-hidden="true" />
                          Bespoke available
                        </span>
                      )}
                      {product.description ? (
                        <div className="hidden md:block">
                          <LightboxDescriptionDropdown description={product.description} />
                        </div>
                      ) : null}
                    </div>
                  ) : null
                }
              />
            </div>

            <div className="relative flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to={`/designers/${designer.slug}?from_product=${encodeURIComponent(location.pathname + location.search)}`}
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

              {/* Materials & dimensions with gold icons — shared parsing with TradeProductPage */}
              <div className="flex flex-col gap-2">
                <VariantSelectors product={product} onMaterialChange={handleMaterialChange} />

                {(() => {
                  const handcrafted = formatHandcrafted(product.origin, product.lead_time);
                  return handcrafted ? (
                    <ExpandableSpec
                      icon={<Sparkles size={14} className="text-[hsl(var(--gold))]" />}
                      text={handcrafted}
                    />
                  ) : null;
                })()}
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
              <p className="font-body text-[11px] text-muted-foreground text-center mt-1">
                Looking for a bespoke version?{" "}
                <Link
                  to={`/contact?subject=${encodeURIComponent(`Bespoke inquiry — ${product.title} by ${designerDisplay}`)}&message=${encodeURIComponent(`Hello, I'd like to inquire about a bespoke version of:\n\n• ${product.title}${product.subtitle ? ` (${product.subtitle})` : ""}\n• Designer: ${designerDisplay}\n• Page: https://www.maisonaffluency.com${location.pathname}\n\nPlease share customisation possibilities (materials, dimensions, finishes), lead time, and pricing.`)}#contact`}
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Contact our concierge →
                </Link>
              </p>
            </div>
          </div>

          {relatedPicks.length > 0 && (
            <div className="mt-16 pt-8 border-t border-border">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Mobile-only heading: shown above the carousel */}
                <div className="lg:hidden order-1">
                  <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {(product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title))) ? "From the Same Maker" : "From the Same Designer"}
                  </p>
                  <h2 className="font-display text-2xl leading-tight">
                    <Link
                      to={`/designers/${designer.slug}?from_product=${encodeURIComponent(location.pathname + location.search)}`}
                      className="hover:text-primary transition-colors"
                    >
                      {designerDisplay}
                    </Link>
                  </h2>
                </div>

                {/* Carousel: swipeable on mobile, paginated 3-up on desktop. */}
                <div className="lg:col-span-8 flex flex-col order-2 lg:order-2">
                  {/* Mobile: native horizontal scroll-snap carousel */}
                  <div className="lg:hidden -mx-4 px-4">
                    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {relatedPicks.map((rp) => (
                        <Link
                          key={rp.id}
                          to={`/designers/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
                          state={{ from: location.pathname + location.search }}
                          className="group block shrink-0 basis-[70%] snap-start"
                        >
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted/30 border border-border">
                            <img
                              src={rp.image_url}
                              alt={rp.title}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <p className="font-body text-xs text-muted-foreground mt-2 text-center truncate">
                            {rp.title}
                          </p>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Desktop: 3-up grid */}
                  <div className="hidden lg:grid grid-cols-3 gap-4 md:gap-6">
                    {visibleRelated.map((rp) => (
                      <Link
                        key={rp.id}
                        to={`/designers/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
                        state={{ from: location.pathname + location.search }}
                        className="group block"
                      >
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/40 transition-colors">
                          <img
                            src={rp.image_url}
                            alt={rp.title}
                            className={cn(
                              "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
                              rp.hover_image_url ? "group-hover:opacity-0" : "group-hover:scale-105"
                            )}
                            loading="lazy"
                          />
                          {rp.hover_image_url && (
                            <img
                              src={rp.hover_image_url}
                              alt={rp.title}
                              className="absolute inset-0 w-full h-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <p className="font-body text-xs text-muted-foreground mt-2 text-center group-hover:text-foreground transition-colors truncate">
                          {rp.title}
                        </p>
                      </Link>
                    ))}
                  </div>

                  {/* Desktop pagination: centered dots with arrows on the right */}
                  {relatedPicks.length > visibleCount && (
                    <div className="hidden lg:flex mt-6 relative items-center justify-center">
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

                {/* Brand summary — above carousel on desktop, below on mobile */}
                <div className="lg:col-span-4 lg:pr-4 order-3 lg:order-1">
                  <div className="hidden lg:block">
                    <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      {(product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title))) ? "From the Same Maker" : "From the Same Designer"}
                    </p>
                    <h2 className="font-display text-2xl md:text-3xl leading-tight mb-5">
                      <Link
                        to={`/designers/${designer.slug}?from_product=${encodeURIComponent(location.pathname + location.search)}`}
                        className="hover:text-primary transition-colors"
                      >
                        {designerDisplay}
                      </Link>
                    </h2>
                  </div>
                  {brandSummary && (() => {
                    const PREVIEW_LEN = 240;
                    const needsToggle = brandSummary.length > PREVIEW_LEN;
                    let preview = brandSummary;
                    if (needsToggle) {
                      const slice = brandSummary.slice(0, PREVIEW_LEN);
                      const lastSpace = slice.lastIndexOf(" ");
                      preview = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim() + "…";
                    }
                    const shown = bioExpanded || !needsToggle ? brandSummary : preview;
                    return (
                      <div>
                        <p className="font-body text-sm text-foreground/75 leading-relaxed text-justify">
                          {renderParagraph(shown)}
                        </p>
                        {needsToggle && (
                          <button
                            type="button"
                            onClick={() => setBioExpanded((v) => !v)}
                            className="mt-2 inline-flex items-center gap-1 font-body text-[11px] uppercase tracking-[0.15em] text-foreground hover:text-primary transition-colors"
                          >
                            {bioExpanded ? "Read less" : "Read more"}
                            <ChevronDown
                              size={12}
                              className={cn("transition-transform duration-200", bioExpanded && "rotate-180")}
                            />
                          </button>
                        )}
                      </div>
                    );
                  })()}
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
