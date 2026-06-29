import { motion, AnimatePresence } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { X, FileDown, Heart, Scale, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import ExpandableSpec from "@/components/ExpandableSpec";
import FavoriteFolderPicker from "@/components/FavoriteFolderPicker";

import { isProductUpholstered } from "@/lib/upholstery";

import { getBasePlaceholder, getTopPlaceholder, formatVariantAxisLabel, isDimensionAxisLabel } from "@/lib/variantPlaceholders";
import { formatDimensionsMultiline, formatImperialDimensions, withImperialPerLine } from "@/lib/formatDimensions";
import { formatHandcrafted } from "@/lib/formatHandcrafted";
import { looksLikeDimension } from "@/lib/rugPricing";
import { useDesignerByName } from "@/hooks/useDesigner";
import { buildProductFinishMap, resolveFinishImageIndex, resolveVariantImageIndex } from "@/lib/variantImageMap";
import { rememberProductBackRef } from "@/lib/designerBackRef";
import { computeVariantAxes } from "@/lib/parseSizeVariants";
import { supabase } from "@/integrations/supabase/client";
import SpecGlyph from "@/components/product/SpecGlyph";

/** Mirrors the slugifier used by FeaturedDesigners + PublicProductPage. */
const slugifyProduct = (s: string) =>
  s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const specIcon = (symbol: string, className = "") => (
  <SpecGlyph symbol={symbol} className={className} />
);

export interface PublicLightboxItem {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url: string;
  hover_image_url?: string | null;
  brand_name: string;
  materials?: string | null;
  /** Free-form description that renders as a plain legend (Layers icon) instead of being parsed as a materials dropdown. Takes precedence over `materials` when set. */
  materials_description?: string | null;
  dimensions?: string | null;
  lead_time?: string | null;
  origin?: string | null;
  description?: string | null;
  category?: string | null;
  subcategory?: string | null;
  pdf_url?: string | null;
  pdf_urls?: PdfEntry[] | null;
  designer_slug?: string | null;
  size_variants?: { label?: string; base?: string; top?: string; price_cents?: number }[] | null;
  variant_placeholder?: string | null;
  base_axis_label?: string | null;
  top_axis_label?: string | null;
  /** Full product gallery; used together with variant_image_map to swap the lightbox image when a finish is picked. */
  gallery_images?: string[] | null;
  /** Maps normalized finish labels → gallery_images index. */
  variant_image_map?: Record<string, number> | null;
  /** Per-image captions keyed by gallery_images index. */
  gallery_captions?: Record<string, string> | null;
  is_upholstered?: boolean | null;
}

interface Props {
  product: PublicLightboxItem | null;
  allPicks?: PublicLightboxItem[];
  onClose: () => void;
  onSelectRelated?: (item: PublicLightboxItem) => void;
  /** When true, render inline instead of portaling to document.body */
  inline?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Tiny localStorage-backed favorites (no auth needed)                */
/* ------------------------------------------------------------------ */
const LS_KEY = "public_favorites";

function readLocalFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function writeLocalFavorites(ids: Set<string>) {
  localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  window.dispatchEvent(new Event("public_favorites_changed"));
}

function useLocalFavorites() {
  const [ids, setIds] = useState<Set<string>>(() => readLocalFavorites());
  const hasShownPromptRef = useRef(false);

  const isFavorited = useCallback((id: string) => ids.has(id), [ids]);

  const toggleFavorite = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      const wasAdding = !next.has(id);
      if (next.has(id)) next.delete(id); else next.add(id);
      writeLocalFavorites(next);

      // After 3+ favourites, prompt to register so they persist
      if (wasAdding && next.size >= 3 && !hasShownPromptRef.current) {
        hasShownPromptRef.current = true;
        import("sonner").then(({ toast }) =>
          toast("Save your favourites permanently", {
            description: "Create a free account so your favourites sync across devices.",
            action: {
              label: "Sign up",
              onClick: () => window.location.assign("/trade-program"),
            },
            duration: 8000,
          })
        );
      }

      return next;
    });
  }, []);

  return { isFavorited, toggleFavorite };
}

/* ------------------------------------------------------------------ */

