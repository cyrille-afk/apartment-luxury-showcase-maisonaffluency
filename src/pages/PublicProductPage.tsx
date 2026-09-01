import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link, useLocation, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, Pin, FileText, Layers, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, Truck, Loader2, ShoppingBag } from "lucide-react";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { useIsMobile } from "@/hooks/use-mobile";
import { isPwaStandaloneDisplay } from "@/lib/pwaMode";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import ShareMenu from "@/components/ShareMenu";
import CornerTooltip from "@/components/product/CornerTooltip";
import { buildPieceOgUrl } from "@/lib/whatsapp-share";
import { cloudinaryUrl } from "@/lib/cloudinary";
import { formatProductSubtitleLine, isFinishSubtitle } from "@/lib/subtitleDisplay";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { fetchPublicProductPage, prefetchPublicProductPage, PUBLIC_PRODUCT_PAGE_STALE_TIME } from "@/lib/publicProductPageQuery";
import ProductPrefetchOnVisible from "@/components/ProductPrefetchOnVisible";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";
import FinishesPdfButton from "@/components/product/FinishesPdfButton";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import { cn } from "@/lib/utils";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ProductDetailSkeleton from "@/components/product/ProductDetailSkeleton";
import { normalizeCategoryContext } from "@/lib/categoryNormalization";
import { formatDesignerDisplayName } from "@/lib/designerDisplayName";
import { formatEditionLabel } from "@/lib/editionLabel";
import { renderParagraph } from "@/components/EditorialBiography";
import { formatDimensionsMultiline, formatImperialDimensions, withImperialPerLine, withImperialStacked } from "@/lib/formatDimensions";
import ExpandableSpec from "@/components/ExpandableSpec";
import LegendDisclosure from "@/components/LegendDisclosure";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { categoryUrl } from "@/lib/categorySlugs";
import { buildProductBreadcrumbs } from "@/lib/productBreadcrumbs";
import { getBasePlaceholder, getTopPlaceholder, getMaterialPlaceholder, formatVariantAxisLabel, isDimensionAxisLabel, resolveFinishSectionLabels } from "@/lib/variantPlaceholders";
import { computeVariantAxes, parseMaterialsFallback } from "@/lib/parseSizeVariants";
import { isRugCategory, parseRugDims, looksLikeDimension } from "@/lib/rugPricing";
import FinishSelector from "@/components/FinishSelector";
import { composeOrderFinishLabel } from "@/lib/orderFinishLabel";
import ShippingDetailsAccordion from "@/components/product/ShippingDetailsAccordion";
import OriginStoryDrawer from "@/components/product/OriginStoryDrawer";


import ActiveSwatchCaption from "@/components/product/ActiveSwatchCaption";
import { isProductUpholstered } from "@/lib/upholstery";
import RugSizeColourPicker, { type RugSelection } from "@/components/rug/RugSizeColourPicker";
import { buildProductFinishMap, resolveFinishImageIndex, resolveVariantImageIndex, findVariantForImageIndex } from "@/lib/variantImageMap";
import { resolveAutoDefaultPair } from "@/lib/variantAutoDefault";
import { formatHandcrafted } from "@/lib/formatHandcrafted";
import { rememberProductBackRef } from "@/lib/designerBackRef";
import { toOgImage } from "@/lib/ogImage";
import SpecGlyph from "@/components/product/SpecGlyph";
import AlsoContainsFinishes from "@/components/product/AlsoContainsFinishes";
import FavoriteFolderPicker from "@/components/FavoriteFolderPicker";
import { sanitizeBiographyCitations } from "@/lib/sanitizeBiographyCitations";
import {
  isFinishAxisLabel,
  everyOptionCoveredBySwatches,
  someOptionCoveredBySwatches,
  shouldSuppressSingleAsFinish,
  makeSwatchAxisFilter,
} from "@/lib/finishDuplication";
import { useAuth } from "@/hooks/useAuth";
import StudioSaveButton from "@/components/product/StudioSaveButton";
import { isCollectibleSlug, collectibleGateRedirect } from "@/lib/collectibleGate";
import {
  PublicSpecTable,
  TradeExclusiveCard,
  parseDimensions,
  quantitativeValue,
} from "@/components/product/PublicSpecTable";
import TradeWorkspace from "@/components/product/TradeWorkspace";
import ProductCommerceCta from "@/components/product/ProductCommerceCta";
import TradeFirstCta from "@/components/product/TradeFirstCta";

import StickyPurchaseBar from "@/components/product/StickyPurchaseBar";
import { setStickyProductBarActive } from "@/lib/stickyProductBar";

import TradePendingReviewCard from "@/components/product/TradePendingReviewCard";

import QuoteRequestDialog from "@/components/QuoteRequestDialog";
import { addToCart } from "@/lib/cart";
import { usePublicRrp, usePublicRrpMap, formatPublicRrp, formatPublicRrpCents } from "@/hooks/usePublicRrp";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useProductConfigOptional } from "@/contexts/ProductConfigContext";
import { computeDisplayPrice } from "@/lib/productPricing";
import { UserRoleProvider, useUserRole, DevRoleToggle, type UserRole } from "@/contexts/UserRoleContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";


/* ------------------------------------------------------------------ */
/*  localStorage-backed favorites (mirrors PublicProductLightbox)       */
/* ------------------------------------------------------------------ */
const LS_KEY = "public_favorites";
const specIcon = (symbol: string, className = "") => (
  <SpecGlyph symbol={symbol} className={className} />
);

function readFavs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_KEY) || "[]")); }
  catch { return new Set(); }
}

function slugify(s: string) {
  return s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ------------------------------------------------------------------ */
/*  Finish-name matching (swatch labels vs catalogue variant axes)      */
/* ------------------------------------------------------------------ */
const normFinish = (s: any) => String(s ?? "").trim().toLowerCase();

// Swatch labels ("Apparatus — Marble - Nero Portoro") and variant axis values
// ("Nero Portoro Marble") describe the same finish with different word order
// and a brand prefix, so compare them as token sets.
const finishTokenSet = (s: any) => {
  let t = String(s ?? "").toLowerCase();
  const dashIdx = t.indexOf("—");
  if (dashIdx !== -1) t = t.slice(dashIdx + 1);
  return new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length > 1));
};

// Tolerate a single-character spelling drift between catalogue and swatch
// naming (e.g. "Nero Kinitra" vs "Nero Kinatra").
const nearFinishWord = (a: string, b: string) => {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1 || Math.min(a.length, b.length) < 4) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
};

const sameFinishName = (a: any, b: any) => {
  if (!a || !b) return false;
  if (normFinish(a) === normFinish(b)) return true;
  const A = finishTokenSet(a);
  const B = finishTokenSet(b);
  if (!A.size || !B.size) return false;
  const small = A.size <= B.size ? A : B;
  const large = A.size <= B.size ? B : A;
  for (const w of small) {
    if (![...large].some((x) => nearFinishWord(w, x))) return false;
  }
  return small.size >= 2;
};


/* ------------------------------------------------------------------ */
/*  Data fetching                                                      */
/* ------------------------------------------------------------------ */
interface ProductRow {
  id: string;
  slug?: string | null;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  hover_image_url: string | null;
  gallery_images?: string[] | null;
  materials: string | null;
  materials_description?: string | null;
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
  wood_label_override: string | null;
  variant_image_map: Record<string, number> | null;
  gallery_captions?: Record<string, string> | null;
  is_upholstered?: boolean | null;
}

function useProductBySlug(designerSlug: string | undefined, productSlug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.publicProductPage(designerSlug, productSlug),
    queryFn: () => fetchPublicProductPage(designerSlug, productSlug) as Promise<{
      product: ProductRow;
      designer: { id: string; name: string; slug: string; biography: string };
      relatedPicks: ProductRow[];
    } | null>,
    enabled: !!designerSlug && !!productSlug,
    staleTime: PUBLIC_PRODUCT_PAGE_STALE_TIME,
  });
}


/* ------------------------------------------------------------------ */
/*  Variant selectors (controlled — enables cross-axis disabling)     */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/*  Variant selection state (split into finishes + dimensions panels)  */
/* ------------------------------------------------------------------ */

type VariantSelectorsContextType = {
  product: any;
  axes: ReturnType<typeof computeVariantAxes>;
  finishMap?: Record<string, number> | null;
  selBase: string | null;
  setSelBase: (v: string | null) => void;
  selTop: string | null;
  setSelTop: (v: string | null) => void;
  selDualSize: string | null;
  setSelDualSize: (v: string | null) => void;
  selMat: string | null;
  setSelMat: (v: string | null) => void;
  selSize: string | null;
  setSelSize: (v: string | null) => void;
  hasLinkedFabrics: boolean;
  setHasLinkedFabrics: (v: boolean) => void;
  linkedWoodFinishes: string[];
  setLinkedWoodFinishes: (v: string[]) => void;
  defaultPair: { base: string; top: string } | null;
  baseAxisIsDim: boolean;
  topAxisIsDim: boolean;
  baseAxisLabelRaw: string;
  topAxisLabelRaw: string;
  variantsList: any[];
  matchesDual: (v: any, b: string | null, t: string | null, s: string | null) => boolean;
  disabledBaseIdx: number[];
  disabledTopIdx: number[];
  disabledDualSizeIdx: number[];
  disabledSizeIdx: number[];
  disabledMatIdx: number[];
  baseOnlySizeOptions: string[];
  clearAllDualSelections: () => void;
  handleResetDefault: () => void;
  onMaterialChange?: (label: string | null, opts?: { base?: string | null; top?: string | null; size?: string | null; fromSwatch?: boolean }) => void;
  galleryActiveIndex?: number;
  onSwatchImagesChange?: (imageIndices: number[] | null, meta?: { committed?: boolean; swatchName?: string; jumpOnly?: boolean }) => void;
  onFinishesMissingImagesChange?: (names: string[]) => void;
  onFinishGroupingResolved?: () => void;
  onDisplayedFinishesChange?: (names: { upholstery: string | null; base: string | null; top: string | null }) => void;
};

const VariantSelectorsContext = React.createContext<VariantSelectorsContextType | null>(null);

function useVariantSelectorsContext() {
  const ctx = React.useContext(VariantSelectorsContext);
  if (!ctx) throw new Error("useVariantSelectorsContext must be used within VariantSelectorsProvider");
  return ctx;
}

