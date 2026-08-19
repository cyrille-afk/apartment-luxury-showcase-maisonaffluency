import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { X, FileDown, Heart, Scale, ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import FavoriteFolderPicker from "@/components/FavoriteFolderPicker";

import { isProductUpholstered } from "@/lib/upholstery";

import { getBasePlaceholder, getTopPlaceholder, formatVariantAxisLabel, isDimensionAxisLabel } from "@/lib/variantPlaceholders";
import { formatDimensionsMultiline, formatImperialDimensions, splitDimensionQualifier, withImperialPerLine } from "@/lib/formatDimensions";
import { formatHandcrafted } from "@/lib/formatHandcrafted";
import { looksLikeDimension } from "@/lib/rugPricing";
import { useDesignerByName } from "@/hooks/useDesigner";
import { buildProductFinishMap, resolveFinishImageIndex, resolveVariantImageIndex } from "@/lib/variantImageMap";
import { rememberProductBackRef } from "@/lib/designerBackRef";
import { computeVariantAxes } from "@/lib/parseSizeVariants";
import { supabase } from "@/integrations/supabase/client";
import SpecGlyph from "@/components/product/SpecGlyph";
import { usePublicRrp, formatPublicRrp } from "@/hooks/usePublicRrp";
import { FadeInImage } from "@/components/ui/FadeInImage";

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

/**
 * Elegant editorial dimensions grid.
 * Input lines come from `withImperialPerLine`, e.g.
 *   "Ø 90 × H 92 cm | Ø 35.4 × H 36.2 in — M/H 90"
 * and are rendered as clean selectable option buttons.
 */
const DimensionsButtonGrid = ({
  text,
  selectedIndex,
  onSelect,
}: {
  text: string;
  selectedIndex?: number | null;
  onSelect?: (idx: number) => void;
}) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const parsed = lines.map((line) => {
    const { dim, qual } = splitDimensionQualifier(line);
    const [metric, imperial] = dim.split(" | ").map((s) => s.trim());
    return { metric, imperial: imperial || null, qual };
  });

  return (
    <div>
      <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-2.5">
        {parsed.length > 1 ? "Dimensions available" : "Dimensions"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {parsed.map((d, i) => {
          const selected = selectedIndex === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(i)}
              className={cn(
                "text-left px-3 py-2.5 border transition-colors",
                selected
                  ? "border-foreground/60 bg-background"
                  : "border-border/60 bg-transparent hover:border-foreground/40"
              )}
            >
              <p className="font-body text-sm leading-snug text-foreground">
                {d.metric}
              </p>
              {d.imperial && (
                <p className="font-body text-[11px] text-muted-foreground mt-0.5">
                  {d.imperial}
                </p>
              )}
              {d.qual && (
                <p className="font-body text-[10px] text-muted-foreground/70 mt-0.5">
                  {d.qual}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

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
  const prefersReducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const closeTimerRef = useRef<number | null>(null);
  const closeStartedRef = useRef(false);
  const closedRef = useRef(false);
  const finishClose = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    onClose();
  }, [onClose]);
  const requestClose = useCallback(() => {
    if (closeStartedRef.current) return;
    closeStartedRef.current = true;
    setVisible(false);
    closeTimerRef.current = window.setTimeout(finishClose, prefersReducedMotion ? 180 : 420);
  }, [finishClose, prefersReducedMotion]);
  // If the parent swaps in a new product while we're still mounted, reopen and
  // reset the close lifecycle. iOS/PWA occasionally misses framer-motion's exit
  // callback; the timeout above guarantees the invisible overlay is unmounted.
  useEffect(() => {
    if (!propProduct?.id) return;
    closeStartedRef.current = false;
    closedRef.current = false;
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setVisible(true);
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [propProduct?.id]);
  const overlayMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12, ease: "linear" as const } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.25 } };
  const panelMotion = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.12, ease: "linear" as const } }
    : {
        initial: { opacity: 0, y: 40, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 20, scale: 0.98 },
        transition: { duration: 0.3, type: "spring" as const, stiffness: 300, damping: 30 },
      };
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

  // Publicly visible RRP (only for products flagged public_rrp_visible, e.g. Apparatus).
  const { data: publicRrp } = usePublicRrp(product?.id);
  const publicPriceLabel = formatPublicRrp(publicRrp);

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
  const [selectedStaticDimIdx, setSelectedStaticDimIdx] = useState<number | null>(null);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setSelectedBaseIdx(null);
    setSelectedTopIdx(null);
    setSelectedMaterialIdx(null);
    setSelectedSingleSizeIdx(null);
    setSelectedSingleMaterialIdx(null);
    setSelectedSizeLabel(null);
    setSelectedStaticDimIdx(null);
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
  // Default to the first gallery image (matches the product page hero) rather
  // than the curator-pick thumbnail, which is often a padded/portrait crop.
  const defaultImageUrl = galleryImages[0] || product.image_url;
  const currentImageUrl = finishImageIdx != null ? galleryImages[finishImageIdx] : defaultImageUrl;
  
  const isUpholsteredProduct = isProductUpholstered({
    category: product.category,
    subcategory: product.subcategory,
    title: product.title,
    product_name: product.title,
    is_upholstered: product.is_upholstered,
  });

  /* ── Linked product page URL (only when designer slug resolves) ───── */
  const productPageDesignerSlug = product.designer_slug || linkedDesigner?.slug;
  const isDagmarClamChairFinishCard =
    productPageDesignerSlug === "dagmar-london" &&
    /^clam chair(?:,|\s|$)/i.test(product.title) &&
    /^(?:oiled|fumed)\s+/i.test(product.subtitle || "");
  const productPageSlug = isDagmarClamChairFinishCard
    ? "clam-chair"
    : slugifyProduct(product.title + (product.subtitle ? `-${product.subtitle}` : ""));
  const productPageHref = productPageDesignerSlug
    ? `/designers/${productPageDesignerSlug}/${productPageSlug}`
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

  const relatedStrip = (
                relatedProducts.length > 0 ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    More from {product.designer_slug === "dagmar-london" && product.subtitle?.trim() === "Arnold Madsen" ? "Dagmar" : designerDisplay}
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
                  className="grid grid-cols-4 gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory scroll-smooth"
                >
                  {relatedProducts.map((rp) => (
                    <button
                      key={rp.id}
                      onClick={() => onSelectRelated?.(rp)}
                      title={rp.title}
                      className="min-w-0 w-full group snap-start"
                    >
                      <div className="relative">
                        <FadeInImage
                          wrapperClassName="aspect-square bg-muted/30 border border-border group-hover:border-foreground/30 transition-colors"
                          src={rp.image_url}
                          alt={rp.title}
                          className="object-cover"
                          loading="lazy"
                        />
                        {/* Elegant fade-in label overlay on hover */}
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-background/95 to-background/0 px-1.5 pt-4 pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <span className="block font-body text-[9px] leading-tight text-foreground text-center">
                            {rp.title}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null
  );


  const content = (
    <AnimatePresence onExitComplete={finishClose}>
      {visible && (
      <motion.div
        key="pp-lightbox-overlay"
        {...overlayMotion}
        className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-6 lg:p-8"
        onClick={requestClose}
      >
        <motion.div
          {...panelMotion}
          className="relative w-full max-w-6xl h-dvh max-h-dvh md:h-auto md:max-h-[95vh] mx-auto bg-background shadow-2xl overflow-y-auto flex flex-col min-h-0"
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
              onClick={requestClose}
              className="p-2.5 rounded-full bg-foreground/15 text-foreground hover:bg-foreground/25 active:bg-foreground/30 transition-all"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Desktop close */}
          <button
            onClick={requestClose}
            className="hidden md:flex absolute z-20 p-2 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-all"
            style={{
              top: "max(0.75rem, env(safe-area-inset-top))",
              right: "max(0.75rem, env(safe-area-inset-right))",
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Strict editorial grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-stretch max-w-6xl mx-auto p-5 md:p-8 w-full h-full">

            {/* LEFT COLUMN — hero image + related thumbnails only */}
            <div className="relative w-full flex flex-col gap-6">
              <div className="relative w-full shrink-0 flex items-start justify-center">
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
                        "w-full h-auto object-contain md:max-h-[58vh] transition-opacity duration-300",
                        imageFailed || !imageLoaded ? "opacity-0" : "opacity-100"
                      )}
                    />
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

              {/* Related thumbnails sit directly under the main image */}
              <div className="w-full shrink-0">
                {relatedStrip}
              </div>
            </div>

            {/* RIGHT COLUMN — specs card, narrative description, CTAs */}
            <div className="w-full flex flex-col h-full md:pl-10 md:border-l md:border-border/40">

              {/* Stone card — brand, dimensions, finishes, handcrafted details, narrative */}
              <div className="bg-muted/40 border border-border/60 p-4 flex flex-col gap-3">
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
                    className="font-body text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer text-left"
                  >
                    {designerDisplay}
                  </button>
                  <h2 className="font-display text-base md:text-xl text-foreground mt-1 leading-tight">
                    {product.title}
                  </h2>
                  {product.subtitle && product.subtitle.trim() !== designerDisplay?.trim() && (
                    <p className="font-body text-[11px] md:text-xs text-muted-foreground mt-1">
                      {product.subtitle}
                    </p>
                  )}
                  {publicPriceLabel && (
                    <p className="font-display text-base md:text-lg text-foreground mt-2 leading-none">
                      {publicPriceLabel}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-3">
                  {(() => {
                    const sv = product.size_variants || [];
                    const isDualAxis = sv.length > 0 && sv.some((v) => v.base && v.base.trim()) && sv.some((v) => v.top && v.top.trim());

                    let sizeLabels: string[] = [];
                    if (sv.length > 0) {
                      sizeLabels = Array.from(
                        new Set(sv.map((v) => (v.label || "").trim()).filter(Boolean))
                      );
                    }
                    if (sizeLabels.length < 2 && !isDualAxis && baseOnlyIsDim && baseOnlyOptions.length >= 2) {
                      sizeLabels = baseOnlyOptions;
                    }
                    const dimCount = sizeLabels.filter(looksLikeDimension).length;
                    const showSizePicker = sizeLabels.length >= 2 && dimCount >= 2 && dimCount >= Math.ceil(sizeLabels.length / 2);

                    if (showSizePicker) {
                      const selectedIdx = selectedSizeLabel != null ? Math.max(0, sizeLabels.indexOf(selectedSizeLabel)) : null;
                      return (
                        <DimensionsButtonGrid
                          text={withImperialPerLine(sizeLabels.join("\n"))}
                          selectedIndex={selectedIdx}
                          onSelect={(idx) => setSelectedSizeLabel(sizeLabels[idx] ?? null)}
                        />
                      );
                    }

                    // Fallback: static dimensions.
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
                      <DimensionsButtonGrid
                        text={withImperialPerLine(dimText)}
                        selectedIndex={selectedStaticDimIdx}
                        onSelect={(idx) => setSelectedStaticDimIdx(idx)}
                      />
                    );
                  })()}

                  {(() => {
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
                      <div className="border-t border-border/60 py-2 flex items-center gap-4">
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
                      <div className="border-t border-border/60 py-2 flex items-start gap-4">
                        {specIcon("✦", "mt-0.5")}
                        <div className="font-body text-sm leading-relaxed text-muted-foreground font-normal">
                          <p>{originLine}</p>
                          {leadLine && <p className="mt-0.5">{leadLine}</p>}
                        </div>
                      </div>
                    );
                  })()}

                  {product.description && product.description.trim().length > 0 && (
                    <div className="pt-1">
                      <p className="font-body text-sm leading-relaxed text-foreground text-left whitespace-pre-wrap">
                        {product.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* CTA block pinned to the bottom of the right column */}
              <div className="mt-auto flex flex-col gap-4">
                {/* Primary CTA */}
                <div className="flex flex-col gap-2">
                  {productPageHref ? (
                    <button
                      type="button"
                      onClick={() => {
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
                      {publicPriceLabel || "Price Upon Request"}
                    </a>
                  )}
                  {productPageHref && (
                    <p className="text-center font-body text-[10px] tracking-wide text-muted-foreground/80">
                      See all photos, finishes & specifications
                    </p>
                  )}
                </div>

                {/* Secondary actions */}
                <div className="hidden md:grid grid-cols-3 gap-2 items-stretch">
                  <FavoriteFolderPicker pickId={product.id} align="start" side="top">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      title={favorited ? "Manage folders" : "Favorite"}
                      className={cn(
                        "w-full h-10 flex items-center justify-center gap-1.5 px-3 font-body text-[10px] uppercase tracking-[0.14em] transition-colors border",
                        favorited
                          ? "border-foreground/40 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                      )}
                    >
                      <Heart size={13} strokeWidth={1.5} className={cn(favorited && "fill-current")} />
                      {favorited ? "Saved" : "Favorite"}
                    </button>
                  </FavoriteFolderPicker>

                  <button
                    onClick={() => togglePin(compareItem)}
                    title={pinned ? "Pinned" : "Pin to Selection"}
                    className={cn(
                      "w-full h-10 flex items-center justify-center gap-1.5 px-3 font-body text-[10px] uppercase tracking-[0.14em] transition-colors border",
                      pinned
                        ? "border-foreground/40 text-foreground"
                        : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                    )}
                  >
                    <Scale size={13} strokeWidth={1.5} />
                    {pinned ? "Pinned" : "Pin to Selection"}
                  </button>

                  {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0)) && (
                    <SpecSheetButton
                      pdfUrl={product.pdf_url}
                      pdfUrls={product.pdf_urls}
                      brandName={designerDisplay}
                      productName={product.title}
                      variant="button"
                      icon={<FileDown size={13} strokeWidth={1.5} />}
                      className="w-full h-10 flex items-center justify-center gap-1.5 px-3 font-body text-[10px] uppercase tracking-[0.14em] transition-colors border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 cursor-pointer"
                      onBeforeOpen={() => { let allowed = false; requireAuth(() => { allowed = true; }, "download this spec sheet"); return allowed; }}
                    />
                  )}
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="font-body text-[11px] text-muted-foreground">
                    To unlock Your Trade pricing,{" "}
                    <a href="/trade-program" className="underline underline-offset-2 hover:text-foreground transition-colors">
                      join our Trade Program
                    </a>.
                  </p>
                </div>
              </div>
            </div>

          </div> {/* end scrollable mobile body */}
        </motion.div>
      </motion.div>
      )}
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
