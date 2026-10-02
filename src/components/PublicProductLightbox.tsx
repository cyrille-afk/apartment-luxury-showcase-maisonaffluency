import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { X, FileDown, Heart, Scale, ArrowRight, ChevronLeft, ChevronRight, Award, Compass, FileText, Info } from "lucide-react";
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
import { usePublicRrp, usePublicRrpDisplay, formatPublicRrp } from "@/hooks/usePublicRrp";
import { FadeInImage } from "@/components/ui/FadeInImage";
import { useAccountDiscount } from "@/hooks/useAccountDiscount";
import { useTradeProductPricing } from "@/hooks/useTradeProductPricing";
import { effectiveDiscountForBrand, useBrandDiscountCaps } from "@/lib/brandDiscountCap";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import { formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { buildProductCuratorNotes } from "@/lib/productCuratorNotes";

/** Mirrors the slugifier used by FeaturedDesigners + PublicProductPage.
 *  Accents are transliterated (GÉLULE → gelule) so the generated URL matches
 *  the resolver in publicProductPageQuery — otherwise the link 404s. */
export const slugifyProduct = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
  /** False for gallery-only hotspot details with no verified catalog product page. */
  is_catalog_item?: boolean;
  /** Gallery pin for a trade-only designer: never link into their restricted catalogue. */
  restricted_gallery_pin?: boolean;
}

interface Props {
  product: PublicLightboxItem | null;
  allPicks?: PublicLightboxItem[];
  onClose: () => void;
  onSelectRelated?: (item: PublicLightboxItem) => void;
  /** When true, render inline instead of portaling to document.body */
  inline?: boolean;
  /** Gallery-only contextual presentation without a viewport backdrop. */
  contextualPanel?: boolean;
  /** Opt-in category-discovery variant (Shop by Room). When set, the bottom
   *  row lists pieces from the SAME subcategory (ranked by material affinity)
   *  under this heading instead of "More from [Designer]". Omit to keep the
   *  original designer-based behaviour used by Gallery / Designers. */
  categoryDiscovery?: { heading: (item: PublicLightboxItem) => string };
}

const normSub = (s?: string | null) => (s || "").trim().toLowerCase().replace(/s\b/g, "");
const materialTokens = (p: PublicLightboxItem) =>
  new Set(
    `${p.materials || ""} ${p.materials_description || ""}`
      .toLowerCase()
      .match(/[a-z]{4,}/g) || [],
  );

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