const VariantSelectorsProvider: React.FC<{
  product: any;
  onMaterialChange?: (label: string | null, opts?: { base?: string | null; top?: string | null; size?: string | null; fromSwatch?: boolean }) => void;
  galleryActiveIndex?: number;
  finishMap?: Record<string, number> | null;
  onSwatchImagesChange?: (imageIndices: number[] | null, meta?: { committed?: boolean; swatchName?: string; jumpOnly?: boolean }) => void;
  onFinishesMissingImagesChange?: (names: string[]) => void;
  onFinishGroupingResolved?: () => void;
  onDisplayedFinishesChange?: (names: { upholstery: string | null; base: string | null; top: string | null }) => void;
  children: React.ReactNode;
}> = ({ product, onMaterialChange, galleryActiveIndex, finishMap, onSwatchImagesChange, onFinishesMissingImagesChange, onFinishGroupingResolved, onDisplayedFinishesChange, children }) => {
  const axes = computeVariantAxes(product.size_variants);
  const {
    isDualAxis,
    isBaseOnly,
    baseOptions,
    topOptions,
    dualSizeOptions,
    hasSingleAxisSplit,
    singleSizeOptions,
    singleMaterialOptions,
    singleAxisParsed,
    hasVariants,
  } = axes;

  // Persist the shopper's configuration so switching audience tabs, signing in
  // to a trade account, or returning to the page keeps the exact variant.
  const persistKey = `ma_variant_sel_${product?.id ?? "unknown"}`;
  const stored = (() => {
    if (typeof window === "undefined") return null;
    try {
      const raw = sessionStorage.getItem(persistKey);
      return raw ? (JSON.parse(raw) as Record<string, string | null>) : null;
    } catch {
      return null;
    }
  })();

  const [selBase, setSelBase] = useState<string | null>(stored?.base ?? null);
  const [selTop, setSelTop] = useState<string | null>(stored?.top ?? null);
  const [hasLinkedFabrics, setHasLinkedFabrics] = useState(false);
  const [linkedWoodFinishes, setLinkedWoodFinishes] = useState<string[]>([]);

  const [selDualSize, setSelDualSize] = useState<string | null>(stored?.dualSize ?? null);
  const [selMat, setSelMat] = useState<string | null>(stored?.mat ?? null);
  const [selSize, setSelSize] = useState<string | null>(stored?.size ?? null);
  const [defaultPair, setDefaultPair] = useState<{ base: string; top: string } | null>(null);

  // Mirror the finish selection into the container engine so the trade
  // dashboard variant and this editorial variant share one selection.
  const finishConfig = useProductConfigOptional();
  useEffect(() => {
    finishConfig?.setSelectedWoodFinish(selBase);
  }, [finishConfig, selBase]);
  useEffect(() => {
    finishConfig?.setSelectedUpholstery(selTop);
  }, [finishConfig, selTop]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        persistKey,
        JSON.stringify({ base: selBase, top: selTop, dualSize: selDualSize, mat: selMat, size: selSize }),
      );
    } catch {
      /* storage unavailable — selection simply isn't persisted */
    }
  }, [persistKey, selBase, selTop, selDualSize, selMat, selSize]);


  useEffect(() => {
    if (galleryActiveIndex === undefined || !finishMap) return;
    const variants = (product.size_variants || []) as { label?: string; base?: string; top?: string }[];
    const match = findVariantForImageIndex(finishMap, variants, galleryActiveIndex);
    if (!match) return;
    if (isDualAxis || isBaseOnly) {
      if ((match.base ?? null) !== selBase) setSelBase(match.base);
      if (isDualAxis && (match.top ?? null) !== selTop) setSelTop(match.top);
      if (isDualAxis && match.label && match.label !== selDualSize) setSelDualSize(match.label);
    } else if (hasSingleAxisSplit) {
      const parsed = singleAxisParsed.find((p) => p.variant?.label === match.label);
      const nextMat = parsed?.material ?? null;
      if (nextMat && nextMat !== selMat) setSelMat(nextMat);
      if (parsed?.size && parsed.size !== selSize) setSelSize(parsed.size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryActiveIndex, product?.id]);

  useEffect(() => {
    if (!isDualAxis || selBase || selTop) return;
    const variants = product.size_variants || [];
    if (!variants.length || !baseOptions.length) return;
    const pair = resolveAutoDefaultPair(variants);
    if (!pair) return;
    setSelBase(pair.base);
    setSelTop(pair.top);
    setDefaultPair(pair);
    onMaterialChange?.(pair.base, { base: pair.base, top: pair.top, size: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDualAxis, product.id]);

  const handleResetDefault = () => {
    if (!defaultPair) return;
    setSelBase(defaultPair.base);
    setSelTop(defaultPair.top);
    setSelDualSize(null);
    onMaterialChange?.(defaultPair.base, { base: defaultPair.base, top: defaultPair.top, size: null });
  };

  const clearAllDualSelections = () => {
    setSelBase(null);
    setSelTop(null);
    setSelDualSize(null);
    onMaterialChange?.(null, { base: null, top: null, size: null });
  };

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

  const variantsList = product.size_variants || [];
  const matchesDual = (v: any, b: string | null, t: string | null, s: string | null) =>
    (b == null || (v.base || "").trim() === b) &&
    (t == null || (v.top || "").trim() === t) &&
    (s == null || (v.label || "").trim() === s);

  const disabledBaseIdx = isDualAxis && selDualSize
    ? baseOptions.map((b, i) => (variantsList.some((v: any) => matchesDual(v, b, null, selDualSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledTopIdx = isDualAxis && selDualSize
    ? topOptions.map((t, i) => (variantsList.some((v: any) => matchesDual(v, null, t, selDualSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledDualSizeIdx = isDualAxis && (selBase || selTop)
    ? dualSizeOptions.map((s, i) => (variantsList.some((v: any) => matchesDual(v, selBase, selTop, s)) ? -1 : i)).filter((i) => i >= 0)
    : [];

  const baseAxisLabelRaw = (product.base_axis_label || "").trim();
  const topAxisLabelRaw = (product.top_axis_label || "").trim();
  const baseAxisIsDim = baseAxisLabelRaw
    ? isDimensionAxisLabel(baseAxisLabelRaw)
    : (baseOptions.length > 0 && baseOptions.every(looksLikeDimension));
  const topAxisIsDim = topAxisLabelRaw
    ? isDimensionAxisLabel(topAxisLabelRaw)
    : (topOptions.length > 0 && topOptions.every(looksLikeDimension));

  const baseOnlySizeOptions = isBaseOnly
    ? Array.from(new Set(
        ((product.size_variants || []) as Array<{ label?: string | null }>)
          .map((v) => (v.label || "").trim())
          .filter(Boolean),
      ))
    : [];

  const value: VariantSelectorsContextType = {
    product,
    axes,
    finishMap,
    selBase,
    setSelBase,
    selTop,
    setSelTop,
    selDualSize,
    setSelDualSize,
    selMat,
    setSelMat,
    selSize,
    setSelSize,
    hasLinkedFabrics,
    setHasLinkedFabrics,
    linkedWoodFinishes,
    setLinkedWoodFinishes,
    defaultPair,
    baseAxisIsDim,
    topAxisIsDim,
    baseAxisLabelRaw,
    topAxisLabelRaw,
    variantsList,
    matchesDual,
    disabledBaseIdx,
    disabledTopIdx,
    disabledDualSizeIdx,
    disabledSizeIdx,
    disabledMatIdx,
    baseOnlySizeOptions,
    clearAllDualSelections,
    handleResetDefault,
    onMaterialChange,
    galleryActiveIndex,
    onSwatchImagesChange,
    onFinishesMissingImagesChange,
    onFinishGroupingResolved,
    onDisplayedFinishesChange,
  };


  return (
    <VariantSelectorsContext.Provider value={value}>
      {children}
    </VariantSelectorsContext.Provider>
  );
};

const VariantFinishSelectors: React.FC<{ section?: "primary" | "supplemental" | "all" }> = ({ section = "all" }) => {
  const ctx = useVariantSelectorsContext();
  const {
    product,
    axes: { isDualAxis, isBaseOnly, baseOptions, topOptions, hasSingleAxisSplit, singleMaterialOptions, singleAxisParsed },
    selBase, setSelBase, selTop, setSelTop, selDualSize, setSelDualSize, selMat, setSelMat, selSize, setSelSize,
    hasLinkedFabrics, setHasLinkedFabrics, linkedWoodFinishes, setLinkedWoodFinishes,
    baseAxisIsDim, topAxisIsDim,
    baseAxisLabelRaw, topAxisLabelRaw,
    variantsList, matchesDual,
    disabledBaseIdx, disabledTopIdx, disabledMatIdx,
    clearAllDualSelections,
    onMaterialChange, galleryActiveIndex, onSwatchImagesChange, onFinishesMissingImagesChange,
    onFinishGroupingResolved,
    onDisplayedFinishesChange,
  } = ctx;

  const isFinishAxis = isFinishAxisLabel;
  const hasWoodSwatches = linkedWoodFinishes.length > 0;
  const allBasesHaveSwatches = baseOptions.length > 0 && everyOptionCoveredBySwatches(baseOptions, linkedWoodFinishes);
  const topAxisHasSwatches = !topAxisIsDim && topOptions.length > 0 && someOptionCoveredBySwatches(topOptions, linkedWoodFinishes);
  const suppressBaseAsFinish = !baseAxisIsDim && (allBasesHaveSwatches || (hasWoodSwatches && isFinishAxis(baseAxisLabelRaw)));
  const suppressTopAsFinish = !topAxisIsDim && (topAxisHasSwatches || (isProductUpholstered(product) && isFinishAxis(topAxisLabelRaw)) || (hasWoodSwatches && isFinishAxis(topAxisLabelRaw)));
  const suppressSingleAsFinish = shouldSuppressSingleAsFinish({
    hasSingleAxisSplit,
    singleMaterialOptions,
    linkedWoodFinishes,
  });

  return (
    <div className="flex flex-col gap-2">
      {section !== "supplemental" && <FinishSelector
        pickId={product.id}
        productTitle={product.title}
        productCategory={product.category}
        upholsteryLabel={
          resolveFinishSectionLabels({
            baseAxisLabel: product.base_axis_label,
            topAxisLabel: product.top_axis_label,
            baseAxisIsDimension: baseAxisIsDim,
            isUpholstered: isProductUpholstered(product),
            woodLabelOverride: (product as any).wood_label_override,
          }).upholsteryLabel
        }
        woodLabel={
          resolveFinishSectionLabels({
            baseAxisLabel: product.base_axis_label,
            topAxisLabel: product.top_axis_label,
            baseAxisIsDimension: baseAxisIsDim,
            isUpholstered: isProductUpholstered(product),
            woodLabelOverride: (product as any).wood_label_override,
          }).woodLabel
        }
        woodFilter={
          isDualAxis && !baseAxisIsDim && baseOptions.length >= 1
            ? makeSwatchAxisFilter(baseOptions)
            : undefined
        }
        topLabel={
          product.top_axis_label
            ? getTopPlaceholder({ top_axis_label: product.top_axis_label })
            : null
        }
        topFilter={
          isDualAxis && !baseAxisIsDim && topOptions.length >= 1
            ? makeSwatchAxisFilter(topOptions)
            : undefined
        }
        showUpholsterySection={isProductUpholstered(product)}
        showWoodSection
        onHasFabricsChange={setHasLinkedFabrics}
        onWoodFinishesAvailable={setLinkedWoodFinishes}
        onSwatchImagesChange={onSwatchImagesChange}
        onFinishGroupingResolved={onFinishGroupingResolved}
        onDisplayedFinishesChange={onDisplayedFinishesChange}
        onFinishesMissingImagesChange={onFinishesMissingImagesChange}
        currentGalleryIndex={galleryActiveIndex ?? 0}
        onWoodFinishChange={(woodName) => {
          if (!woodName) return;
          const norm = (s: string) => s.trim().toLowerCase();
          const nw = norm(woodName);
          const match =
            baseOptions.find((b) => norm(b) === nw)
            || baseOptions.find((b) => nw.includes(norm(b)))
            || baseOptions.find((b) => norm(b).includes(nw))
            || woodName;
          setSelBase(match);
          let nextTop = selTop;
          if (nextTop && !variantsList.some((x: any) => matchesDual(x, match, nextTop, selDualSize))) {
            setSelTop(null);
            nextTop = null;
          }
          onMaterialChange?.(match, { base: match, top: nextTop, size: selDualSize, fromSwatch: true });
        }}
        onTopFinishChange={(topName) => {
          if (!topName) return;
          const norm = (s: string) => s.trim().toLowerCase();
          const nw = norm(topName);
          const match =
            topOptions.find((t) => norm(t) === nw)
            || topOptions.find((t) => nw.includes(norm(t)))
            || topOptions.find((t) => norm(t).includes(nw))
            || topName;
          setSelTop(match);
          let nextBase = selBase;
          if (nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, match, selDualSize))) {
            setSelBase(null);
            nextBase = null;
          }
          onMaterialChange?.(match, { base: nextBase, top: match, size: selDualSize, fromSwatch: true });
        }}
        onUpholsteryTierChange={(rawTier) => {
          if (!rawTier) return;
          const candidates = topOptions.filter(
            (t) => t === rawTier || t.toLowerCase().startsWith(rawTier.toLowerCase()),
          );
          if (candidates.length === 0) return;
          const sized =
            (selDualSize &&
              candidates.find((t) =>
                variantsList.some((x: any) => matchesDual(x, null, t, selDualSize)),
            )) ||
            candidates[0];
          setSelTop(sized);
          let nextBase = selBase;
          if (selDualSize && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, sized, selDualSize))) {
            setSelBase(null);
            nextBase = null;
          }
          onMaterialChange?.(sized, { base: nextBase, top: sized, size: selDualSize });
        }}
      />}

      {section !== "primary" && <>{isDualAxis ? (
        <>
          {!baseAxisIsDim && !suppressBaseAsFinish && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension)) && (
            <ExpandableSpec
              icon={specIcon("⬗")}
              text={withImperialPerLine(baseOptions.join("\n"))}
              placeholder={getBasePlaceholder(product)}
              singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
              swatchMode
              emphasized

              value={selBase != null ? Math.max(0, baseOptions.indexOf(selBase)) : null}
              onChange={(idx) => {
                if (idx < 0) {
                  clearAllDualSelections();
                  return;
                }
                const v = baseOptions[idx] ?? null;
                setSelBase(v);
                let nextTop = selTop;
                let nextSize = selDualSize;
                if (v && nextTop && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelTop(null); nextTop = null; }
                if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelDualSize(null); nextSize = null; }
                if (v && !nextTop) {
                  const compatTops = topOptions.filter((t) => variantsList.some((x: any) => matchesDual(x, v, t, nextSize)));
                  if (compatTops.length === 1) { setSelTop(compatTops[0]); nextTop = compatTops[0]; }
                }
                onMaterialChange?.(v, { base: v, top: nextTop, size: nextSize });
              }}
              disabledIndices={disabledBaseIdx}
              helperText={
                disabledBaseIdx.length > 0 && (selTop || selDualSize)
                  ? `Some ${(getBasePlaceholder(product) || "base").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                  : undefined
              }
            />
          )}
          {!suppressTopAsFinish && !(hasLinkedFabrics && !topAxisIsDim) && (
            <ExpandableSpec
              icon={specIcon(topAxisIsDim ? "📐" : "⬗")}
              text={withImperialPerLine(topOptions.join("\n"))}
              placeholder={getTopPlaceholder(product)}
              singleValueLabel={formatVariantAxisLabel(product.top_axis_label) || undefined}
              swatchMode={!topAxisIsDim}
              emphasized

              value={selTop != null ? Math.max(0, topOptions.indexOf(selTop)) : null}
              onChange={(idx) => {
                if (idx < 0) {
                  clearAllDualSelections();
                  return;
                }
                const v = topOptions[idx] ?? null;
                setSelTop(v);
                let nextBase = selBase;
                let nextSize = selDualSize;
                if (v && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, v, nextSize))) { setSelBase(null); nextBase = null; }
                if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, nextBase, v, nextSize))) { setSelDualSize(null); nextSize = null; }
                if (v && !nextBase) {
                  const compatBases = baseOptions.filter((b) => variantsList.some((x: any) => matchesDual(x, b, v, nextSize)));
                  if (compatBases.length === 1) {
                    setSelBase(compatBases[0]);
                    nextBase = compatBases[0];
                  }
                }
                onMaterialChange?.(v, { base: nextBase, top: v, size: nextSize });
              }}
              disabledIndices={disabledTopIdx}
              helperText={
                disabledTopIdx.length > 0 && (selBase || selDualSize)
                  ? `Some ${(getTopPlaceholder(product) || "top").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                  : undefined
              }
            />
          )}
          {selTop && /customer'?s own material|^com\b|\(com\)/i.test(selTop) && (
            <p className="self-start mt-1 ml-[26px] font-body text-[11px] italic text-muted-foreground leading-snug max-w-md">
              Photography shows the piece in a representative upholstery — your COM fabric will be applied in production.
            </p>
          )}
        </>
      ) : isBaseOnly && !baseAxisIsDim && !suppressBaseAsFinish && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension)) ? (
        <ExpandableSpec
          icon={specIcon(baseAxisIsDim ? "📐" : "⬗")}
          text={withImperialPerLine(baseOptions.join("\n"))}
          placeholder={getBasePlaceholder(product)}
          singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
          swatchMode
          emphasized

          value={selBase != null ? Math.max(0, baseOptions.indexOf(selBase)) : null}
          onChange={(idx) => {
            if (idx < 0) {
              setSelBase(null);
              onMaterialChange?.(null, { base: null, top: null, size: null });
              return;
            }
            const v = baseOptions[idx] ?? null;
            setSelBase(v);
            onMaterialChange?.(v, { base: v, top: null, size: null });
          }}
        />
      ) : hasSingleAxisSplit && !suppressSingleAsFinish ? (
        <ExpandableSpec
          icon={specIcon("⬗")}
          text={singleMaterialOptions.join("\n")}
          placeholder={getMaterialPlaceholder(product)}
          swatchMode
          emphasized

          value={selMat != null ? Math.max(0, singleMaterialOptions.indexOf(selMat)) : null}
          onChange={(idx) => {
            const m = singleMaterialOptions[idx] ?? null;
            setSelMat(m);
            let nextSize = selSize;
            if (m && nextSize && !singleAxisParsed.some((p) => p.material === m && p.size === nextSize)) {
              setSelSize(null);
              nextSize = null;
            }
            const match = m
              ? singleAxisParsed.find((p) => p.material === m && (!nextSize || p.size === nextSize))
              : null;
            onMaterialChange?.((match?.variant.label || m || null) as string | null);
          }}
          disabledIndices={disabledMatIdx}
          helperText={
            disabledMatIdx.length > 0 && selSize
              ? `Some materials aren't offered in ${selSize} — greyed out.`
              : undefined
          }
        />
      ) : product.materials && !hasLinkedFabrics && !isProductUpholstered(product) && linkedWoodFinishes.length === 0 ? (
        (() => {
          const parsed = parseMaterialsFallback(product.materials);
          return (
            <ExpandableSpec
              icon={specIcon("⬗")}
              text={product.materials}
              placeholder={getMaterialPlaceholder(product)}
              autoSplit
              onChange={(idx) => onMaterialChange?.(parsed[idx] ?? null)}
            />
          );
        })()
      ) : null}

      {product.materials_description?.trim() && (isRugCategory(product.category) || (!hasLinkedFabrics && !isProductUpholstered(product))) && (
        <LegendDisclosure
          icon={specIcon("⬗")}
          text={product.materials_description.trim()}
        />
      )}
      <AlsoContainsFinishes pickId={product.id} className="mt-1 pl-6" /></>}
    </div>
  );
};

const VariantDimensionsPanel: React.FC = () => {
  const ctx = useVariantSelectorsContext();
  const {
    product,
    axes: { isDualAxis, isBaseOnly, hasSingleAxisSplit, hasVariants, baseOptions, topOptions, dualSizeOptions, singleSizeOptions, singleAxisParsed },
    selBase, setSelBase, selTop, setSelTop, selDualSize, setSelDualSize, selMat, setSelMat, selSize, setSelSize,
    baseAxisIsDim, topAxisIsDim,
    baseAxisLabelRaw, topAxisLabelRaw,
    baseOnlySizeOptions,
    variantsList, matchesDual,
    disabledBaseIdx, disabledTopIdx, disabledDualSizeIdx, disabledSizeIdx,
    clearAllDualSelections,
    onMaterialChange,
  } = ctx;

  return (
    <div className="flex flex-col gap-2">
      {isBaseOnly && !baseAxisIsDim && baseOnlySizeOptions.length > 1 ? (
        <ExpandableSpec
          icon={specIcon("📐")}
          text={withImperialPerLine(baseOnlySizeOptions.join("\n"))}
          secondaryText={null}
          emphasized
          placeholder="Select Your Size"
          value={selDualSize != null ? Math.max(0, baseOnlySizeOptions.indexOf(selDualSize)) : null}
          onChange={(idx) => {
            if (idx < 0) {
              setSelDualSize(null);
              onMaterialChange?.(null, { base: selBase, top: null, size: null });
              return;
            }
            const s = baseOnlySizeOptions[idx] ?? null;
            setSelDualSize(s);
            let nextBase = selBase;
            if (s && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, null, s))) {
              setSelBase(null);
              nextBase = null;
            }
            onMaterialChange?.(s, { base: nextBase, top: null, size: s });
          }}
        />
      ) : isDualAxis && dualSizeOptions.length > 0 ? (
        <ExpandableSpec
          icon={specIcon("📐")}
          text={withImperialPerLine(dualSizeOptions.join("\n"))}
          secondaryText={null}
          emphasized
          placeholder="Select Your Size"
          value={selDualSize != null ? Math.max(0, dualSizeOptions.indexOf(selDualSize)) : null}
          onChange={(idx) => {
            if (idx < 0) {
              clearAllDualSelections();
              return;
            }
            const s = dualSizeOptions[idx] ?? null;
            setSelDualSize(s);
            let nextBase = selBase;
            let nextTop = selTop;
            if (s && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, nextTop, s))) { setSelBase(null); nextBase = null; }
            if (s && nextTop && !variantsList.some((x: any) => matchesDual(x, nextBase, nextTop, s))) { setSelTop(null); nextTop = null; }
            onMaterialChange?.(nextTop ?? nextBase ?? s, { base: nextBase, top: nextTop, size: s });
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
          icon={specIcon("📐")}
          text={withImperialPerLine(singleSizeOptions.join("\n"))}
          secondaryText={null}
          emphasized
          placeholder="Select Your Size"
          value={selSize != null ? Math.max(0, singleSizeOptions.indexOf(selSize)) : null}
          onChange={(idx) => {
            const s = singleSizeOptions[idx] ?? null;
            setSelSize(s);
            let nextMat = selMat;
            if (s && nextMat && !singleAxisParsed.some((p) => p.size === s && p.material === nextMat)) {
              setSelMat(null);
              nextMat = null;
            }
            const match = s
              ? singleAxisParsed.find((p) => p.size === s && (!nextMat || p.material === nextMat))
              : null;
            onMaterialChange?.((match?.variant.label || nextMat || null) as string | null);
          }}
          disabledIndices={disabledSizeIdx}
          helperText={
            disabledSizeIdx.length > 0 && selMat
              ? `Some sizes aren't offered in ${selMat} — greyed out.`
              : undefined
          }
        />
      ) : hasVariants && !isDualAxis && !isBaseOnly && singleAxisParsed.length > 1 && (() => {
        const seen = new Set<string>();
        const labels: string[] = [];
        for (const p of singleAxisParsed) {
          const raw = (p.variant.label || "").trim();
          if (!raw || seen.has(raw)) continue;
          seen.add(raw);
          labels.push(raw);
        }
        const dimCount = labels.filter(looksLikeDimension).length;
        const labelsAreDims = dimCount >= 2 && dimCount >= Math.ceil(labels.length / 2);
        const formatted = withImperialPerLine(labels.join("\n"));
        return labels.length > 1 && labelsAreDims ? (
          <ExpandableSpec
            icon={specIcon("📐")}
            text={formatted}
            emphasized
            placeholder="Select Your Size"
            value={selSize != null ? Math.max(0, labels.indexOf(selSize)) : null}
            onChange={(idx) => {
              const s = labels[idx] ?? null;
              setSelSize(s);
              const variant = s
                ? singleAxisParsed.find((p) => (p.variant.label || "").trim() === s)?.variant
                : null;
              const fullLabel = variant?.label || s || null;
              onMaterialChange?.(fullLabel, { size: fullLabel });
            }}
          />
        ) : product.dimensions && looksLikeDimension(product.dimensions) ? (
          <ExpandableSpec icon={specIcon("📐")} text={withImperialStacked(product.dimensions)} />
        ) : null;
      })()}

      {!hasVariants && product.dimensions && looksLikeDimension(product.dimensions) && (
        <ExpandableSpec icon={specIcon("📐")} text={withImperialStacked(product.dimensions)} />
      )}

      {hasVariants && isDualAxis && !baseAxisIsDim && !topAxisIsDim && (dualSizeOptions?.length ?? 0) === 0 && product.dimensions && looksLikeDimension(product.dimensions) && (
        <ExpandableSpec icon={specIcon("📐")} text={withImperialStacked(product.dimensions)} />
      )}

      {hasVariants && isBaseOnly && !baseAxisIsDim
        && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension))
        && product.dimensions && looksLikeDimension(product.dimensions) && (
        <ExpandableSpec icon={specIcon("📐")} text={withImperialStacked(product.dimensions)} />
      )}

      {isBaseOnly && baseAxisIsDim && (
        <ExpandableSpec
          icon={specIcon("📐")}
          text={withImperialPerLine(baseOptions.join("\n"))}
          placeholder={getBasePlaceholder(product)}
          singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
          emphasized
          value={selBase != null ? Math.max(0, baseOptions.indexOf(selBase)) : null}
          onChange={(idx) => {
            if (idx < 0) {
              setSelBase(null);
              onMaterialChange?.(null, { base: null, top: null, size: null });
              return;
            }
            const v = baseOptions[idx] ?? null;
            setSelBase(v);
            onMaterialChange?.(v, { base: v, top: null, size: null });
          }}
        />
      )}

      {isDualAxis && baseAxisIsDim && (
        <ExpandableSpec
          icon={specIcon("📐")}
          text={withImperialPerLine(baseOptions.join("\n"))}
          placeholder={getBasePlaceholder(product)}
          singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
          emphasized
          value={selBase != null ? Math.max(0, baseOptions.indexOf(selBase)) : null}
          onChange={(idx) => {
            if (idx < 0) {
              clearAllDualSelections();
              return;
            }
            const v = baseOptions[idx] ?? null;
            setSelBase(v);
            let nextTop = selTop;
            let nextSize = selDualSize;
            if (v && nextTop && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelTop(null); nextTop = null; }
            if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelDualSize(null); nextSize = null; }
            if (v && !nextTop) {
              const compatTops = topOptions.filter((t) => variantsList.some((x: any) => matchesDual(x, v, t, nextSize)));
              if (compatTops.length === 1) { setSelTop(compatTops[0]); nextTop = compatTops[0]; }
            }
            onMaterialChange?.(v, { base: v, top: nextTop, size: nextSize });
          }}
          disabledIndices={disabledBaseIdx}
          helperText={
            disabledBaseIdx.length > 0 && (selTop || selDualSize)
              ? `Some ${(getBasePlaceholder(product) || "base").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
              : undefined
          }
        />
      )}

      {isBaseOnly && !baseAxisIsDim && !isFinishAxisLabel(baseAxisLabelRaw)
        && baseOptions.length > 0 && baseOptions.every(looksLikeDimension) && (
        <ExpandableSpec
          icon={specIcon("📐")}
          text={withImperialPerLine(baseOptions.join("\n"))}
          placeholder={getBasePlaceholder(product)}
          singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
          emphasized
          value={selBase != null ? Math.max(0, baseOptions.indexOf(selBase)) : null}
          onChange={(idx) => {
            if (idx < 0) {
              setSelBase(null);
              onMaterialChange?.(null, { base: null, top: null, size: null });
              return;
            }
            const v = baseOptions[idx] ?? null;
            setSelBase(v);
            onMaterialChange?.(v, { base: v, top: null, size: null });
          }}
        />
      )}

      {isDualAxis && !baseAxisIsDim && !isFinishAxisLabel(baseAxisLabelRaw)
        && baseOptions.length > 0 && baseOptions.every(looksLikeDimension) && (
        <ExpandableSpec
          icon={specIcon("📐")}
          text={withImperialPerLine(baseOptions.join("\n"))}
          placeholder={getBasePlaceholder(product)}
          singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
          emphasized
          value={selBase != null ? Math.max(0, baseOptions.indexOf(selBase)) : null}
          onChange={(idx) => {
            if (idx < 0) {
              clearAllDualSelections();
              return;
            }
            const v = baseOptions[idx] ?? null;
            setSelBase(v);
            let nextTop = selTop;
            let nextSize = selDualSize;
            if (v && nextTop && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelTop(null); nextTop = null; }
            if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelDualSize(null); nextSize = null; }
            if (v && !nextTop) {
              const compatTops = topOptions.filter((t) => variantsList.some((x: any) => matchesDual(x, v, t, nextSize)));
              if (compatTops.length === 1) { setSelTop(compatTops[0]); nextTop = compatTops[0]; }
            }
            onMaterialChange?.(v, { base: v, top: nextTop, size: nextSize });
          }}
          disabledIndices={disabledBaseIdx}
        />
      )}
    </div>
  );
};

const VariantSelectors: React.FC<{
  product: any;
  onMaterialChange?: (label: string | null, opts?: { base?: string | null; top?: string | null; size?: string | null; fromSwatch?: boolean }) => void;
  galleryActiveIndex?: number;
  finishMap?: Record<string, number> | null;
  onSwatchImagesChange?: (imageIndices: number[] | null, meta?: { committed?: boolean; swatchName?: string; jumpOnly?: boolean }) => void;
  onFinishesMissingImagesChange?: (names: string[]) => void;
}> = (props) => (
  <VariantSelectorsProvider {...props}>
    <VariantFinishSelectors />
    <VariantDimensionsPanel />
  </VariantSelectorsProvider>
);


/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
const PublicProductPageContent: React.FC = () => {
  const { slug: designerSlug, productSlug } = useParams<{ slug: string; productSlug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const location = useLocation();
  const isLegacyArnoldClamChairRoute =
    designerSlug === "arnold-madsen" &&
    /^clam-chair-(?:oiled-walnut|oiled-oak|fumed-oak)$/.test(productSlug || "");
  const { user, isTradeUser, tradeStatus, loading: authLoading } = useAuth();
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const isGridUrl = (p?: string | null) => !!p && /[?&](category|subcategory)=/.test(p);
  const storedFrom = typeof window !== "undefined" ? sessionStorage.getItem("product_from_path") : null;
  const fromPath = stateFrom || (isGridUrl(storedFrom) ? storedFrom! : undefined);

  useEffect(() => {
    if (isLegacyArnoldClamChairRoute) {
      navigate("/designers/dagmar-london/clam-chair", { replace: true });
      return;
    }
    if (stateFrom) {
      try { sessionStorage.setItem("product_from_path", stateFrom); } catch {}
    } else if (storedFrom && !isGridUrl(storedFrom)) {
      // Discard stale non-grid path
      try { sessionStorage.removeItem("product_from_path"); } catch {}
    }
  }, [isLegacyArnoldClamChairRoute, navigate, stateFrom, storedFrom]);
  const { data, isLoading } = useProductBySlug(designerSlug, productSlug);
  const { data: publicRrpRow } = usePublicRrp(data?.product?.id);
  const { data: relatedRrpMap = {} } = usePublicRrpMap((data?.relatedPicks || []).map((p: any) => p.id));
  const catalogueRrpLabel = formatPublicRrp(publicRrpRow);
  // Price of the size/finish combination the visitor has currently selected.
  // `exact` = a single variant matched, so we drop the "From" prefix.
  const [selectedRrp, setSelectedRrp] = useState<{ cents: number; exact: boolean } | null>(null);
  // Same resolution against the product's own `size_variants` (available for
  // every product, not just publicly priced ones). Feeds the Trade Workspace so
  // the net price tracks the finish/size the member has selected.
  const [selectedVariantPrice, setSelectedVariantPrice] = useState<{ cents: number; exact: boolean } | null>(null);
  const rrpSelectionRef = useRef<{ base: string | null; top: string | null; size: string | null }>({
    base: null,
    top: null,
    size: null,
  });
  const publicRrpLabel = catalogueRrpLabel
    ? (selectedRrp
        ? formatPublicRrpCents(selectedRrp.cents, publicRrpRow, selectedRrp.exact ? "" : undefined) ||
          catalogueRrpLabel
        : catalogueRrpLabel)
    : null;

  // ---- Dev role-preview state (mock auth) -------------------------------
  // Until the dev dropdown is used, real auth drives the effective role.
  const { role: devRole, overridden: roleOverridden } = useUserRole();
  const { discountPct: tierDiscountPct, tierLabel: tradeTierLabel } = useTradeDiscount();
  const realRole: UserRole = !user
    ? "PUBLIC"
    : isTradeUser || tradeStatus === "approved"
      ? "TRADE_VERIFIED"
      : tradeStatus === "pending_review"
        ? "TRADE_UNVERIFIED"
        : "RETAIL_BUYER";
  const effectiveRole: UserRole = roleOverridden ? devRole : realRole;
  const isTradeVerifiedView = effectiveRole === "TRADE_VERIFIED";
  const isTradeUnverifiedView = effectiveRole === "TRADE_UNVERIFIED";

  // ---- Structured product data + reactive pricing math -------------------
  // Variant A is purely presentational: the numbers come from the container's
  // shared engine (ProductConfigContext) so the trade dashboard variant and
  // this editorial layout always resolve to identical figures.
  const productConfig = useProductConfigOptional();
  const productData = {
    id: data?.product?.id ?? "",
    name: data?.product?.title ?? "",
    // Base retail rate in minor units — the selected size/finish always wins so
    // the header tracks the same figure as the trade workspace block.
    baseRetailPriceCents:
      (selectedVariantPrice?.cents && selectedVariantPrice.cents > 0
        ? selectedVariantPrice.cents
        : selectedRrp?.cents) ?? (Number(publicRrpRow?.rrp_price_cents) || 0),
    // Real assigned tier discount (trade_tier_config) — never a mock rate.
    tradeDiscountMultiplier: tierDiscountPct || 0,
  };
  const hasFromPrefix = /^From\s+/i.test(publicRrpLabel || "");
  const priceCurrency = (publicRrpRow?.currency || "USD").toUpperCase();

  // Publish the current selection's base rate + currency into the container so
  // both layout variants (and the quantity stepper) compute off one source.
  useEffect(() => {
    productConfig?.setBaseRetailPriceCents(productData.baseRetailPriceCents);
  }, [productConfig, productData.baseRetailPriceCents]);
  useEffect(() => {
    productConfig?.setCurrency(priceCurrency);
  }, [productConfig, priceCurrency]);

  const pricing = computeDisplayPrice(productData, effectiveRole, priceCurrency, hasFromPrefix);
  const mockNetLabel = pricing.netLabel;
  const mockNetDisplay = pricing.netDisplay;
  const retailPlainLabel =
    pricing.retailFootnoteLabel ??
    (publicRrpLabel ? publicRrpLabel.replace(/^From\s+/i, "") : null);

  // Commerce block visibility under the (possibly mocked) role.
  // Verified trade — mocked OR real auth — renders the exact same commerce
  // template. Non-trade signed-out visitors keep the public CTA.
  const showMockTradeCommerce = isTradeVerifiedView;
  const showPublicCommerce =
    !isTradeVerifiedView && (roleOverridden ? true : !user && !authLoading);

  // On landing we intentionally show the catalogue-wide minimum ("From $X"),
  // not the price of the finish in the first photo — this encourages visitors
  // to browse the finishes to discover the full price range.
  const productId = data?.product?.id;




  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();

  const [favIds, setFavIds] = useState(readFavs);
  const [relatedIndex, setRelatedIndex] = useState(0);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [galleryActiveIndex, setGalleryActiveIndex] = useState<number | undefined>(undefined);
  // Active image index is part of the shared container state.
  useEffect(() => {
    productConfig?.setActiveImageIndex(galleryActiveIndex ?? 0);
  }, [productConfig, galleryActiveIndex]);
  // Bumped on every parent-initiated jump so the gallery re-syncs even when the
  // numeric index is identical to the previous one (e.g. re-selecting the same finish).
  const [galleryJumpNonce, setGalleryJumpNonce] = useState(0);
  // 1-based image indices owned by the currently selected finish swatch. When
  // set, the gallery shows ONLY those photos (e.g. Clam Chair: Walnut 1–7,
  // Oiled Oak 8–13, Fumed Oak 14–20) instead of the full 20-photo reel.
  const [swatchImageIndices, setSwatchImageIndices] = useState<number[] | null>(null);
  // True until FinishSelector reports whether this product's photos are split
  // per finish. While pending we show only the hero photo so the full mixed
  // reel never flashes before narrowing to the default finish group.
  const [finishGroupingPending, setFinishGroupingPending] = useState(true);
  useEffect(() => {
    if (!finishGroupingPending) return;
    const t = setTimeout(() => setFinishGroupingPending(false), 2500);
    return () => clearTimeout(t);
  }, [finishGroupingPending]);
  // Currently-selected wood/top finish swatches that lack mapped images —
  // appended to the bespoke concierge message so they aren't overlooked.
  const [finishesMissingImages, setFinishesMissingImages] = useState<string[]>([]);
  const isMobile = useIsMobile();
  const isPwa = isPwaStandaloneDisplay();
  const isMobileOrPwa = isMobile || isPwa;
  const [creationOpen, setCreationOpen] = useState(false);
  const galleryScrollRef = React.useRef<HTMLDivElement | null>(null);
  // On mobile/PWA, when a finish selection updates the gallery image, only
  // scroll if the product image is genuinely off-screen above the viewport.
  // Never scroll when it's already (partly) visible — doing so pushed the
  // brand name, product title and price up out of view.
  useEffect(() => {
    if (galleryJumpNonce === 0) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const el = galleryScrollRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const headerOffset = 80;
    // Visible enough already → leave the scroll position untouched.
    if (rect.bottom > headerOffset + 80 && rect.top < window.innerHeight) return;
    const y = rect.top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [galleryJumpNonce]);


  // Mobile/PWA: shrink the product image once the user scrolls past a small threshold.
  const [galleryCompact, setGalleryCompact] = useState(false);
  const [stickyBarArmed, setStickyBarArmed] = useState(false);
  const { direction: scrollDir, scrollY } = useScrollDirection({ threshold: 6, topOffset: 80 });
  // Once the product image has scrolled past, the mobile action bar takes over
  // the top of the viewport and the global header steps aside entirely.
  const showStickyBar = stickyBarArmed;

  // Mobile/PWA only: tell the global nav to stay hidden while this bar owns the top.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isSmall = window.matchMedia("(max-width: 767px)").matches;
    setStickyProductBarActive(isSmall && showStickyBar);
    return () => setStickyProductBarActive(false);
  }, [showStickyBar]);








  const [quoteRequestOpen, setQuoteRequestOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  // Finish/size selection surfaced in the authenticated Trade Workspace and
  // injected into Felix's product context.
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  // Swatch names currently DISPLAYED in the finish accordions (colourways).
  // Order lines merge these with the variant axis references so the basket
  // reads exactly what the shopper sees on the page.
  const [displayedFinishes, setDisplayedFinishes] = useState<{
    upholstery: string | null;
    base: string | null;
    top: string | null;
  }>({ upholstery: null, base: null, top: null });
  // Signed-out visitors get an elegant explainer instead of the gated PDF.
  const [specSheetLocked, setSpecSheetLocked] = useState(false);
  // Height of the gallery column captured before the collapse, so we can keep
  // the reading position visually stable when the image shrinks.
  const galleryHeightRef = useRef<number>(0);
  // Guard: after the collapse we programmatically scroll the page up by the
  // height the image lost. That lands the offset near the top, which would
  // otherwise trip the "expand again" branch and make the image bounce back to
  // full size. Lock the collapsed state for a moment so momentum scrolling and
  // the compensation itself cannot re-expand it.
  const compactLockUntilRef = useRef(0);
  // iOS may briefly report scrollY = 0 when momentum settles. Expansion is
  // therefore allowed only after a fresh gesture starts while already compact.
  const galleryCompactRef = useRef(false);
  const compactCanExpandRef = useRef(false);
  // Never collapse before the visitor has actually interacted: on landing the
  // browser can restore a previous scroll offset (or fire a transient scroll),
  // which would show the image already shrunken.
  const hasInteractedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const armExpansion = () => {
      hasInteractedRef.current = true;
      if (galleryCompactRef.current) compactCanExpandRef.current = true;
    };
    const onScroll = () => {
      const y = window.scrollY;
      const el = galleryScrollRef.current;
      // Hysteresis: collapse once the user has genuinely started reading,
      // expand again only right at the very top of the page.
      setGalleryCompact((prev) => {
        if (prev && Date.now() < compactLockUntilRef.current) return true;
        const next = prev
          ? !(compactCanExpandRef.current && y <= 2)
          : hasInteractedRef.current && y > 140;

        if (!prev && next) {
          const frame = document.querySelector(".product-image-frame") as HTMLElement | null;
          galleryHeightRef.current = frame?.getBoundingClientRect().height ?? 0;
          compactCanExpandRef.current = false;
        } else if (prev && !next) {
          compactCanExpandRef.current = false;
        }
        galleryCompactRef.current = next;
        return next;
      });
      if (el) {
        const rect = el.getBoundingClientRect();
        // Arm as soon as the product image has scrolled past the top edge.
        // (A header-relative threshold would oscillate, because arming hides the header.)
        setStickyBarArmed(rect.bottom <= 8);
      } else {
        setStickyBarArmed(false);
      }


    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("touchstart", armExpansion, { passive: true });
    window.addEventListener("touchmove", armExpansion, { passive: true });
    window.addEventListener("wheel", armExpansion, { passive: true });
    window.addEventListener("keydown", armExpansion);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("touchstart", armExpansion);
      window.removeEventListener("touchmove", armExpansion);
      window.removeEventListener("wheel", armExpansion);
      window.removeEventListener("keydown", armExpansion);
    };

  }, []);

  // When the image collapses, the whole page shifts up by the height it lost.
  // Compensate the scroll offset by that delta so the designer name, product
  // title and price land directly under the collapsed image instead of being
  // skipped over. Never land back at 0 — that would re-expand the image.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!galleryCompact) return;
    const before = galleryHeightRef.current;
    galleryHeightRef.current = 0;
    if (!before) return;
    const frame = document.querySelector(".product-image-frame") as HTMLElement | null;
    if (!frame) return;
    const after = frame.getBoundingClientRect().height;
    const delta = after - before; // negative when it shrank
    if (delta < -4) {
      compactLockUntilRef.current = Date.now() + 600;
      window.scrollTo({ top: Math.max(32, window.scrollY + delta) });
    }
  }, [galleryCompact]);













  useEffect(() => {
    window.scrollTo({ top: 0 });
    // Reset gallery to first image on product change — the route component is
    // reused across slug changes, so a stale activeIndex from the previous
    // product would persist (e.g. landing on picture 3).
    setGalleryActiveIndex(undefined);
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

  // Data-driven finish → gallery image index mapping (shared with TradeProductPage).
  // MUST be declared before any early returns to keep React hook order stable.
  const productFinishMap = React.useMemo(
    () => buildProductFinishMap((data?.product as any)?.variant_image_map),
    [data]
  );

  // Trade-only visibility for individual collectible product pages.
  if (isCollectibleSlug(designerSlug) && !authLoading && !isTradeUser) {
    return <Navigate to={collectibleGateRedirect(location.pathname + location.search)} replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background">
        <Navigation />
        <div className="pt-[var(--header-h)]">
          <ProductDetailSkeleton variant="page" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[100dvh] bg-background">
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

  const designerDisplay = formatDesignerDisplayName(designer.name);

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

  // Finish-scoped view of the reel. `visibleImageIndices` holds the absolute
  // (0-based) positions currently on show, so we can translate between the
  // gallery's local index and the product's canonical image index.
  const visibleImageIndices: number[] | null = (() => {
    if (!swatchImageIndices || swatchImageIndices.length === 0) return null;
    const abs = Array.from(new Set(swatchImageIndices.map((i) => i - 1)))
      .filter((i) => i >= 0 && i < images.length)
      .sort((a, b) => a - b);
    return abs.length ? abs : null;
  })();
  const visibleImages = visibleImageIndices
    ? visibleImageIndices.map((i) => images[i])
    : finishGroupingPending && images.length > 1
    ? images.slice(0, 1)
    : images;
  const visibleActiveIndex = visibleImageIndices
    ? Math.max(0, visibleImageIndices.indexOf(galleryActiveIndex ?? visibleImageIndices[0]))
    : galleryActiveIndex;



  const subtitleEchoesTitle =
    !!product.subtitle &&
    (product.title.toLowerCase().includes(product.subtitle.toLowerCase()) ||
      product.subtitle.toLowerCase().includes(product.title.toLowerCase()));
  const pageTitle = `${product.title}${product.subtitle && !subtitleEchoesTitle ? ` ${product.subtitle}` : ""} by ${designerDisplay}`;

  // Build brand summary from biography: strip media URLs (lines starting with http) and pipe-delimited captions.
  const brandSummary = (() => {
    const bio = sanitizeBiographyCitations((designer as any).biography as string | undefined);
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

  // (productFinishMap is declared above the early returns to keep hook order stable.)
  // galleryActiveIndex declared earlier (must precede early returns to keep hooks order stable).
  const handleMaterialChange = (
    label: string | null,
    opts?: { base?: string | null; top?: string | null; size?: string | null; fromSwatch?: boolean }
  ) => {
    // Mirror the selection into the trade workspace / Felix context.
    setSelectedFinishes(
      [opts?.base, opts?.top, opts?.size, !opts?.base && !opts?.top ? label : null]
        .map((v) => (v ? String(v).trim() : ""))
        .filter(Boolean)
    );
    // Detect a "clear selection" call: no label and no axis values.
    const isClear =
      !label &&
      (!opts || (!opts.base && !opts.top && !opts.size));
    if (isClear) {
      // Snap the gallery back to the primary product image (index 0) so the
      // hero visibly resets when the user clears their finish/material choice.
      rrpSelectionRef.current = { base: null, top: null, size: null };
      setSelectedRrp(null);
      setSelectedVariantPrice(null);
      setGalleryActiveIndex(0);
      setGalleryJumpNonce((n) => n + 1);
      return;
    }
    const variantsForAxes = product.size_variants || [];
    // Public RRP follows the selection: match every chosen axis value against
    // the variant's base/top/label, then show that variant's price (exact when
    // one variant matches, "From <min>" while the selection is still partial).
    {
      const norm = normFinish;
      const sameFinish = sameFinishName;



      // The size dropdown and the finish swatches keep independent state, so a
      // swatch event carries a stale size. Merge selections in the parent and
      // let the swatch only update base/top.
      const prev = rrpSelectionRef.current;
      const merged = {
        base: opts?.base ? String(opts.base) : prev.base,
        top: opts?.top ? String(opts.top) : prev.top,
        size: opts?.fromSwatch ? (prev.size ?? (opts?.size ? String(opts.size) : null)) : (opts?.size ? String(opts.size) : prev.size),
      };
      if (!opts?.base && !opts?.top && !opts?.size && label) merged.size = String(label);
      rrpSelectionRef.current = merged;

      const rrpVariants = (publicRrpRow?.rrp_size_variants || []) as any[];
      

      const keySets = [
        [merged.size, merged.base, merged.top],
        [merged.size, merged.top],
        [merged.size],
      ];
      let uniquePrices: number[] = [];
      for (const set of keySets) {
        const keys = set.filter(Boolean) as string[];
        if (!keys.length) continue;
        const matches = rrpVariants.filter((v) => {
          const fields = [v?.base, v?.top, v?.label].filter(Boolean);
          return keys.every((k) =>
            fields.some((f) => norm(f) === norm(k) || sameFinish(f, k))
          );
        });

        const priced = matches
          .map((v) => Number(v?.price_cents))
          .filter((c) => Number.isFinite(c) && c > 0);
        uniquePrices = Array.from(new Set(priced));
        if (uniquePrices.length) break;
      }
      setSelectedRrp(
        uniquePrices.length
          ? { cents: Math.min(...uniquePrices), exact: uniquePrices.length === 1 }
          : null,
      );

      // Trade Workspace price: same matching, but against the product's own
      // variant list so it resolves for every catalogue, not just public RRPs.
      const ownVariants = (product.size_variants || []) as any[];
      let ownPrices: number[] = [];
      for (const set of keySets) {
        const keys = set.filter(Boolean) as string[];
        if (!keys.length) continue;
        const matches = ownVariants.filter((v) => {
          const fields = [v?.base, v?.top, v?.label].filter(Boolean);
          return keys.every((k) =>
            fields.some((f) => norm(f) === norm(k) || sameFinish(f, k))
          );
        });
        const priced = matches
          .map((v) => Number(v?.price_cents))
          .filter((c) => Number.isFinite(c) && c > 0);
        ownPrices = Array.from(new Set(priced));
        if (ownPrices.length) break;
      }
      setSelectedVariantPrice(
        ownPrices.length
          ? { cents: Math.min(...ownPrices), exact: ownPrices.length === 1 }
          : null,
      );
    }
    const requiresBaseAndTopSelection =
      variantsForAxes.some((v: any) => v.base && String(v.base).trim()) &&
      variantsForAxes.some((v: any) => v.top && String(v.top).trim());

    // If the Base axis only offers one distinct value, treat it as implicitly
    // selected so picking just the Top still resolves the composite key.
    const distinctBases = Array.from(
      new Set(variantsForAxes.map((v: any) => (v.base || "").trim()).filter(Boolean))
    );
    const distinctTops = Array.from(
      new Set(variantsForAxes.map((v: any) => (v.top || "").trim()).filter(Boolean))
    );
    const effectiveOpts = opts ? { ...opts } : opts;
    if (requiresBaseAndTopSelection && effectiveOpts) {
      if (!effectiveOpts.base && distinctBases.length === 1) effectiveOpts.base = distinctBases[0];
      if (!effectiveOpts.top && distinctTops.length === 1) effectiveOpts.top = distinctTops[0];
    }
    if (requiresBaseAndTopSelection && effectiveOpts && (!effectiveOpts.base || !effectiveOpts.top)) {
      // Do not resolve partial Base/Top state through a single-axis fallback;
      // wait for a complete pairing, otherwise clearing one axis can show the
      // wrong mapped finish image.
      // Exception: when triggered by a swatch click, the FinishSelector owns
      // the image jump (via image_indices). Skipping the snap here prevents
      // swatches with an empty Image Range from getting stuck on picture 1.
      if (!opts?.fromSwatch) {
        setGalleryActiveIndex(0);
        setGalleryJumpNonce((n) => n + 1);
      }
      return;
    }
    // Prefer the composite Base|Top|Size key when present, then fall back to
    // Base|Top, then single-axis. Same canonical resolver as TradeProductPage
    // so hero, hover, and any related image always come from one source key.
    const idx = effectiveOpts && (effectiveOpts.base || effectiveOpts.top || effectiveOpts.size)
      ? resolveVariantImageIndex(productFinishMap, {
          base: effectiveOpts.base,
          top: effectiveOpts.top,
          size: effectiveOpts.size,
          label,
          variants: variantsForAxes as any,
          imageCount: images.length,
          requireCompletePair: requiresBaseAndTopSelection,
        })
      : resolveFinishImageIndex(productFinishMap, label, images.length);
    if (idx !== undefined) {
      setGalleryActiveIndex(idx);
      setGalleryJumpNonce((n) => n + 1);
    }
  };

  /**
   * "Place an Order" — publicly priced pieces go straight into the cart, the
   * rest fall back to the concierge enquiry flow (price upon request).
   */
  /**
   * Finish line for cart / checkout rows: variant axis references merged with
   * the swatch colourways displayed in the selector (e.g. "Sheepskin
   * SKANDILOCK — 09 Moonlight / Oiled Walnut"), then the implicit single
   * variant, then the materials line.
   */
  const buildOrderFinishLabel = (): string | null => {
    const variants = (product.size_variants || []) as Array<{ label?: string; base?: string; top?: string }>;
    const sel = rrpSelectionRef.current || { base: null, top: null, size: null };
    const single = variants.length === 1 ? variants[0] : null;
    const composed = composeOrderFinishLabel({
      base: sel.base || single?.base || null,
      top: sel.top || single?.top || null,
      size: sel.size || null,
      displayedBase: displayedFinishes.base,
      displayedTop: displayedFinishes.top,
      displayedUpholstery: displayedFinishes.upholstery,
    });
    return (
      composed ||
      (selectedFinishes.length ? selectedFinishes.join(" / ") : "") ||
      (single ? [single.base, single.top, single.label].filter(Boolean).join(" / ") : "") ||
      (product.materials || "").trim() ||
      null
    );
  };

  const handlePlaceOrder = () => {
    const unit = selectedRrp?.cents || Number(publicRrpRow?.rrp_price_cents) || 0;
    if (!unit) {
      navigate(
        `/contact?${new URLSearchParams({
          subject: `Place an Order — ${product.title} by ${designerDisplay}`,
          productId: product.id,
          productSlug: productSlug || "",
          productName: product.title || "",
          designerName: designerDisplay || "",
          back: location.pathname + location.search,
        }).toString()}#contact`,
      );
      return;
    }
    // Finish shown on the cart line: the user's explicit selection first, then
    // the piece's implicit finish (single-variant products never fire a change
    // event), then the materials line as a last resort.
    const finishLabel = buildOrderFinishLabel();

    addToCart({
      pickId: product.id,
      productSlug: productSlug || "",
      designerSlug: designer.slug,
      title: product.title,
      designerName: designerDisplay,
      finishLabel,
      imageUrl: images[galleryActiveIndex ?? 0] || images[0] || product.image_url || null,
      leadTime: product.lead_time || null,
      unitPriceCents: unit,
      currency: (publicRrpRow?.currency || "USD").toUpperCase(),
    });
    navigate("/cart");
  };

  /**
   * Direct Stripe checkout (sticky bar "Place Order") — skips the cart page
   * entirely and sends the current piece + selected finish straight to Stripe.
   */
  const buildCheckoutLine = (quantity = 1) => {
    const unit = selectedRrp?.cents || Number(publicRrpRow?.rrp_price_cents) || 0;
    const finishLabel = buildOrderFinishLabel();
    return {
      unit,
      item: {
        pickId: product.id,
        productSlug: productSlug || "",
        designerSlug: designer.slug,
        title: product.title,
        designerName: designerDisplay,
        finishLabel,
        imageUrl: images[galleryActiveIndex ?? 0] || images[0] || product.image_url || null,
        leadTime: product.lead_time || null,
        quantity,
      },
    };
  };

  const startDirectCheckout = async (quantity = 1) => {
    const { unit, item } = buildCheckoutLine(quantity);
    if (!unit) {
      handlePlaceOrder();
      return;
    }
    const line = {
      title: item.title,
      designer: item.designerName,
      finishLabel: item.finishLabel,
      imageUrl: item.imageUrl,
      unitCents: unit,
      currency: (publicRrpRow?.currency || "USD").toLowerCase(),
      leadTime: item.leadTime,
      quantity: item.quantity,
      productPath: `/designers/${item.designerSlug}/${item.productSlug}`,
    };
    try {
      sessionStorage.setItem("ma_checkout_line", JSON.stringify(line));
    } catch { /* ignore */ }
    navigate("/checkout", { state: { line } });
  };


  const handleDirectCheckout = (quantity = 1) => {
    const { unit } = buildCheckoutLine(quantity);
    if (!unit) {
      handlePlaceOrder();
      return;
    }
    if (!user) {
      requireAuth(() => {}, "place an order");
      return;
    }
    void startDirectCheckout(quantity);
  };






  // Shared secondary utility links (Favorite / Pin / Fabric & Finishes PDF).
  // Rendered inside the main commerce action panel on desktop, and as a
  // compact standalone row on mobile.
  const renderUtilityLinks = (extraClass = "") => {
    const tradeApprovedFooter = !!user && (isTradeUser || tradeStatus === "approved");
    const hasSheet = !!(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0));
    const utilityItem =
      "inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors duration-200 hover:text-foreground";
    const iconClass = "shrink-0 text-muted-foreground/70";

    return (
      <div className={cn("flex flex-wrap items-center justify-center gap-x-10 gap-y-2 px-2", extraClass)}>
        <FavoriteFolderPicker pickId={product.id} align="start" side="top">
          <button
            onClick={(e) => e.stopPropagation()}
            className={cn(
              utilityItem,
              favorited && "text-destructive hover:text-destructive"
            )}
          >
            <Heart size={12} strokeWidth={1.25} className={cn(iconClass, favorited && "fill-current")} />
            {favorited ? "Saved" : "Favorite"}
          </button>
        </FavoriteFolderPicker>

        <button
          onClick={() => {
            if (!user) {
              requireAuth(() => {}, "pin this piece to your selection");
              return;
            }
            togglePin(compareItem);
          }}
          className={cn(
            utilityItem,
            pinned && "text-[hsl(var(--gold))] hover:text-[hsl(var(--gold))]",
            user && compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
          )}
        >
          <Pin size={12} strokeWidth={1.25} className={cn(iconClass, pinned && "fill-current")} />
          {pinned ? "Pinned" : "Pin to Selection"}
        </button>

        {hasSheet ? (
          <SpecSheetButton
            pdfUrl={product.pdf_url}
            pdfUrls={product.pdf_urls}
            brandName={designerDisplay}
            productName={product.title}
            variant="button"
            className={cn(utilityItem, "cursor-pointer")}
            icon={<FileText size={12} strokeWidth={1.25} className={iconClass} />}
            onBeforeOpen={() => {
              if (tradeApprovedFooter) return true;
              if (!user) {
                requireAuth(() => {}, "open this spec sheet");
                return false;
              }
              let allowed = false;
              requireAuth(() => { allowed = true; }, "download this spec sheet");
              return allowed;
            }}
          />
        ) : (
          <FinishesPdfButton
            pickId={product.id}
            productName={product.title}
            brandName={designerDisplay}
            className={cn(utilityItem, "cursor-pointer")}
            icon={<Layers size={12} strokeWidth={1.25} className={iconClass} />}
          />
        )}
      </div>
    );
  };

  return (
    <div className="motion-safe:animate-fade-in">
      {(() => {
        const canonical = `https://www.maisonaffluency.com/designers/${designer.slug}/${productSlug}`;
        const ogImg = toOgImage(product.image_url || images[0] || null);
        const desc =
          (product.description?.replace(/\s+/g, " ").trim().slice(0, 155)) ||
          `${product.title} by ${designerDisplay}. ${product.materials || "Collectible design at Maison Affluency."}`.slice(0, 155);
        const ldDims = parseDimensions(product.dimensions);
        const productLd = {
          "@context": "https://schema.org",
          "@type": "Product",
          name: pageTitle,
          description: desc,
          image: images.length ? images : [ogImg],
          brand: { "@type": "Brand", name: designerDisplay },
          category: product.subcategory || product.category || undefined,
          material: product.materials || product.materials_description || undefined,
          sku: product.id,
          mpn: product.id,
          url: canonical,
          width: quantitativeValue(ldDims?.width, ldDims?.unit || "CMT"),
          depth: quantitativeValue(ldDims?.depth, ldDims?.unit || "CMT"),
          height: quantitativeValue(ldDims?.height, ldDims?.unit || "CMT"),
          // Never expose pricing to unauthenticated crawlers — the Offer stays
          // price-free and simply points at the enquiry flow.
          offers: {
            "@type": "Offer",
            availability: "https://schema.org/InStock",
            url: canonical,
            seller: { "@type": "Organization", name: "Maison Affluency" },
          },
        };

        const crumbsLd = {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://www.maisonaffluency.com" },
            { "@type": "ListItem", position: 2, name: "Designers", item: "https://www.maisonaffluency.com/designers" },
            { "@type": "ListItem", position: 3, name: designerDisplay, item: `https://www.maisonaffluency.com/designers/${designer.slug}` },
            { "@type": "ListItem", position: 4, name: product.title, item: canonical },
          ],
        };
        return (
          <Helmet>
            <title>{pageTitle} — Maison Affluency</title>
            <meta name="description" content={desc} />
            <link rel="canonical" href={canonical} />
            <meta property="og:type" content="product" />
            <meta property="og:site_name" content="Maison Affluency" />
            <meta property="og:title" content={`${pageTitle} — Maison Affluency`} />
            <meta property="og:description" content={desc} />
            <meta property="og:url" content={canonical} />
            <meta property="og:image" content={ogImg} />
            <meta property="og:image:width" content="1200" />
            <meta property="og:image:height" content="630" />
            <meta property="og:image:alt" content={`${product.title} by ${designerDisplay}`} />
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content={`${pageTitle} — Maison Affluency`} />
            <meta name="twitter:description" content={desc} />
            <meta name="twitter:image" content={ogImg} />
            <script type="application/ld+json">{JSON.stringify(productLd)}</script>
            <script type="application/ld+json">{JSON.stringify(crumbsLd)}</script>
          </Helmet>
        );
      })()}

      <div className="min-h-[100dvh] bg-background text-foreground">
        <Navigation borderless />

        {/* Mobile sticky mini bar — replaces the global header once the product
             image has scrolled out of view. */}
        <div
          className={cn(
            "md:hidden fixed left-0 right-0 top-0 z-[60] bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-transform duration-300 ease-out",
            !showStickyBar && "pointer-events-none"
          )}
          style={{
            paddingTop: "env(safe-area-inset-top, 0px)",
            transform: showStickyBar ? "translateY(0)" : "translateY(-100%)",
          }}
          aria-hidden={!showStickyBar}
        >


          <div className="px-3 pt-2 pb-2.5">
            <div className="flex items-center justify-center gap-1.5 min-w-0 text-center">
              <p className="font-display text-[13px] leading-tight text-foreground truncate">
                {product.title}
              </p>
              <span className="text-muted-foreground/60 text-[11px] shrink-0">by</span>
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground truncate max-w-[45%]">
                {designerDisplay}
              </p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handlePlaceOrder}
                className="flex items-center justify-center px-3 py-2.5 rounded-luxury-micro bg-foreground text-background font-body text-[10px] uppercase tracking-[0.12em] whitespace-nowrap"
              >
                Place an Order
              </button>
              <button
                type="button"
                onClick={() => setQuoteRequestOpen(true)}
                className="flex items-center justify-center px-3 py-2.5 rounded-luxury-micro border border-foreground/30 text-foreground font-body text-[10px] uppercase tracking-[0.12em] whitespace-nowrap"
              >
                Request a Quote
              </button>
            </div>
          </div>

        </div>

        {/* Desktop slim sticky purchase bar — price + button labels follow the
            effective role so it stays in sync with the sidebar action block. */}
        <StickyPurchaseBar
          triggerId="main-product-image-container"
          image={images[0]}
          title={product.title}
          designer={designerDisplay}
          price={isTradeVerifiedView && mockNetDisplay ? mockNetDisplay : publicRrpLabel}
          currencyCode={isTradeVerifiedView && mockNetDisplay ? "Net Trade" : undefined}
          primaryLabel={isTradeVerifiedView ? "Add to Co-Pilot Workspace & Order" : "Place Order"}
          secondaryLabel={isTradeVerifiedView ? "Open Axonometric Studio" : "Request a Quote or Customisation"}
          onRequestQuote={() => setQuoteRequestOpen(true)}
          onPlaceOrder={handleDirectCheckout}
          placingOrder={checkoutLoading}
        />

        {/* Dev-only role preview switcher */}
        <DevRoleToggle />





        <div className="pt-[var(--header-h)] pb-[calc(env(safe-area-inset-bottom,0px)+5rem)] md:pb-20 max-w-7xl mx-auto px-4 md:px-5 lg:px-8">
          <button
            type="button"
            onClick={() => navigate(fromPath || fallbackGridPath)}
            className="mb-4 hidden md:inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back

          </button>

          <div className="hidden md:block">
            <Breadcrumbs
              items={buildProductBreadcrumbs({
                root: { label: "Home", to: "/" },
                category: product.category,
                subcategory: product.subcategory,
                title: product.title,
              })}
              className="mb-6"
            />
          </div>

          {/* Mobile breadcrumbs — 1stdibs style: single line, "/" separators, no product title */}
          <div className="md:hidden -mt-2 mb-3">
            <Breadcrumbs
              items={buildProductBreadcrumbs({
                root: { label: "Home", to: "/" },
                category: product.category,
                subcategory: product.subcategory,
                // omit title on mobile
              })}
              variant="compact"
            />
          </div>


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-8 lg:gap-16">
            <div id="main-product-image-container" className="relative -mx-4 md:mx-0 md:sticky md:top-[calc(var(--header-h)+1rem)] h-fit self-start z-30 bg-background" ref={galleryScrollRef}>
              <ProductImageGallery
                images={visibleImages}
                alt={product.title}
                activeIndex={visibleActiveIndex}
                activeIndexNonce={galleryJumpNonce}
                onIndexChange={(i) =>
                  setGalleryActiveIndex(visibleImageIndices ? (visibleImageIndices[i] ?? visibleImageIndices[0]) : i)
                }
                caption={product.gallery_captions?.[String(galleryActiveIndex ?? 0)] || null}
                compact={galleryCompact}
                pickId={product.id}


                overlay={
                  /* Favorite / studio save stays top-right. */
                  <div className="hidden md:flex items-center gap-3">
                    {user && (isTradeUser || tradeStatus === "approved") ? (
                      <CornerTooltip label="Save to Studio" side="bottom" align="end">
                        <StudioSaveButton
                          pickId={product.id}
                          productTitle={product.title}
                          finishes={selectedFinishes}
                        />
                      </CornerTooltip>
                    ) : (
                      <CornerTooltip label={favorited ? "Saved to Favorites" : "Save to Favorites"} side="bottom" align="end">
                        <FavoriteFolderPicker pickId={product.id} align="end" side="bottom">
                          <button
                            onClick={(e) => e.stopPropagation()}
                            aria-label={favorited ? "Saved to favorites" : "Add to favorites"}
                            className="flex items-center justify-center w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25"
                          >
                            <Heart size={20} strokeWidth={1.5} className={cn(favorited ? "fill-destructive text-destructive" : "text-foreground/80")} />
                          </button>
                        </FavoriteFolderPicker>
                      </CornerTooltip>
                    )}
                  </div>
                }
                bottomRightOverlay={(() => {
                  // Bridge filenames are keyed off the raw designer name (e.g. "Apparatus Studio"),
                  // not the shortened display name — using designerDisplay produces a 404 link.
                  const shareUrl = buildPieceOgUrl(designer.name, product.title, product.subtitle);
                  return (
                    <CornerTooltip label="Share" side="top" align="end">
                      <ShareMenu
                        url={shareUrl}
                        message={`${product.title} by ${designerDisplay} — Maison Affluency: ${shareUrl}`}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25 text-foreground/80"
                        iconSize="w-[18px] h-[18px]"
                        iconVariant="ios"
                        showLabel={false}
                        imageUrl={images?.[galleryActiveIndex ?? 0] || images?.[0]}
                        imageName={`${product.title}-${designerDisplay}`}
                      />
                    </CornerTooltip>
                  );
                })()}
              />



              {/* Mobile-only image overlay: share + favorite / studio save, top-right */}
              <div className="md:hidden pointer-events-none absolute inset-x-0 top-0 z-40" style={{ height: galleryCompact ? "20vh" : "45vh" }}>
                <div className="absolute top-4 right-4 flex items-center gap-3 pointer-events-auto">
                  {user && (isTradeUser || tradeStatus === "approved") ? (
                    // Trade members get the studio "drop" anchor instead of the
                    // retail heart: one tap → bottom sheet → project.
                    <StudioSaveButton
                      pickId={product.id}
                      productTitle={product.title}
                      finishes={selectedFinishes}
                    />
                  ) : (
                    <FavoriteFolderPicker pickId={product.id} align="end" side="bottom">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        aria-label={favorited ? "Saved to favorites" : "Add to favorites"}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25"
                      >
                        <Heart size={20} strokeWidth={1.5} className={cn(favorited ? "fill-destructive text-destructive" : "text-foreground/80")} />
                      </button>
                    </FavoriteFolderPicker>
                  )}
                </div>

              </div>


              {/* Inline "Shown in" caption — hidden on mobile/PWA; shown in presentation mode instead. */}
              {!isMobileOrPwa && (
                <div className="md:border-0 md:shadow-none border-b border-border/60 shadow-[0_6px_10px_-8px_rgba(0,0,0,0.35)] pb-2">
                  <ActiveSwatchCaption pickId={product.id} activeIndex={galleryActiveIndex ?? 0} />
                </div>
              )}

              {/* "The Creation" — desktop only. */}
              {!isMobileOrPwa && product.description && product.description.trim().length > 0 && (
                <section aria-label="About this creation" className="mt-6">
                  <h2 className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    The Creation
                  </h2>
                  <p className="font-body text-sm leading-relaxed text-muted-foreground whitespace-pre-line text-justify">
                    {product.description}
                  </p>
                </section>
              )}

            </div>


            <div className="relative flex flex-col gap-3 md:gap-6">
              {isMobileOrPwa ? (
                <>
                  {/* Mobile/PWA: Trade-first flow with finish selector below image. */}
                  <VariantSelectorsProvider
                    product={product}
                    onMaterialChange={handleMaterialChange}
                    galleryActiveIndex={galleryActiveIndex}
                    finishMap={productFinishMap}
                    onSwatchImagesChange={(indices, meta) => {
                      if (!indices || indices.length === 0) {
                        setSwatchImageIndices(null);
                        return;
                      }
                      // Rugs keep the full thumbnail rail visible; picking a
                      // finish jumps to its photo instead of pruning the reel.
                      setSwatchImageIndices(meta?.jumpOnly ? null : indices);
                      setGalleryActiveIndex(Math.max(0, indices[0] - 1));
                      setGalleryJumpNonce((n) => n + 1);
                    }}
                    onFinishesMissingImagesChange={setFinishesMissingImages}
                    onDisplayedFinishesChange={setDisplayedFinishes}
                    onFinishGroupingResolved={() => setFinishGroupingPending(false)}
                  >
                    <div className="flex flex-col gap-5 order-2">
                      <VariantFinishSelectors section="primary" />
                    </div>

                    <div className="min-w-0 pt-0 pb-1 md:py-5 order-1">
                      <div className="flex flex-col items-start">
                        <Link
                          to={`/designers/${designer.slug}`}
                          onClick={() => rememberProductBackRef(designer.slug, location.pathname + location.search)}
                          className="font-display text-[14px] md:text-[16px] uppercase tracking-[0.14em] text-foreground hover:text-foreground/80 transition-colors"
                        >
                          {designerDisplay}
                        </Link>
                        <div className="mt-2 w-8 md:w-10 h-px bg-foreground/20" aria-hidden="true" />
                      </div>
                      <h1 className="font-display font-normal text-[1.5rem] md:text-[1.85rem] mt-4 leading-[1.15] tracking-[-0.01em]">
                        {product.title}
                        {(() => {
                          const editionLabel = formatEditionLabel(product as any);
                          return editionLabel ? (
                            <span className="ml-3 inline-block whitespace-nowrap rounded-none border border-neutral-300 bg-background px-2 py-0.5 align-baseline font-body text-[9px] font-medium uppercase tracking-[0.22em] text-foreground/60">
                              {editionLabel}
                            </span>
                          ) : null;
                        })()}
                        {formatProductSubtitleLine(product.title, product.subtitle) && (
                          <span className="block mt-1 text-[0.8em] text-muted-foreground">
                            {formatProductSubtitleLine(product.title, product.subtitle)}
                          </span>
                        )}
                      </h1>

                      {isTradeVerifiedView && mockNetDisplay ? (
                        <div className="mt-6">
                          <p className="font-body font-light text-base md:text-lg tabular-nums tracking-[0.01em]">
                            {hasFromPrefix && (
                              <span className="text-muted-foreground text-[11px] uppercase tracking-[0.22em] align-middle mr-2">From</span>
                            )}
                            <span className="text-foreground align-middle">{mockNetLabel}</span>
                            <span className="ml-2 align-middle font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Net Trade Price</span>
                          </p>
                          {retailPlainLabel && (
                            <p className="mt-1 font-body text-[11px] tracking-[0.04em] text-muted-foreground">
                              <span className="line-through decoration-muted-foreground/50">Retail: {retailPlainLabel}</span>
                            </p>
                          )}
                          <ShippingDetailsAccordion />
                        </div>
                      ) : publicRrpLabel && (
                        <div className="mt-6">
                          <p className="font-body font-light text-base md:text-lg tabular-nums tracking-[0.01em]">
                            {(() => {
                              const spaceIdx = publicRrpLabel.indexOf(" ");
                              if (spaceIdx === -1) return <span className="text-foreground">{publicRrpLabel}</span>;
                              const prefix = publicRrpLabel.slice(0, spaceIdx);
                              const rest = publicRrpLabel.slice(spaceIdx + 1);
                              return (
                                <>
                                  <span className="text-muted-foreground text-[11px] uppercase tracking-[0.22em] align-middle mr-2">{prefix}</span>
                                  <span className="text-foreground align-middle">{rest}</span>
                                </>
                              );
                            })()}
                          </p>
                          {isTradeUnverifiedView && (
                            <p className="mt-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-amber-600">
                              Trade Program Verification Pending
                            </p>
                          )}
                          <ShippingDetailsAccordion />
                        </div>
                      )}
                    </div>
                    <div className="order-7 md:order-5 flex flex-col gap-5">
                      <VariantFinishSelectors section="supplemental" />
                      {finishesMissingImages.length > 0 && (
                        <p className="font-body text-[11px] text-muted-foreground italic mt-1">
                          No reference image on file for{" "}
                          <span className="text-foreground">{finishesMissingImages.join(", ")}</span>.
                          We'll note this on your enquiry so our concierge can confirm visuals.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-5 order-4 md:order-5">
                      <VariantDimensionsPanel />
                    </div>
                  </VariantSelectorsProvider>

                  <div className="order-3 md:order-4">
                    <TradeFirstCta
                      redirectTo={location.pathname + location.search}
                      rrpLabel={publicRrpLabel}
                      onRequestQuote={() => setQuoteRequestOpen(true)}
                      signedIn={!!user && !authLoading}
                    />
                  </div>

                  <div className="order-5 md:order-6">
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
                        <div className="border-b border-border/60 pb-3 flex items-start gap-5">
                          {specIcon("✦", "mt-0.5")}
                          <div className="font-body text-sm leading-relaxed text-muted-foreground font-normal">
                            <OriginStoryDrawer label={originLine} maker={designerDisplay} />

                            {leadLine && <p className="mt-0.5">{leadLine}</p>}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="order-6 md:order-6 flex flex-col items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setQuoteRequestOpen(true)}
                      className="font-body text-[11px] tracking-[0.06em] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Need project assistance?{" "}
                      <span className="underline underline-offset-4 decoration-border">
                        Speak with an Advisor
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDirectCheckout()}
                      disabled={checkoutLoading}
                      className="flex items-center justify-center gap-2 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 underline underline-offset-4 decoration-border hover:text-foreground transition-colors disabled:opacity-60"
                    >
                      {checkoutLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ShoppingBag className="h-3 w-3" />
                      )}
                      {checkoutLoading ? "Opening checkout…" : "Or complete secure checkout"}
                    </button>
                  </div>

                  <div className="flex flex-col gap-5 order-8 md:order-6">
                    {/* Desktop: utility links moved into the main action panel.
                        Mobile keeps a standalone compact row here. */}
                    <div className="md:hidden">{renderUtilityLinks()}</div>

                    {(() => {
                      const variants = (product.size_variants || []) as any[];
                      const upholstery = Array.from(
                        new Set(
                          variants
                            .map((v) => String(v?.top || v?.label || "").trim())
                            .filter(Boolean)
                        )
                      ).slice(0, 24);
                      return (
                        <PublicSpecTable
                          dimensions={product.dimensions}
                          materials={product.materials}
                          materialsDescription={(product as any).materials_description}
                          upholsteryOptions={product.is_upholstered ? upholstery : []}
                          sku={product.id}
                        />
                      );
                    })()}
                  </div>
                </>
              ) : (
                <>
                  {/* Desktop: restored classic layout. */}
                  <div className="min-w-0">
                    <div className="flex flex-col items-start">
                      <Link
                        to={`/designers/${designer.slug}`}
                        onClick={() => rememberProductBackRef(designer.slug, location.pathname + location.search)}
                        className="font-display text-[16px] md:text-[18px] uppercase tracking-[0.14em] text-foreground hover:text-foreground/80 transition-colors"
                      >
                        {designerDisplay}
                      </Link>
                      <div className="mt-2.5 w-10 md:w-12 h-px bg-foreground/20" aria-hidden="true" />
                    </div>
                    <h1 className="font-display font-normal text-[1.75rem] md:text-[2.15rem] mt-5 leading-[1.15] tracking-[-0.01em]">
                      {product.title}
                      {(() => {
                        const editionLabel = formatEditionLabel(product as any);
                        return editionLabel ? (
                          <span className="ml-3 inline-block whitespace-nowrap rounded-none border border-neutral-300 bg-background px-2 py-0.5 align-baseline font-body text-[9px] font-medium uppercase tracking-[0.22em] text-foreground/60">
                            {editionLabel}
                          </span>
                        ) : null;
                      })()}
                      {formatProductSubtitleLine(product.title, product.subtitle) && (
                        <span className="block mt-1 text-[0.8em] text-muted-foreground">
                          {formatProductSubtitleLine(product.title, product.subtitle)}
                        </span>
                      )}
                    </h1>

                    {isTradeVerifiedView && mockNetDisplay ? (
                      <div className="mt-6">
                        <p className="font-body font-light text-base md:text-lg tabular-nums tracking-[0.01em]">
                          {hasFromPrefix && (
                            <span className="text-muted-foreground text-[11px] uppercase tracking-[0.22em] align-middle mr-2">From</span>
                          )}
                          <span className="text-foreground align-middle">{mockNetLabel}</span>
                          <span className="ml-2 align-middle font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Net Trade Price</span>
                        </p>
                        {retailPlainLabel && (
                          <p className="mt-1 font-body text-[11px] tracking-[0.04em] text-muted-foreground">
                            <span className="line-through decoration-muted-foreground/50">Retail: {retailPlainLabel}</span>
                          </p>
                        )}
                        <ShippingDetailsAccordion />
                      </div>
                    ) : publicRrpLabel && (
                      <div className="mt-6">
                        <p className="font-body font-light text-base md:text-lg tabular-nums tracking-[0.01em]">
                          {(() => {
                            const spaceIdx = publicRrpLabel.indexOf(" ");
                            if (spaceIdx === -1) return <span className="text-foreground">{publicRrpLabel}</span>;
                            const prefix = publicRrpLabel.slice(0, spaceIdx);
                            const rest = publicRrpLabel.slice(spaceIdx + 1);
                            return (
                              <>
                                <span className="text-muted-foreground text-[11px] uppercase tracking-[0.22em] align-middle mr-2">{prefix}</span>
                                <span className="text-foreground align-middle">{rest}</span>
                              </>
                            );
                          })()}
                        </p>
                        {isTradeUnverifiedView && (
                          <p className="mt-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-amber-600">
                            Trade Program Verification Pending
                          </p>
                        )}
                        <ShippingDetailsAccordion />
                      </div>
                    )}
                  </div>

                  <VariantSelectorsProvider
                    product={product}
                    onMaterialChange={handleMaterialChange}
                    galleryActiveIndex={galleryActiveIndex}
                    finishMap={productFinishMap}
                    onSwatchImagesChange={(indices, meta) => {
                      if (!indices || indices.length === 0) {
                        setSwatchImageIndices(null);
                        return;
                      }
                      // Rugs keep the full thumbnail rail visible; picking a
                      // finish jumps to its photo instead of pruning the reel.
                      setSwatchImageIndices(meta?.jumpOnly ? null : indices);
                      setGalleryActiveIndex(Math.max(0, indices[0] - 1));
                      setGalleryJumpNonce((n) => n + 1);
                    }}
                    onFinishesMissingImagesChange={setFinishesMissingImages}
                    onDisplayedFinishesChange={setDisplayedFinishes}
                    onFinishGroupingResolved={() => setFinishGroupingPending(false)}
                  >
                    <div className="flex flex-col gap-5">
                      <VariantFinishSelectors />
                      {finishesMissingImages.length > 0 && (
                        <p className="font-body text-[11px] text-muted-foreground italic mt-1">
                          No reference image on file for{" "}
                          <span className="text-foreground">{finishesMissingImages.join(", ")}</span>.
                          We'll note this on your enquiry so our concierge can confirm visuals.
                        </p>
                      )}
                    </div>

                    {/* Action block sits directly beneath the finish selector,
                        ahead of the supporting technical details. */}
                    {showPublicCommerce && (
                      <ProductCommerceCta
                        productId={product.id}
                        rrpLabel={publicRrpLabel}
                        productTitle={product.title}
                        designerName={designerDisplay}
                        imageUrl={images[galleryActiveIndex ?? 0] || images[0] || product.image_url || null}
                        leadTime={product.lead_time}
                        onPlaceOrder={handleDirectCheckout}
                        placingOrder={checkoutLoading}
                        onRequestQuote={() => setQuoteRequestOpen(true)}
                        selectedFinishes={selectedFinishes}
                  orderFinishLabel={buildOrderFinishLabel()}
                        redirectTo={location.pathname + location.search}
                        utilityLinks={renderUtilityLinks()}
                      />
                    )}

                    {/* Dev role preview — verified trade: in-flow net-price
                        action block with workspace / studio buttons. */}
                    {showMockTradeCommerce && (
                      <ProductCommerceCta
                        productId={product.id}
                        rrpLabel={publicRrpLabel}
                        tradeApproved
                        netLabelOverride={mockNetLabel}
                        retailLabelOverride={retailPlainLabel}
                        productTitle={product.title}
                        designerName={designerDisplay}
                        imageUrl={images[galleryActiveIndex ?? 0] || images[0] || product.image_url || null}
                        leadTime={product.lead_time}
                        onPlaceOrder={handleDirectCheckout}
                        placingOrder={checkoutLoading}
                        onRequestQuote={() => setQuoteRequestOpen(true)}
                        selectedFinishes={selectedFinishes}
                  orderFinishLabel={buildOrderFinishLabel()}
                        redirectTo={location.pathname + location.search}
                        utilityLinks={renderUtilityLinks()}
                      />
                    )}

                    <div className="flex flex-col gap-5">
                      <VariantDimensionsPanel />
                    </div>
                  </VariantSelectorsProvider>

                  {(() => {
                    // Lead time intentionally excluded here — it lives at the
                    // top of the action block so it binds to the purchase flow.
                    const handcrafted = formatHandcrafted(product.origin, null);
                    if (!handcrafted) return null;
                    return (
                      <div className="border-b border-border/60 pb-3 flex items-start gap-5">
                        {specIcon("✦", "mt-0.5")}
                        <div className="font-body text-sm leading-relaxed text-muted-foreground font-normal">
                          <p>{handcrafted}</p>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col gap-5">
                    {/* Utility links moved into the main action panel on
                        desktop; compact standalone row on mobile. */}
                    <div className="md:hidden">{renderUtilityLinks()}</div>

                    {(() => {
                      const variants = (product.size_variants || []) as any[];
                      const upholstery = Array.from(
                        new Set(
                          variants
                            .map((v) => String(v?.top || v?.label || "").trim())
                            .filter(Boolean)
                        )
                      ).slice(0, 24);
                      return (
                        <PublicSpecTable
                          dimensions={product.dimensions}
                          materials={product.materials}
                          materialsDescription={(product as any).materials_description}
                          upholsteryOptions={product.is_upholstered ? upholstery : []}
                          sku={product.id}
                        />
                      );
                    })()}
                  </div>
                </>
              )}

              {/* Mobile/PWA sticky bottom dock for signed-out visitors —
                  the in-flow panel lives in the desktop branch above. */}
              {showPublicCommerce && (
                <ProductCommerceCta
                  productId={product.id}
                  rrpLabel={publicRrpLabel}
                  dockOnly
                  productTitle={product.title}
                  designerName={designerDisplay}
                  imageUrl={images[galleryActiveIndex ?? 0] || images[0] || product.image_url || null}
                  leadTime={product.lead_time}
                  onPlaceOrder={handleDirectCheckout}
                  placingOrder={checkoutLoading}
                  onRequestQuote={() => setQuoteRequestOpen(true)}
                  selectedFinishes={selectedFinishes}
                  orderFinishLabel={buildOrderFinishLabel()}
                  redirectTo={location.pathname + location.search}
                />
              )}

              {/* Dev role preview — verified trade mobile dock */}
              {showMockTradeCommerce && (
                <ProductCommerceCta
                  productId={product.id}
                  rrpLabel={publicRrpLabel}
                  tradeApproved
                  dockOnly
                  netLabelOverride={mockNetLabel}
                  retailLabelOverride={retailPlainLabel}
                  productTitle={product.title}
                  designerName={designerDisplay}
                  imageUrl={images[galleryActiveIndex ?? 0] || images[0] || product.image_url || null}
                  leadTime={product.lead_time}
                  onPlaceOrder={handleDirectCheckout}
                  placingOrder={checkoutLoading}
                  onRequestQuote={() => setQuoteRequestOpen(true)}
                  selectedFinishes={selectedFinishes}
                  orderFinishLabel={buildOrderFinishLabel()}
                  redirectTo={location.pathname + location.search}
                />
              )}

              {/* Signed-in visitors. Verified trade members get the full
                  workspace (net pricing, availability, spec sheet + Felix);
                  everyone else signed in keeps the enquiry CTA. */}
              {user && !roleOverridden && (() => {
                const returnTo = typeof window !== "undefined" ? location.pathname + location.search : "";
                const q = new URLSearchParams({
                  subject: `Price upon Request — ${product.title} by ${designerDisplay}`,
                  productId: product.id,
                  productSlug: productSlug || "",
                  productName: product.title || "",
                  designerName: designerDisplay || "",
                  back: returnTo || "",
                });
                const inquireHref = `/contact?${q.toString()}#contact`;

                const tradeApproved = isTradeUser || tradeStatus === "approved";

                if (!tradeApproved && tradeStatus === "pending_review") {
                  return <TradePendingReviewCard />;
                }

                if (tradeApproved) {
                  return (
                    <div className={isMobileOrPwa ? "order-2" : undefined}>
                    <TradeWorkspace
                      productId={product.id}
                      title={product.title}
                      designerDisplay={designerDisplay}
                      dimensions={product.dimensions}
                      materials={product.materials || (product as any).materials_description}
                      originLine={product.origin}
                      leadTime={product.lead_time}
                      selectedFinishes={selectedFinishes}
                      selectedVariantCents={productData.baseRetailPriceCents || null}
                      selectedVariantExact={!!selectedVariantPrice?.exact}
                      returnPath={returnTo}
                      pdfUrl={product.pdf_url}
                      pdfUrls={product.pdf_urls}
                      inquireHref={inquireHref}
                      felixUrl={typeof window !== "undefined" ? window.location.href : undefined}
                      compact={isMobileOrPwa}
                    />
                    <ProductCommerceCta
                      productId={product.id}
                      rrpLabel={publicRrpLabel}
                      tradeApproved
                      dockOnly
                      onPlaceOrder={handleDirectCheckout}
                      placingOrder={checkoutLoading}
                      onRequestQuote={() => setQuoteRequestOpen(true)}
                      selectedFinishes={selectedFinishes}
                  orderFinishLabel={buildOrderFinishLabel()}
                      redirectTo={returnTo}
                    />
                    </div>
                  );
                }

                return (
                  <div className="mt-2 space-y-2">
                    <button
                      type="button"
                      onClick={() => setQuoteRequestOpen(true)}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-luxury-micro font-body text-[11px] md:text-xs uppercase tracking-[0.12em] transition-all w-full text-center bg-foreground text-background hover:bg-foreground/90"
                    >
                      Inquire for Pricing
                    </button>
                  </div>
                );
              })()}

              <QuoteRequestDialog
                open={quoteRequestOpen}
                onOpenChange={setQuoteRequestOpen}
                productName={product.title}
                designerName={designerDisplay}
              />

              {/* Signed-out spec sheet explainer — points back to the trade card. */}
              <Dialog open={specSheetLocked} onOpenChange={setSpecSheetLocked}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display text-xl">Spec sheets are trade access</DialogTitle>
                    <DialogDescription className="font-body text-sm leading-relaxed">
                      Technical documentation for the {product.title} is reserved for verified trade
                      members. Sign in above, or apply for trade access — approval takes a day or two.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link
                      to={`/trade/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                      className="inline-flex items-center justify-center px-5 py-3 rounded-luxury-micro bg-foreground text-background font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors"
                    >
                      Sign in to view
                    </Link>
                    <Link
                      to="/trade/register"
                      className="inline-flex items-center justify-center px-5 py-3 rounded-luxury-micro border border-foreground/40 text-foreground font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/5 transition-colors"
                    >
                      Apply for trade access
                    </Link>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>






          {relatedPicks.length > 0 && (
            <div id="related-picks-section" className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Mobile-only heading: shown above the carousel */}
                <div className="lg:hidden order-1">
                  <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {(product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title))) ? "From the Same Maker" : "From the Same Designer"}
                  </p>
                  <h2 className="flex flex-col items-start">
                    <Link
                      to={`/designers/${designer.slug}`}
                      onClick={() => rememberProductBackRef(designer.slug, location.pathname + location.search)}
                      className="font-display text-[14px] md:text-[16px] uppercase tracking-[0.14em] text-foreground hover:text-foreground/80 transition-colors"
                    >
                      {designerDisplay}
                    </Link>
                    <span className="mt-2 w-8 md:w-10 h-px bg-foreground/20" aria-hidden="true" />
                  </h2>
                  {brandSummary && (() => {
                    const PREVIEW_LEN = 240;
                    const needsToggle = brandSummary.length > PREVIEW_LEN;
                    let preview = brandSummary;
                    if (needsToggle) {
                      const slice = brandSummary.slice(0, PREVIEW_LEN);
                      const sentenceMatch = slice.match(/.*[.!?](?=\s|$)/);
                      const lastSentenceEnd = sentenceMatch ? sentenceMatch[0].length : -1;
                      const lastSpace = slice.lastIndexOf(" ");
                      const cutIndex = lastSentenceEnd > 0 ? lastSentenceEnd : lastSpace > 0 ? lastSpace : PREVIEW_LEN;
                      preview = slice.slice(0, cutIndex).trim() + "…";
                    }
                    const shown = bioExpanded || !needsToggle ? brandSummary : preview;
                    return (
                      <div className="mt-4">
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

                {/* Carousel: swipeable on mobile, paginated 3-up on desktop. */}
                <div className="lg:col-span-8 flex flex-col order-2 lg:order-2">
                  {/* Mobile: native horizontal scroll-snap carousel */}
                  <div className="lg:hidden -mx-4 px-4">
                    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {relatedPicks.map((rp) => (
                        <Link
                          key={rp.id}
                          to={`/designers/${designer.slug}/${rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
                          state={{ from: location.pathname + location.search }}
                          className="group block shrink-0 basis-[70%] snap-start"
                          onTouchStart={() => prefetchPublicProductPage(queryClient, designer.slug, rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : "")))}
                          onMouseEnter={() => prefetchPublicProductPage(queryClient, designer.slug, rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : "")))}
                        >
                          <ProductPrefetchOnVisible
                            designerSlug={designer.slug}
                            productSlug={rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}
                          />
                          <div className="relative aspect-square rounded-luxury-sharp overflow-hidden bg-muted/30 border border-border">
                            <img
                              src={rp.image_url}
                              alt={rp.title}
                              className="absolute inset-0 w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="mt-2 text-center">
                            {rp.subtitle && (
                              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground leading-tight line-clamp-1">
                                {rp.subtitle}
                              </p>
                            )}
                            <p className="font-body text-xs text-foreground mt-1 truncate">
                              {rp.title}
                            </p>
                            <p className="font-body text-[10px] text-muted-foreground tracking-wide mt-1">
                              {formatPublicRrp((relatedRrpMap as any)[rp.id]) || "Price upon Request"}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* Desktop: 3-up grid */}
                  <div className="hidden lg:grid grid-cols-3 gap-4 md:gap-6">
                    {visibleRelated.map((rp) => (
                      <Link
                        key={rp.id}
                        to={`/designers/${designer.slug}/${rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
                        state={{ from: location.pathname + location.search }}
                        className="group block"
                        onMouseEnter={() => prefetchPublicProductPage(queryClient, designer.slug, rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : "")))}
                        onFocus={() => prefetchPublicProductPage(queryClient, designer.slug, rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : "")))}
                        onTouchStart={() => prefetchPublicProductPage(queryClient, designer.slug, rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : "")))}
                      >
                        <ProductPrefetchOnVisible
                          designerSlug={designer.slug}
                          productSlug={rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}
                        />
                        <div className="relative aspect-square rounded-luxury-sharp overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/40 transition-colors">
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
                        <div className="mt-3 text-center">
                          {rp.subtitle && (
                            <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground leading-tight line-clamp-1">
                              {rp.subtitle}
                            </p>
                          )}
                          <p className="font-body text-[13px] text-foreground mt-1 truncate group-hover:text-foreground/70 transition-colors">
                            {rp.title}
                          </p>
                          <p className="font-body text-xs text-muted-foreground tracking-wide mt-1">
                            {formatPublicRrp((relatedRrpMap as any)[rp.id]) || "Price upon Request"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>

                  {/* Desktop pagination: minimalist progress track flanked by
                      raw hairline chevrons. */}
                  {relatedPicks.length > visibleCount && (
                    <div className="hidden lg:flex mt-6 items-center justify-center gap-6">
                      <button
                        type="button"
                        onClick={() => setRelatedIndex((i) => Math.max(0, i - 1))}
                        disabled={safeIndex === 0}
                        aria-label="Previous"
                        className="text-foreground/70 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-opacity"
                      >
                        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" aria-hidden="true">
                          <path d="M11 1 3 10l8 9" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
                        </svg>
                      </button>

                      <div className="relative h-px w-40 bg-foreground/15" role="presentation">
                        <div
                          className="absolute inset-y-0 h-px bg-foreground transition-[left,width] duration-500 ease-out"
                          style={{
                            width: `${100 / (maxIndex + 1)}%`,
                            left: `${(safeIndex * 100) / (maxIndex + 1)}%`,
                          }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setRelatedIndex((i) => Math.min(maxIndex, i + 1))}
                        disabled={safeIndex >= maxIndex}
                        aria-label="Next"
                        className="text-foreground/70 hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-opacity"
                      >
                        <svg width="14" height="20" viewBox="0 0 14 20" fill="none" aria-hidden="true">
                          <path d="M3 1l8 9-8 9" stroke="currentColor" strokeWidth="1" strokeLinecap="square" />
                        </svg>
                      </button>
                    </div>
                  )}

                </div>

                {/* Brand summary — desktop column; mobile copy sits directly below the maker name. */}
                <div className="hidden lg:block lg:col-span-4 lg:pr-4 lg:order-1">
                  <div>
                    <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      {(product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title))) ? "From the Same Maker" : "From the Same Designer"}
                    </p>
                    <h2 className="flex flex-col items-start mb-5">
                      <Link
                        to={`/designers/${designer.slug}`}
                        onClick={() => rememberProductBackRef(designer.slug, location.pathname + location.search)}
                        className="font-display text-[14px] md:text-[16px] uppercase tracking-[0.14em] text-foreground hover:text-foreground/80 transition-colors"
                      >
                        {designerDisplay}
                      </Link>
                      <span className="mt-2 w-8 md:w-10 h-px bg-foreground/20" aria-hidden="true" />
                    </h2>
                  </div>
                  {brandSummary && (() => {
                    const PREVIEW_LEN = 240;
                    const needsToggle = brandSummary.length > PREVIEW_LEN;
                    let preview = brandSummary;
                    if (needsToggle) {
                      const slice = brandSummary.slice(0, PREVIEW_LEN);
                      // End the preview at the last complete sentence so dangling
                      // fragments like "Guided by the…" are hidden below Read more.
                      const sentenceMatch = slice.match(/.*[.!?](?=\s|$)/);
                      const lastSentenceEnd = sentenceMatch ? sentenceMatch[0].length : -1;
                      const lastSpace = slice.lastIndexOf(" ");
                      const cutIndex = lastSentenceEnd > 0 ? lastSentenceEnd : lastSpace > 0 ? lastSpace : PREVIEW_LEN;
                      preview = slice.slice(0, cutIndex).trim() + "…";
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
      <GalleryDetailsFloatingNav
        showAfterElementId="related-picks-section"
        azHref="/designers"
        allCategoriesHref={
          product?.category
            ? categoryUrl(product.category, product.subcategory ?? null)
            : undefined
        }
      />

      <AuthGateDialog open={gateOpen} onClose={closeGate} action={gateAction} />
    </div>
  );
};

const PublicProductPage: React.FC = () => (
  <UserRoleProvider>
    <PublicProductPageContent />
  </UserRoleProvider>
);

export default PublicProductPage;