const PublicProductLightbox = ({ product: propProduct, allPicks = [], onClose, onSelectRelated, inline }: Props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();
  const { isFavorited, toggleFavorite } = useLocalFavorites();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showHoverImage, setShowHoverImage] = useState(false);
  const [hoverImageLoaded, setHoverImageLoaded] = useState(false);
  const [variantPayload, setVariantPayload] = useState<Partial<PublicLightboxItem> | null>(null);
  const relatedScrollRef = useRef<HTMLDivElement>(null);
  const scrollRelated = (dir: 1 | -1) => {
    const el = relatedScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(160, el.clientWidth * 0.7), behavior: "smooth" });
  };

  useEffect(() => {
    let cancelled = false;
    setVariantPayload(null);
    if (!propProduct?.id) return;
    const needsHydration =
      !propProduct.size_variants ||
      !propProduct.gallery_images ||
      !propProduct.variant_image_map ||
      !propProduct.materials_description ||
      !propProduct.origin ||
      !propProduct.lead_time ||
      !propProduct.dimensions ||
      propProduct.is_upholstered === undefined;
    if (!needsHydration) return;
    supabase
      .from("designer_curator_picks_public" as any)
      .select("size_variants, variant_placeholder, base_axis_label, top_axis_label, gallery_images, variant_image_map, materials_description, origin, lead_time, dimensions, gallery_captions, is_upholstered")
      .eq("id", propProduct.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setVariantPayload(data as Partial<PublicLightboxItem>);
      });
    return () => { cancelled = true; };
  }, [propProduct?.id, propProduct?.size_variants, propProduct?.gallery_images, propProduct?.variant_image_map]);

  const product = useMemo(() => {
    if (!propProduct) return null;
    if (!variantPayload) return propProduct;
    return {
      ...propProduct,
      size_variants: propProduct.size_variants ?? variantPayload.size_variants ?? null,
      variant_placeholder: propProduct.variant_placeholder ?? variantPayload.variant_placeholder ?? null,
      base_axis_label: propProduct.base_axis_label ?? variantPayload.base_axis_label ?? null,
      top_axis_label: propProduct.top_axis_label ?? variantPayload.top_axis_label ?? null,
      gallery_images: propProduct.gallery_images ?? variantPayload.gallery_images ?? null,
      variant_image_map: propProduct.variant_image_map ?? variantPayload.variant_image_map ?? null,
      materials_description: propProduct.materials_description ?? variantPayload.materials_description ?? null,
      origin: propProduct.origin ?? variantPayload.origin ?? null,
      lead_time: propProduct.lead_time ?? variantPayload.lead_time ?? null,
      dimensions: propProduct.dimensions ?? variantPayload.dimensions ?? null,
      gallery_captions: propProduct.gallery_captions ?? variantPayload.gallery_captions ?? null,
      is_upholstered: propProduct.is_upholstered ?? variantPayload.is_upholstered ?? null,
    };
  }, [propProduct, variantPayload]);


  // Resolve canonical designer slug (same hook used by product pages)
  const designerDisplayName = product
    ? (product.brand_name.includes(" - ")
        ? product.brand_name.split(" - ")[0].trim()
        : product.brand_name)
    : undefined;
  const { data: linkedDesigner } = useDesignerByName(designerDisplayName);

  // Reset per-product state when the product changes (incl. selected finish).
  const [selectedBaseIdx, setSelectedBaseIdx] = useState<number | null>(null);
  const [selectedTopIdx, setSelectedTopIdx] = useState<number | null>(null);
  const [selectedMaterialIdx, setSelectedMaterialIdx] = useState<number | null>(null);
  // Single-axis split (variants encode "size — material" in one label).
  const [selectedSingleSizeIdx, setSelectedSingleSizeIdx] = useState<number | null>(null);
  const [selectedSingleMaterialIdx, setSelectedSingleMaterialIdx] = useState<number | null>(null);
  // Lightbox-only: standalone Size picker for base-only/single-axis products
  // whose labels read as dimensions (e.g. Niko Sofa). Lets users preview the
  // chosen size without leaving for the full product page.
  const [selectedSizeLabel, setSelectedSizeLabel] = useState<string | null>(null);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setHoverImageLoaded(false);
    setShowHoverImage(false);
    setSelectedBaseIdx(null);
    setSelectedTopIdx(null);
    setSelectedMaterialIdx(null);
    setSelectedSingleSizeIdx(null);
    setSelectedSingleMaterialIdx(null);
    setSelectedSizeLabel(null);
  }, [product?.id]);

  // Atomic clear for the dual-axis Base/Top dropdowns inside the lightbox.
  // Wipes both indices in one React batch so the gallery (which derives the
  // current image from base/top together) snaps cleanly back to the primary
  // image instead of partially honouring a stale finish.
  const clearAllDualSelections = () => {
    setSelectedBaseIdx(null);
    setSelectedTopIdx(null);
  };

  // Track whether body overflow was already hidden (e.g. by a parent Gallery lightbox)
  // so we don't clobber it on close.
  useEffect(() => {
    if (!product) return;
    const wasAlreadyHidden = document.body.style.overflow === "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (!wasAlreadyHidden) document.body.style.overflow = "";
    };
  }, [product]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const candidates = allPicks.filter((p) => p.id !== product.id && p.image_url);
    // Vary selection per product using a simple hash offset
    const hash = product.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const offset = hash % Math.max(candidates.length, 1);
    const picked: PublicLightboxItem[] = [];
    for (let i = 0; i < Math.min(4, candidates.length); i++) {
      picked.push(candidates[(offset + i) % candidates.length]);
    }
    return picked;
  }, [product?.id, allPicks]);

  if (!product) return null;

  const canShowHoverImage = Boolean(product.hover_image_url) && !isMobile;
  const designerDisplay = product.brand_name.includes(" - ")
    ? product.brand_name.split(" - ")[0].trim()
    : product.brand_name;
  const favorited = isFavorited(product.id);

  /* ── Finish-driven image swap ───────────────────────────────────────── */
  const finishMap = buildProductFinishMap(product.variant_image_map);
  const galleryImages = (product.gallery_images || []).filter(Boolean);
  const sv = product.size_variants || [];
  const axes = computeVariantAxes(sv);
  // True dual-axis only when BOTH base and top are populated. Base-only
  // products (e.g. Atelier Pendhapa "Mangala Coffee Table") behave as
  // single-axis on Base — see src/lib/parseSizeVariants.ts.
  const hasAnyBase = axes.isDualAxis || axes.isBaseOnly;
  const isDualAxis = axes.isDualAxis;
  const baseOptions = isDualAxis ? axes.baseOptions : [];
  const topOptionsForResolve = isDualAxis ? axes.topOptions : [];
  // For base-only products, surface the bases through the same dropdown the
  // single-axis material picker uses below.
  const baseOnlyOptions = !isDualAxis && axes.isBaseOnly ? axes.baseOptions : [];
  const baseOnlyIsDim = axes.isBaseOnly && (
    (baseOnlyOptions.length > 0 && baseOnlyOptions.every(looksLikeDimension)) ||
    isDimensionAxisLabel(product.base_axis_label)
  );
  // When single-axis labels actually encode (size × material) we render TWO
  // dropdowns (material + size) mirroring TradeProductPage — the catalog
  // legend must always match the product sheet.
  const hasSingleAxisSplit = axes.hasSingleAxisSplit;
  const singleSplitSizes = hasSingleAxisSplit ? axes.singleSizeOptions : [];
  const singleSplitMaterials = hasSingleAxisSplit ? axes.singleMaterialOptions : [];
  const materialOptions = hasSingleAxisSplit
    ? singleSplitMaterials
    : !isDualAxis && axes.isBaseOnly
      ? baseOnlyOptions
      : !isDualAxis && product.materials
        ? product.materials.split("\n").map((s) => s.trim()).filter(Boolean)
        : [];
  // Resolve which gallery image matches the current selection.
  let finishImageIdx: number | undefined;
  if (finishMap && galleryImages.length > 0) {
    if (isDualAxis) {
      const topLabel =
        selectedTopIdx != null && selectedTopIdx >= 0
          ? topOptionsForResolve[selectedTopIdx]
          : topOptionsForResolve.length === 1
            ? topOptionsForResolve[0]
            : null;
      const baseLabel =
        selectedBaseIdx != null && selectedBaseIdx >= 0
          ? baseOptions[selectedBaseIdx]
          : baseOptions.length === 1
            ? baseOptions[0]
            : null;
      finishImageIdx = resolveVariantImageIndex(finishMap, {
        base: baseLabel,
        top: topLabel,
        variants: sv,
        imageCount: galleryImages.length,
        requireCompletePair: true,
      });
    } else if (hasSingleAxisSplit) {
      // Look up the matched variant's full raw label so the composite
      // (size × material) key in variant_image_map resolves correctly.
      const mat = selectedSingleMaterialIdx != null && selectedSingleMaterialIdx >= 0
        ? singleSplitMaterials[selectedSingleMaterialIdx]
        : null;
      const size = selectedSingleSizeIdx != null && selectedSingleSizeIdx >= 0
        ? singleSplitSizes[selectedSingleSizeIdx]
        : null;
      if (mat || size) {
        const match = axes.singleAxisParsed.find(
          (p) => (!mat || p.material === mat) && (!size || p.size === size),
        );
        const rawLabel = match?.variant?.label || null;
        finishImageIdx = resolveVariantImageIndex(finishMap, {
          label: rawLabel,
          variants: sv,
          imageCount: galleryImages.length,
          requireCompletePair: false,
        });
      }
    } else if (selectedMaterialIdx != null && selectedMaterialIdx >= 0) {
      const v = materialOptions[selectedMaterialIdx];
      if (v) {
        finishImageIdx = resolveVariantImageIndex(finishMap, {
          base: hasAnyBase ? v : null,
          label: v,
          imageCount: galleryImages.length,
          requireCompletePair: false,
        });
      }
    }
  }
  const currentImageUrl = finishImageIdx != null ? galleryImages[finishImageIdx] : product.image_url;
  const imageSwappedByFinish = currentImageUrl !== product.image_url;
  const isUpholsteredProduct = isProductUpholstered({
    category: product.category,
    subcategory: product.subcategory,
    title: product.title,
    product_name: product.title,
    is_upholstered: product.is_upholstered,
  });

  /* ── Linked product page URL (only when designer slug resolves) ───── */
  const productPageDesignerSlug = product.designer_slug || linkedDesigner?.slug;
  const productPageHref = productPageDesignerSlug
    ? `/designers/${productPageDesignerSlug}/${slugifyProduct(product.title + (product.subtitle ? `-${product.subtitle}` : ""))}`
    : null;

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

  const content = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
          className="relative max-w-4xl w-full h-dvh max-h-dvh md:h-auto md:max-h-[90vh] md:flex-row bg-background/85 backdrop-blur-xl md:rounded-xl rounded-none shadow-2xl overflow-hidden flex flex-col min-h-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile header */}
          <div
            className="md:hidden sticky top-0 z-20 flex items-center justify-between bg-background/90 backdrop-blur-sm border-b border-border/60 shrink-0"
            style={{
              paddingTop: "max(0.75rem, env(safe-area-inset-top))",
              paddingBottom: "0.5rem",
              paddingLeft: "max(1rem, env(safe-area-inset-left))",
              paddingRight: "max(1rem, env(safe-area-inset-right))",
            }}
          >
            <div className="w-10" />
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            <button
              onClick={onClose}
              className="p-2.5 rounded-full bg-foreground/15 text-foreground hover:bg-foreground/25 active:bg-foreground/30 transition-all"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Desktop close */}
          <button
            onClick={onClose}
            className="hidden md:flex absolute z-20 p-2 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-all"
            style={{
              top: "max(0.75rem, env(safe-area-inset-top))",
              right: "max(0.75rem, env(safe-area-inset-right))",
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Scrollable mobile body */}
          <div className="flex-1 min-h-0 overflow-y-auto md:flex md:flex-row md:overflow-visible">

          {/* Image + desktop description column */}
          <div className="relative w-full md:w-1/2 shrink-0 bg-muted/30 md:flex md:flex-col md:min-h-[400px]">
          <div
            className="relative w-full h-[42dvh] max-h-[340px] md:h-auto md:flex-1 shrink-0 flex items-center justify-center p-2 md:p-8"
            onMouseEnter={() => { if (canShowHoverImage) setShowHoverImage(true); }}
            onMouseLeave={() => setShowHoverImage(false)}
          >
            {product.image_url ? (
              <>
                {!imageLoaded && !imageFailed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-lg bg-muted animate-pulse" />
                  </div>
                )}
                {imageFailed && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="font-body text-sm text-muted-foreground">Image unavailable</span>
                  </div>
                )}
                <img
                  key={currentImageUrl /* re-mount on finish swap so loader resets */}
                  src={currentImageUrl}
                  alt={product.title}
                  onLoad={() => { setImageLoaded(true); setImageFailed(false); }}
                  onError={() => { setImageFailed(true); setImageLoaded(true); }}
                  className={cn(
                    "w-full h-full object-contain transition-opacity duration-300",
                    imageFailed ? "opacity-0"
                      : !imageLoaded ? "opacity-0"
                        : showHoverImage && canShowHoverImage && hoverImageLoaded && !imageSwappedByFinish ? "opacity-0"
                          : "opacity-100"
                  )}
                />
                {canShowHoverImage && product.hover_image_url && !imageSwappedByFinish && (
                  <img
                    src={product.hover_image_url}
                    alt={`${product.title} in context`}
                    onLoad={() => setHoverImageLoaded(true)}
                    onError={() => setHoverImageLoaded(false)}
                    className={cn(
                      "absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-300",
                      showHoverImage && hoverImageLoaded ? "opacity-100" : "opacity-0"
                    )}
                  />
                )}
              </>
            ) : (
              <span className="font-body text-sm text-muted-foreground">No image</span>
            )}

            {/* Image caption */}
            {(() => {
              const idx = finishImageIdx ?? 0;
              const cap = product.gallery_captions?.[String(idx)];
              return cap ? (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 max-w-[85%]">
                  <span className="font-body text-[11px] text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full border border-border/30 block text-center whitespace-nowrap overflow-hidden text-ellipsis">
                    {cap}
                  </span>
                </div>
              ) : null;
            })()}

            {/* Description overlay on image — mobile only (desktop renders inline below) */}
            <div className="md:hidden absolute top-3 right-3 z-20">
              <LightboxDescriptionDropdown description={product.description} />
            </div>


            {/* Mobile: secondary action icons */}
            <div className="md:hidden absolute bottom-3 left-3 z-10 flex gap-3.5">
              <FavoriteFolderPicker pickId={product.id} align="start" side="top">
                <button
                  onClick={(e) => e.stopPropagation()}
                  title={favorited ? "Manage folders" : "Favorite"}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md transition-all shadow-md",
                    favorited
                      ? "bg-destructive/80 text-white"
                      : "bg-background/70 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Heart size={15} className={cn(favorited && "fill-current")} />
                </button>
              </FavoriteFolderPicker>


              <button
                onClick={() => togglePin(compareItem)}
                title={pinned ? "Pinned" : "Pin to Selection"}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md transition-all shadow-md",
                  pinned
                    ? "bg-[hsl(var(--gold))]/80 text-white"
                    : "bg-background/70 text-muted-foreground hover:text-foreground",
                  compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                )}
              >
                <Scale size={15} />
              </button>

              {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0)) && (
                <SpecSheetButton
                  pdfUrl={product.pdf_url}
                  pdfUrls={product.pdf_urls}
                  brandName={designerDisplay}
                  productName={product.title}
                  variant="icon"
                  onBeforeOpen={() => { let allowed = false; requireAuth(() => { allowed = true; }, "download this spec sheet"); return allowed; }}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(var(--pdf-red))] backdrop-blur-md text-white transition-all shadow-md cursor-pointer"
                />
              )}
            </div>
          </div>

          {/* Desktop: description rendered directly under the image (SEO-friendly, fills empty space) */}
          {product.description && product.description.trim().length > 0 && (
            <div className="hidden md:block relative px-8 pb-4 pt-1">
              {/* Always-open "Creation" pill, top-left of the text */}
              <div className="mb-3">
                <span className="inline-block font-body text-[10px] uppercase tracking-[0.18em] text-foreground/80 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full border border-border/40 shadow-sm">
                  Creation
                </span>
              </div>
              <p className="font-body text-[13px] leading-[1.55] text-foreground/80 text-justify hyphens-auto whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          )}
          </div>

          {/* Details */}
          <div className="flex-1 min-h-0 p-5 md:p-8 flex flex-col gap-3 md:gap-4 md:overflow-y-auto">
            <div>
              <button
                type="button"
                onClick={() => {
                  if (!linkedDesigner?.slug) return;
                  rememberProductBackRef(linkedDesigner.slug, location.pathname + location.search);
                  onClose();
                  navigate(`/designers/${linkedDesigner.slug}`);
                }}
                disabled={!linkedDesigner?.slug}
                className="font-body text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer text-left"
              >
                {designerDisplay}
              </button>
              <h2 className="font-display text-lg md:text-2xl text-foreground mt-1 leading-tight">
                {product.subtitle
                  ? `${product.title} ${product.subtitle}`
                  : product.title}
              </h2>
            </div>

            <div className="flex flex-col">
              {(() => {
                // Prefer a real Size dropdown when size_variants encode
                // multiple distinct size labels. Falls back to a static list
                // (curated dimensions or derived) otherwise.
                const sv = product.size_variants || [];
                const isDualAxis = sv.length > 0 && sv.some((v) => v.base && v.base.trim()) && sv.some((v) => v.top && v.top.trim());

                // Build the candidate size-label list. Works for single-axis,
                // base-only AND dual-axis (e.g. Angelo M Side Table where
                // each variant has size label + base/top finishes).
                let sizeLabels: string[] = [];
                if (sv.length > 0) {
                  sizeLabels = Array.from(
                    new Set(sv.map((v) => (v.label || "").trim()).filter(Boolean))
                  );
                }
                // Base-only fallback when explicit labels are absent.
                if (sizeLabels.length < 2 && !isDualAxis && baseOnlyIsDim && baseOnlyOptions.length >= 2) {
                  sizeLabels = baseOnlyOptions;
                }
                const dimCount = sizeLabels.filter(looksLikeDimension).length;
                const showSizePicker = sizeLabels.length >= 2 && dimCount >= 2 && dimCount >= Math.ceil(sizeLabels.length / 2);

                if (showSizePicker) {
                  return (
                    <ExpandableSpec
                      icon={specIcon("📐")}
                      text={withImperialPerLine(sizeLabels.join("\n"))}
                      emphasized
                      placeholder="Select Your Size"
                      value={selectedSizeLabel != null ? Math.max(0, sizeLabels.indexOf(selectedSizeLabel)) : null}
                      onChange={(idx) => {
                        setSelectedSizeLabel(idx < 0 ? null : sizeLabels[idx] ?? null);
                      }}
                    />
                  );
                }

                // Fallback: static dimension list (legacy preview behavior).
                let dimText = (product.dimensions || "").trim();
                if (!dimText) {
                  if (isDualAxis) {
                    const dualLabels = Array.from(new Set(sv.map((v) => (v.label || "").trim()).filter(Boolean))).filter(looksLikeDimension);
                    if (dualLabels.length > 0) dimText = dualLabels.join("\n");
                    else {
                      const baseDims = Array.from(new Set(sv.map((v) => (v.base || "").trim()).filter(Boolean))).filter(looksLikeDimension);
                      if (baseDims.length > 0) dimText = baseDims.join("\n");
                    }
                  } else if (sv.length > 0) {
                    const labels = sizeLabels.filter(looksLikeDimension);
                    if (labels.length > 0) dimText = labels.join("\n");
                  }
                  if (!dimText && baseOnlyIsDim && baseOnlyOptions.length > 0) {
                    dimText = baseOnlyOptions.join("\n");
                  }
                }
                if (!dimText) return null;
                return (
                  <ExpandableSpec
                    icon={specIcon("📐")}
                    text={withImperialPerLine(dimText)}
                    emphasized
                  />
                );
              })()}

              {(() => {
                // Finish/material axis — always render as a static "refer to
                // the full product page" line in the lightbox so users land on
                // the configurator on the real product page instead of
                // interacting with a half-wired picker here.
                const sv = product.size_variants || [];
                const isDualAxis = sv.length > 0 && sv.some((v) => v.base && v.base.trim()) && sv.some((v) => v.top && v.top.trim());
                const baseIsDim = (baseOptions.length > 0 && baseOptions.every(looksLikeDimension)) || isDimensionAxisLabel(product.base_axis_label);
                const topOptions = isDualAxis
                  ? Array.from(new Set(sv.map((v) => (v.top || "").trim()).filter(Boolean)))
                  : [];
                const topIsDim = (topOptions.length > 0 && topOptions.every(looksLikeDimension)) || isDimensionAxisLabel(product.top_axis_label);

                const hasFinishAxis =
                  isUpholsteredProduct ||
                  (isDualAxis && (!baseIsDim || !topIsDim)) ||
                  (!isDualAxis && materialOptions.length > 0 && !(materialOptions.length === 1 && looksLikeDimension(materialOptions[0]))) ||
                  (!!product.materials_description && product.materials_description.trim().length > 0);

                if (!hasFinishAxis) return null;
                return (
                  <div className="border-t border-border/60 py-4 flex items-center gap-5">
                    <span className="shrink-0"><SpecGlyph symbol="⬗" /></span>
                    <span className="font-body text-sm text-muted-foreground">
                      Finish options — refer to the full product page for details.
                    </span>
                  </div>
                );
              })()}

              {(() => {
                const handcrafted = formatHandcrafted(product.origin, product.lead_time);
                if (!handcrafted) return null;
                let originLine = handcrafted;
                let leadLine: string | null = null;
                const dotSplit = handcrafted.split(" · ");
                if (dotSplit.length === 2) {
                  originLine = dotSplit[0];
                  leadLine = dotSplit[1];
                } else {
                  const m = handcrafted.match(/^(Handcrafted in .+?)\s+in\s+(.+)$/i);
                  if (m) {
                    originLine = m[1];
                    leadLine = `Production lead time: ${m[2]}`;
                  }
                }
                return (
                  <div className="mt-2 border-t border-b border-border/60 py-4 flex items-start gap-5">
                    {specIcon("✦", "mt-0.5")}
                    <div className="font-body text-sm leading-relaxed text-muted-foreground font-normal">
                      <p>{originLine}</p>
                      {leadLine && <p className="mt-0.5">{leadLine}</p>}
                    </div>
                  </div>
                );
              })()}
            </div>


            {/* Primary CTA — visit the full product page (more images, full spec, gallery) */}
            <div className="mt-auto pt-3 md:pt-4 flex flex-col gap-2">
              {productPageHref ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    navigate(productPageHref, {
                      state: { from: location.pathname + location.search },
                    });
                  }}
                  className="group flex items-center justify-center gap-2 px-5 py-3 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  View full product page
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <a
                  href="/trade-program"
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  Price Upon Request
                </a>
              )}
              {productPageHref && (
                <p className="text-center font-body text-[10px] tracking-wide text-muted-foreground/80">
                  See all photos, finishes & specifications
                </p>
              )}
            </div>

            {/* Desktop secondary actions */}
            <div className="hidden md:grid grid-cols-3 gap-2">
              <FavoriteFolderPicker pickId={product.id} align="start" side="top">
                <button
                  onClick={(e) => e.stopPropagation()}
                  title={favorited ? "Manage folders" : "Favorite"}
                  className={cn(
                    "w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                    favorited
                      ? "border-destructive/30 text-destructive bg-destructive/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <Heart size={13} className={cn(favorited && "fill-current")} />
                  {favorited ? "Saved" : "Favorite"}
                </button>
              </FavoriteFolderPicker>


              <button
                onClick={() => togglePin(compareItem)}
                title={pinned ? "Pinned" : "Pin to Selection"}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                  pinned
                    ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                )}
              >
                <Scale size={13} />
                {pinned ? "Pinned" : "Pin to Selection"}
              </button>

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

            {/* More from this designer */}
            {relatedProducts.length > 0 && (
              <div className="pt-4 border-t border-border">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    More from {designerDisplay}
                  </p>
                  {relatedProducts.length > 4 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => scrollRelated(-1)}
                        aria-label="Scroll left"
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollRelated(1)}
                        aria-label="Scroll right"
                        className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <div
                  ref={relatedScrollRef}
                  className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide snap-x snap-mandatory scroll-smooth"
                >
                  {relatedProducts.map((rp) => (
                    <button
                      key={rp.id}
                      onClick={() => onSelectRelated?.(rp)}
                      className="shrink-0 w-20 group snap-start"
                    >
                      <div className="aspect-square rounded-md overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/30 transition-colors">
                        <img
                          src={rp.image_url}
                          alt={rp.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <p className="font-body text-[9px] text-muted-foreground mt-1 truncate group-hover:text-foreground transition-colors">
                        {rp.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-border">
              <p className="font-body text-[11px] text-muted-foreground">
                For pricing and availability, please{" "}
                <a href="/trade-program" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  join our Trade Program
                </a>.
              </p>
            </div>
          </div>
          </div> {/* end scrollable mobile body */}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  return (
    <>
      {inline ? content : createPortal(content, document.body)}
      <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    </>
  );
};

export default PublicProductLightbox;