const PublicProductLightbox = ({ product: propProduct, allPicks = [], onClose, onSelectRelated, inline, contextualPanel = false, categoryDiscovery }: Props) => {
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
      !propProduct.description ||
      propProduct.is_upholstered === undefined;
    if (!needsHydration) return;
    supabase
      .from("designer_curator_picks_public" as any)
      .select("size_variants, variant_placeholder, base_axis_label, top_axis_label, gallery_images, variant_image_map, materials_description, origin, lead_time, dimensions, gallery_captions, is_upholstered, description")
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
      description: propProduct.description ?? variantPayload.description ?? null,
    };
  }, [propProduct, variantPayload]);

  // Curator Notes — derived from the ACTIVE product so they update whenever a
  // "More from" thumbnail swaps the lightbox item.
  const curatorNotes = useMemo(() => {
    if (!product) return { significance: "", spatial: "", provenance: "" };
    return buildProductCuratorNotes({
      title: product.title,
      brandName: product.brand_name,
      description: product.description,
      dimensions: product.dimensions,
      category: product.category,
      subcategory: product.subcategory,
    });
  }, [product]);


  // Resolve canonical designer slug (same hook used by product pages)
  const designerDisplayName = product
    ? (product.brand_name.includes(" - ")
        ? product.brand_name.split(" - ")[0].trim()
        : product.brand_name)
    : undefined;
  const { data: linkedDesigner } = useDesignerByName(product?.restricted_gallery_pin ? undefined : designerDisplayName);

  // Publicly visible RRP (only for products flagged public_rrp_visible, e.g. Apparatus).
  const { data: publicRrp } = usePublicRrp(product?.restricted_gallery_pin ? undefined : product?.id);
  const { displayRow: publicRrpDisplayRow } = usePublicRrpDisplay(publicRrp);
  const publicPriceLabel = formatPublicRrp(publicRrpDisplayRow);
  const accountDiscount = useAccountDiscount();
  const { showTradePrice, tierLabel } = useTradePriceMode();
  const showMemberTradePrice = accountDiscount.eligible && showTradePrice;
  const { data: tradePricing } = useTradeProductPricing(product?.restricted_gallery_pin ? undefined : product?.id, showMemberTradePrice && !product?.restricted_gallery_pin);
  const brandDiscountCaps = useBrandDiscountCaps(showMemberTradePrice);
  const [tradeDisplayCurrency] = useTradeDisplayCurrency();
  const fxRates = useFxRates();

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
    if (!product || contextualPanel) return;
    const wasAlreadyHidden = document.body.style.overflow === "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      if (!wasAlreadyHidden) document.body.style.overflow = "";
    };
  }, [product, contextualPanel]);

  const [relatedSlide, setRelatedSlide] = useState(0);
  useEffect(() => { setRelatedSlide(0); }, [product?.id]);
  const relatedProducts = useMemo(() => {
    if (!product || product.restricted_gallery_pin) return [];
    if (categoryDiscovery) {
      // Manual curation override: the Living Room Orsay MDS hero pairs with a
      // fixed sequence of curved/organic coffee tables — bypass the algorithm.
      const ORSAY_OVERRIDE: string[] = [
        "3ce33be9-0069-494d-9f32-3798aaae7a8b", // Lady R low table — Luca Erba
        "2b14f835-4e5a-4a94-b72b-f01cdbde622d", // IBO low table — Christophe Delcourt
        "2725daad-9691-4490-8559-7feabc37407c", // Retrofuture Coffee Table
        "4f8ff691-0e75-4fbc-b132-273169bf3a35", // Coral Coffee Table
        "e7dc377b-1ab5-4280-ae46-ebac3da24088", // Quark Bronze Coffee Table
        "a8e2a22c-4edf-412b-8a91-435a69d7a577", // Clash Coffee Table — Adam Court
        "e0a1fb7d-33fe-4539-a075-24d4c9713e4a", // Borghese Coffee Table — Noé Duchaufour-Lawrance
        "b843a391-8803-4a7d-b326-ccaf30b16214", // Anemos Coffee Table
      ];
      if (product.id === "dce5f7d0-fb49-41f7-8bc5-176ff32fceae") {
        const byId = new Map(allPicks.map((p) => [p.id, p]));
        const curated = ORSAY_OVERRIDE.map((id) => byId.get(id)).filter((p): p is PublicLightboxItem => !!p && !!p.image_url && !p.restricted_gallery_pin);
        if (curated.length === ORSAY_OVERRIDE.length) return curated;
      }
      const sub = normSub(product.subcategory);
      const cat = normSub(product.category);
      const heroMat = materialTokens(product);
      const pool = allPicks.filter((p) => p.id !== product.id && p.image_url && !p.restricted_gallery_pin);
      let same = sub ? pool.filter((p) => normSub(p.subcategory) === sub) : [];
      if (same.length === 0 && cat) same = pool.filter((p) => normSub(p.category) === cat);
      // Form & Materiality ranking: organic/rounded silhouettes rank above
      // strictly linear/rectangular/angular pieces so the visible row matches
      // the curved language of the room vignettes.
      const ORGANIC = /\b(round|rounded|curve[ds]?|curvilinear|organic|biomorphic|oval|ellipse|elliptical|drum|arc|arch|sphere|spherical|pebble|cloud|wave|wavy|blob|sculptural|fluid|soft[- ]edged|circular|cylinder|cylindrical|moon|orb)\b/i;
      const ANGULAR = /\b(rectangular|rectangle|square|linear|sharp[- ]angled|sharp|geometric|block|cube|cubic|grid|rigid|angular|straight[- ]edged|slab)\b/i;
      const formScore = (p: PublicLightboxItem) => {
        const text = [p.title, p.subtitle, p.description, p.materials].filter(Boolean).join(" ");
        if (ORGANIC.test(text)) return 2;
        if (ANGULAR.test(text)) return -2;
        return 0;
      };
      const score = (p: PublicLightboxItem) => {
        let n = 0;
        materialTokens(p).forEach((t) => { if (heroMat.has(t)) n++; });
        return n + formScore(p);
      };
      return same
        .map((p, i) => ({ p, s: score(p), f: formScore(p), i }))
        // Tie-break on form score before catalogue order so a verified-organic
        // piece always beats a neutral one at equal total score.
        .sort((a, b) => b.s - a.s || b.f - a.f || a.i - b.i)
        .slice(0, 8)
        .map((x) => x.p);
    }
    const candidates = allPicks.filter((p) => p.id !== product.id && p.image_url);
    // Vary selection per product using a simple hash offset
    const hash = product.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const offset = hash % Math.max(candidates.length, 1);
    const picked: PublicLightboxItem[] = [];
    for (let i = 0; i < Math.min(4, candidates.length); i++) {
      picked.push(candidates[(offset + i) % candidates.length]);
    }
    return picked;
  }, [product?.id, allPicks, categoryDiscovery]);

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
  const selectedVariantPriceCents = (() => {
    if (!selectedSizeLabel) return null;
    const match = sv.find((variant) =>
      [variant.label, variant.base].some((label) => label?.trim() === selectedSizeLabel.trim()),
    );
    return typeof match?.price_cents === "number" && match.price_cents > 0
      ? match.price_cents
      : null;
  })();
  const baseRetailPriceCents = selectedVariantPriceCents
    ?? tradePricing?.rrp_price_cents
    ?? tradePricing?.trade_price_cents
    ?? null;
  const effectiveTradeDiscount = effectiveDiscountForBrand(
    accountDiscount.pct,
    product.brand_name,
    brandDiscountCaps,
  );
  const netTradePriceCents = baseRetailPriceCents && baseRetailPriceCents > 0
    ? Math.round(baseRetailPriceCents * (1 - effectiveTradeDiscount.pct))
    : null;
  const tradeCurrency = (tradePricing?.currency || "EUR").toUpperCase();
  const formatTradePrice = (cents: number) => formatPriceConverted(
    cents,
    tradeCurrency,
    tradeDisplayCurrency,
    fxRates,
    tradePricing?.price_unit || undefined,
  );
  const capPercent = effectiveTradeDiscount.capPct == null
    ? null
    : `${Number((effectiveTradeDiscount.capPct * 100).toFixed(2))}%`;
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
  const productPageHref = product.is_catalog_item !== false && productPageDesignerSlug
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
                    {categoryDiscovery ? categoryDiscovery.heading(product) : <>More from {product.designer_slug === "dagmar-london" && product.subtitle?.trim() === "Arnold Madsen" ? "Dagmar" : designerDisplay}</>}
                  </p>
                  {relatedProducts.length > 4 && (() => {
                    const maxSlide = relatedProducts.length - 4;
                    const btn = (off: boolean) => cn("flex size-7 items-center justify-center rounded-full border transition-all", off ? "cursor-not-allowed border-border/40 text-muted-foreground/40" : "border-border text-foreground hover:bg-muted/40");
                    return (
                      <div className="flex items-center gap-1.5">
                        <button type="button" onClick={() => setRelatedSlide((i) => Math.max(0, i - 1))} disabled={relatedSlide === 0} aria-label="Previous alternatives" className={btn(relatedSlide === 0)}>
                          <ChevronLeft className="size-3.5" strokeWidth={1.5} />
                        </button>
                        <button type="button" onClick={() => setRelatedSlide((i) => Math.min(maxSlide, i + 1))} disabled={relatedSlide >= maxSlide} aria-label="Next alternatives" className={btn(relatedSlide >= maxSlide)}>
                          <ChevronRight className="size-3.5" strokeWidth={1.5} />
                        </button>
                      </div>
                    );
                  })()}
                </div>
                <div className="relative w-full overflow-hidden">
                  <div
                    className="flex gap-x-4 transition-transform duration-500 ease-out will-change-transform"
                    style={{ transform: `translateX(calc(-${relatedSlide * 25}% - ${relatedSlide * 4}px))` }}
                  >
                    {relatedProducts.map((rp) => (
                      <button
                        key={rp.id}
                        type="button"
                        onClick={() => onSelectRelated?.(rp)}
                        title={rp.title}
                        className="group flex w-[calc(25%-12px)] shrink-0 flex-col text-left"
                      >
                        <div className="mb-3 flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-[hsl(var(--alternative-frame))]">
                          <img src={rp.image_url} alt={rp.title} loading="lazy" className="max-h-[88%] max-w-[88%] object-contain mix-blend-multiply transition-transform group-hover:scale-[1.02]" />
                        </div>
                        <span className="mb-0.5 whitespace-normal break-words font-body text-[12px] font-bold uppercase leading-tight tracking-wider text-foreground">{rp.brand_name}</span>
                        <span className="whitespace-normal break-words font-body text-[12px] font-light leading-snug text-muted-foreground">{rp.title}</span>
                      </button>
                    ))}
                  </div>
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
        className={cn(
          "flex justify-center",
          contextualPanel
            ? "pointer-events-none absolute inset-x-0 top-0 z-30 items-start"
            : "fixed inset-0 z-[10000] items-stretch bg-foreground/60 backdrop-blur-sm md:items-center md:p-6 lg:p-8"
        )}
        onClick={contextualPanel ? undefined : requestClose}
      >
        <motion.div
          {...panelMotion}
          className={cn(
            "relative mx-auto flex w-full flex-col bg-background",
            contextualPanel
              ? "pointer-events-auto h-auto max-w-none overflow-visible border border-border/60 shadow-2xl"
              : "max-w-6xl h-dvh max-h-dvh min-h-0 overflow-y-auto shadow-2xl md:h-auto md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile header */}
          <div
            className={cn("md:hidden sticky top-0 z-20 flex items-center justify-between bg-background/90 border-b border-border/60 shrink-0", !contextualPanel && "backdrop-blur-sm")}
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

           {/* Upper two-column editorial block — grows with the dimensions and actions */}
          <div className={cn("mx-auto flex w-full max-w-6xl flex-col p-4 md:p-6", contextualPanel && "h-auto max-h-none overflow-visible")}>
             <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:items-start md:gap-8">

              {/* LEFT COLUMN — standardized hero image container */}
               <div className="relative flex w-full min-h-0 items-center justify-center md:max-h-[300px]">
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
                         "h-auto w-full object-contain transition-opacity duration-300 md:max-h-[300px]",
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

              {/* RIGHT COLUMN — specs card + CTAs */}
               <div className="flex w-full flex-col md:border-l md:border-border/40 md:pl-8">
                 <div className="pr-1">

              {/* Stone card — brand, dimensions, finishes, handcrafted details */}
              <div className="bg-muted/40 border border-border/60 p-5 flex flex-col gap-4">
                <div>
                  {product.restricted_gallery_pin ? (
                    <span className="font-body text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--gold))]">{designerDisplay}</span>
                  ) : <button
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
                  </button>}
                  <h2 className="font-display text-base md:text-xl text-foreground mt-1 leading-tight">
                    {product.title}
                  </h2>
                  {product.subtitle && product.subtitle.trim() !== designerDisplay?.trim() && (
                    <p className="font-body text-[11px] md:text-xs text-muted-foreground mt-1">
                      {product.subtitle}
                    </p>
                  )}
                  {showMemberTradePrice && netTradePriceCents ? (
                    <div className="mt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-base md:text-lg leading-none text-foreground tabular-nums">
                          {formatTradePrice(netTradePriceCents)}
                        </p>
                        <span className="font-body text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                          Net Trade Price
                        </span>
                        {effectiveTradeDiscount.capped && capPercent && (
                          <TooltipProvider delayDuration={160}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Brand margin notice"
                                  className="h-6 w-6 rounded-full text-muted-foreground/70 hover:bg-muted hover:text-foreground"
                                >
                                  <Info className="h-3.5 w-3.5" strokeWidth={1.5} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent
                                side="bottom"
                                align="start"
                                sideOffset={8}
                                className="z-[10020] w-[min(340px,calc(100vw-2rem))] rounded-none border-border/70 bg-background/98 px-4 py-3 shadow-xl backdrop-blur-md"
                              >
                                <p className="font-body text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                                  Brand Margin Notice
                                </p>
                                <p className="mt-2 font-body text-xs leading-relaxed text-foreground/85">
                                  This masterwork is handcrafted under strict heritage atelier licenses. Due to the limited artisan production scale and brand pricing structures, this piece qualifies for a specialized trade discount of <strong className="font-semibold text-foreground">{capPercent}</strong> rather than your standard <strong className="font-semibold text-foreground">{tierLabel} Tier rate</strong>.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {baseRetailPriceCents && (
                        <p className="mt-1 font-body text-[10px] tracking-[0.04em] text-muted-foreground">
                          <span className="line-through decoration-muted-foreground/50">
                            Retail: {formatTradePrice(baseRetailPriceCents)}
                          </span>
                        </p>
                      )}
                    </div>
                  ) : publicPriceLabel && (
                    <p className="font-display text-base md:text-lg text-foreground mt-2 leading-none">
                      {publicPriceLabel}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-1">
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

                </div>
              </div>
            </div>

              {/* CTA block */}
              <div className="shrink-0 pt-3">
                <div className="flex flex-col gap-4">
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
                      Explore piece
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
                  {!showMemberTradePrice && (
                    <a
                      href="/trade-program"
                      className="border border-border/60 bg-background px-4 py-3 text-center font-body text-[9px] uppercase leading-relaxed tracking-[0.18em] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      Exclusive trade privileges available. Join our Trade Program to unlock pricing mutations.
                    </a>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Curator Notes — immediate context below the product details */}
          <motion.div
            key={`curator-notes-${product.id}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="w-full border-t border-border/40 mt-3 md:mt-4 pt-3 md:pt-4 pb-3 md:pb-4"
          >
            <h3 className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-4">
              Curator Notes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8">
              <div className="flex gap-4">
                <Award className="h-4 w-4 shrink-0 mt-2 text-muted-foreground/60" strokeWidth={1.5} />
                <div>
                  <p className="mb-2.5 inline-flex items-center rounded-[1px] bg-muted px-3 py-1.5 font-body text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
                    Design Significance
                  </p>
                  <p className="font-body text-xs leading-normal text-foreground/85">
                    {curatorNotes.significance}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <Compass className="h-4 w-4 shrink-0 mt-2 text-muted-foreground/60" strokeWidth={1.5} />
                <div>
                  <p className="mb-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Spatial Calculation
                  </p>
                  <p className="font-body text-xs leading-normal text-foreground/85">
                    {curatorNotes.spatial}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <FileText className="h-4 w-4 shrink-0 mt-2 text-muted-foreground/60" strokeWidth={1.5} />
                <div>
                  <p className="mb-2.5 py-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Historical Provenance
                  </p>
                  <p className="font-body text-xs leading-normal text-foreground/85">
                    {curatorNotes.provenance}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* More From — final exploration tier */}
          {!product.restricted_gallery_pin && <div className="w-full border-t border-border/40 pt-3 md:pt-4 pb-2 md:pb-3">
            {relatedStrip}
          </div>}
        </div>
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
