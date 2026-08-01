import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link, useLocation, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Heart, Scale, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, Truck } from "lucide-react";
import ShareMenu from "@/components/ShareMenu";
import { buildPieceOgUrl } from "@/lib/whatsapp-share";
import { cloudinaryUrl } from "@/lib/cloudinary";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useAuthGate } from "@/hooks/useAuthGate";
import AuthGateDialog from "@/components/AuthGateDialog";
import { cn } from "@/lib/utils";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ProductDetailSkeleton from "@/components/product/ProductDetailSkeleton";
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";
import { normalizeCategoryContext } from "@/lib/categoryNormalization";
import { formatEditionLabel } from "@/lib/editionLabel";
import { renderParagraph } from "@/components/EditorialBiography";
import { formatDimensionsMultiline, formatImperialDimensions, withImperialPerLine } from "@/lib/formatDimensions";
import ExpandableSpec from "@/components/ExpandableSpec";
import LegendDisclosure from "@/components/LegendDisclosure";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { categoryUrl } from "@/lib/categorySlugs";
import { buildProductBreadcrumbs } from "@/lib/productBreadcrumbs";
import { getBasePlaceholder, getTopPlaceholder, getMaterialPlaceholder, formatVariantAxisLabel, isDimensionAxisLabel, resolveFinishSectionLabels } from "@/lib/variantPlaceholders";
import { computeVariantAxes, parseMaterialsFallback } from "@/lib/parseSizeVariants";
import { isRugCategory, parseRugDims, looksLikeDimension } from "@/lib/rugPricing";
import FinishSelector from "@/components/FinishSelector";
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
import { isCollectibleSlug, collectibleGateRedirect } from "@/lib/collectibleGate";
import {
  PublicSpecTable,
  TradeExclusiveCard,
  parseDimensions,
  quantitativeValue,
} from "@/components/product/PublicSpecTable";
import TradeWorkspace from "@/components/product/TradeWorkspace";
import TradePendingReviewCard from "@/components/product/TradePendingReviewCard";
import CustomizationRequest from "@/components/product/CustomizationRequest";
import { usePublicRrp, formatPublicRrp, formatPublicRrpCents } from "@/hooks/usePublicRrp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";


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
    queryFn: async () => {
      if (!designerSlug || !productSlug) return null;

      const { data: designer } = await supabase
        .from("designers")
        .select("id, name, slug, display_name, biography")
        .eq("slug", designerSlug)
        .eq("is_published", true)
        .eq("trade_only", false)
        .maybeSingle();
      if (!designer) return null;

      const publicPickFields = "id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered";

      const { data: picks } = await supabase
        .from("designer_curator_picks_public" as any)
        .select(publicPickFields)
        .eq("designer_id", designer.id)
        .order("sort_order", { ascending: true });

      if (!picks || picks.length === 0) return null;

      // Canonical match on the stored slug column. Fall back to legacy
      // title-derived slugs so any bookmarked/shared URLs keep resolving.
      const product =
        picks.find((p: any) => p.slug === productSlug) ||
        picks.find((p: any) => {
          const titleSlug = slugify(p.title);
          const shortSlug = slugify(String(p.title).replace(/\s+by\s+.+$/i, ""));
          const fullSlug = slugify(p.title + (p.subtitle ? `-${p.subtitle}` : ""));
          return fullSlug === productSlug || titleSlug === productSlug || shortSlug === productSlug;
        }) ||
        picks.find((p: any) => productSlug.startsWith(`${slugify(p.title)}-`));

      if (!product) return null;

      const { data: variantMapRow } = await supabase
        .from("designer_curator_picks_public" as any)
        .select("variant_image_map")
        .eq("id", (product as any).id)
        .maybeSingle();

      const brandCandidates = Array.from(new Set([
        designer.display_name,
        designer.name,
      ].filter(Boolean)));

      let tradeProductQuery = supabase
        .from("trade_products")
        .select("image_url, gallery_images")
        .eq("product_name", (product as any).title)
        .eq("is_active", true)
        .eq("is_hidden", false)
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
          variant_image_map: (product as any).variant_image_map || (variantMapRow as any)?.variant_image_map || null,
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
const VariantSelectors: React.FC<{
  product: any;
  onMaterialChange?: (label: string | null, opts?: { base?: string | null; top?: string | null; size?: string | null; fromSwatch?: boolean }) => void;
  galleryActiveIndex?: number;
  finishMap?: Record<string, number> | null;
  onSwatchImagesChange?: (imageIndices: number[] | null) => void;
  onFinishesMissingImagesChange?: (names: string[]) => void;
}> = ({ product, onMaterialChange, galleryActiveIndex, finishMap, onSwatchImagesChange, onFinishesMissingImagesChange }) => {
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

  const [selBase, setSelBase] = useState<string | null>(null);
  const [selTop, setSelTop] = useState<string | null>(null);
  // True when this product has linked fabric/leather swatches — used to hide
  // the redundant upholstery-finish dropdown (the swatch picker already
  // drives the upholstery price tier).
  const [hasLinkedFabrics, setHasLinkedFabrics] = useState(false);
  const [linkedWoodFinishes, setLinkedWoodFinishes] = useState<string[]>([]);

  const [selDualSize, setSelDualSize] = useState<string | null>(null);
  const [selMat, setSelMat] = useState<string | null>(null);
  const [selSize, setSelSize] = useState<string | null>(null);
  const [defaultPair, setDefaultPair] = useState<{ base: string; top: string } | null>(null);

  // Reverse sync: when the user navigates the gallery (thumbnail / swipe /
  // arrow), update the dropdowns to reflect the variant whose mapped image
  // is now showing. No-op when the active image isn't tied to a variant.
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
      // Find the parsed { size, material } for this variant so we set
      // selMat to just the material (e.g. "Grand Antique Marble"),
      // not the full "size — material" label — otherwise the size
      // availability check (p.material === selMat) breaks and the
      // dropdown wrongly greys out every size.
      const parsed = singleAxisParsed.find((p) => p.variant?.label === match.label);
      const nextMat = parsed?.material ?? null;
      if (nextMat && nextMat !== selMat) setSelMat(nextMat);
      if (parsed?.size && parsed.size !== selSize) setSelSize(parsed.size);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryActiveIndex, product?.id]);


  // Default the dual-axis pickers to the first base + its compatible top
  // so users see a complete pairing on load (e.g. Pars Cocktail Table:
  // "Aged Brass + Bisque Leather" → "Paglierino Travertine"). They can
  // still switch to the other colorway and the top auto-updates.
  useEffect(() => {
    if (!isDualAxis || selBase || selTop) return;
    const variants = product.size_variants || [];
    if (!variants.length || !baseOptions.length) return;
    // Shared gating: only auto-default when there is genuinely one pairing
    // to show. Multi-base products (e.g. Stone D's three colorways) must
    // wait for an explicit user pick — otherwise we silently jump the
    // gallery to a mapped finish image and skip the editorial photos.
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

  // Single atomic reset for dual-axis selectors. Wipes Base/Top/Size in one
  // React batch and notifies the parent with an explicit cleared payload so
  // the gallery resolver always sees a fully-cleared state — no chance of
  // dropdowns showing one finish (e.g. "Sand Blaster") while the gallery
  // shows another image.
  const clearAllDualSelections = () => {
    setSelBase(null);
    setSelTop(null);
    setSelDualSize(null);
    onMaterialChange?.(null, { base: null, top: null, size: null });
  };
  const isAtDefault =
    !!defaultPair &&
    selBase === defaultPair.base &&
    selTop === defaultPair.top &&
    !selDualSize;

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
  // Only disable an axis option when NO variant exists for it given the size
  // selection. We intentionally do NOT cross-disable base ↔ top: picking the
  // other base should be allowed and will auto-swap the top to a compatible
  // pairing (handled in onChange below). Otherwise users have to "Clear
  // selection" every time they want to switch colorway.
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
  // When FinishSelector is rendered (upholstered products), it already exposes
  // fabric/leather + wood-finish swatch pickers. Suppress any base/top variant
  // dropdown whose axis label duplicates that selection (frame / wood / finish
  // / feet / leg / base). See `src/lib/finishDuplication.ts` for the pure
  // helpers — guarded by `src/lib/__tests__/finishDuplication.test.ts`.
  const isFinishAxis = isFinishAxisLabel;
  const hasWoodSwatches = linkedWoodFinishes.length > 0;
  const allBasesHaveSwatches = baseOptions.length > 0 && everyOptionCoveredBySwatches(baseOptions, linkedWoodFinishes);
  const topAxisHasSwatches = !topAxisIsDim && topOptions.length > 0 && someOptionCoveredBySwatches(topOptions, linkedWoodFinishes);
  const suppressBaseAsFinish = !baseAxisIsDim && (allBasesHaveSwatches || (hasWoodSwatches && isFinishAxis(baseAxisLabelRaw)));
  const suppressTopAsFinish = !topAxisIsDim && (topAxisHasSwatches || (isProductUpholstered(product) && isFinishAxis(topAxisLabelRaw)) || (hasWoodSwatches && isFinishAxis(topAxisLabelRaw)));
  // When the FinishSelector swatch picker already exposes every material in
  // the single-axis "size + material" split (e.g. marble finishes attached as
  // Stone swatches), suppress the parallel text dropdown so we don't render
  // the same finish picker twice.
  const suppressSingleAsFinish = shouldSuppressSingleAsFinish({
    hasSingleAxisSplit,
    singleMaterialOptions,
    linkedWoodFinishes,
  });




  // Per-square-metre rug picker short-circuit: when the product is a rug and
  // its size_variants encode parseable dimensions (e.g. "300 × 400 cm"), show
  // the dedicated picker (stock sizes + custom L × W + colour) instead of the
  // generic dropdowns. Price is hidden on the public side ("Price on request").
  const rugSqmActive =
    isRugCategory(product?.category) &&
    Array.isArray(product?.size_variants) &&
    (product.size_variants as any[]).some((v: any) => !!parseRugDims((v?.base || v?.label || "").trim()));

  if (rugSqmActive) {
    return (
      <RugSizeColourPicker
        sizeVariants={product.size_variants as any}
        pricePerSqmCents={0}
        currency={product.currency || "EUR"}
        sizeAxisLabel={product.base_axis_label}
        colourAxisLabel={product.top_axis_label}
        hidePrice
        onChange={(sel: RugSelection) => {
          const label = sel.colour ? `${sel.sizeLabel} · ${sel.colour}` : sel.sizeLabel;
          onMaterialChange?.(label, { base: sel.sizeLabel, top: sel.colour, size: sel.sizeLabel });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {/* Finishes first on mobile, second on desktop */}
      <div className="order-1 md:order-2 flex flex-col gap-2">
        <FinishSelector
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
            // Dual-axis: restrict the wood/base swatch group to swatches whose
            // name matches a baseOption value so top-axis swatches don't bleed
            // into the base picker. Token-aware so compound rows like
            // "Travertino Rosso / Grey Saint Laurent / Picasso Green" don't
            // hide the middle/trailing swatches.
            // Skip when the base axis is dimensions (size) — otherwise swatches
            // not present in any variant row (e.g. Alinea "Ceppo di Sicilia")
            // get orphaned into a second, near-empty "Table Finish" accordion.
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
            // Same reasoning as woodFilter above: when the base axis is the
            // size, there's only one finish axis — don't filter, otherwise
            // any swatch not present in a variant row gets split off into a
            // second accordion.
            isDualAxis && !baseAxisIsDim && topOptions.length >= 1
              ? makeSwatchAxisFilter(topOptions)
              : undefined
          }



          showUpholsterySection={isProductUpholstered(product)}
          showWoodSection
          onHasFabricsChange={setHasLinkedFabrics}
          onWoodFinishesAvailable={setLinkedWoodFinishes}
          onSwatchImagesChange={onSwatchImagesChange}
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
        />


        {/* Material / finish dropdown(s) */}
        {isDualAxis ? (
          <>
            {/* Dual-axis: always render Base picker so both axes are visible to the user.
                ExpandableSpec auto-collapses to a "Base: <value>" plain row when there is
                only one option, giving a locked single-option display without a dead dropdown. */}
            {!baseAxisIsDim && !suppressBaseAsFinish && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension)) && (
              <ExpandableSpec
                icon={specIcon("⬗")}
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
            {/* Dual-axis: always render Top picker. Same rationale as Base above —
                ExpandableSpec collapses to a single-value row when only one option exists. */}
            {!suppressTopAsFinish && !(hasLinkedFabrics && !topAxisIsDim) && (
            <ExpandableSpec
              icon={specIcon(topAxisIsDim ? "📐" : "⬗")}
              text={withImperialPerLine(topOptions.join("\n"))}
              placeholder={getTopPlaceholder(product)}
              singleValueLabel={formatVariantAxisLabel(product.top_axis_label) || undefined}
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

            {/* Reset-to-default link intentionally omitted: defaultPair is only
                set when there is a single fixed pairing (1 base × 1 top), in
                which case there is nothing to reset to. */}
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

        {/* Materials description paragraph — shown AFTER all dropdowns, before Handcrafted.
            Suppressed when FinishSelector already drives fabric + wood selections to
            avoid restating "Varnished solid ash & fabric" type catch-all summaries. */}
        {product.materials_description?.trim() && (isRugCategory(product.category) || (!hasLinkedFabrics && !isProductUpholstered(product))) && (
          <LegendDisclosure
            icon={specIcon("⬗")}
            text={product.materials_description.trim()}
          />
        )}
        <AlsoContainsFinishes pickId={product.id} className="mt-1 pl-6" />
      </div>

      {/* Dimensions second on mobile, first on desktop */}
      <div className="order-2 md:order-1 flex flex-col gap-2">
        {/* Size dropdown — shown before finishes on desktop */}
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
              // Re-sync the gallery using the canonical (base, top, size)
              // composite — keeps the hero image aligned with the current
              // selection no matter which axis was just changed.
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
                ? `Some sizes aren't available in ${selMat} — greyed out.`
                : undefined
            }
          />
        ) : hasVariants && !isDualAxis && !isBaseOnly && singleAxisParsed.length > 1 && (() => {
          // Use the raw variant labels (deduped) so naming prefixes like
          // "Concept 1: Ø 244 cm" survive instead of being stripped to the
          // bare dimension by parseSingleAxisLabel.
          const seen = new Set<string>();
          const labels: string[] = [];
          for (const p of singleAxisParsed) {
            const raw = (p.variant.label || "").trim();
            if (!raw || seen.has(raw)) continue;
            seen.add(raw);
            labels.push(raw);
          }
          // Only render this as a "Size" dropdown when the labels actually look
          // like dimensions. Otherwise these are finish-style labels (e.g.
          // "Kynos", "Grafite") that belong in the FinishSelector below — not
          // in a misleading "Select Your Size" picker.
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
            <ExpandableSpec icon={specIcon("📐")} text={withImperialPerLine(product.dimensions)} />
          ) : null;
        })()}
        {/* No-variant fallback: dimensions must always appear BEFORE the materials/finish row
            (regression guarded by src/lib/__tests__/productDimensionsConsistency.test.ts). */}
        {!hasVariants && product.dimensions && looksLikeDimension(product.dimensions) && (
          <ExpandableSpec icon={specIcon("📐")} text={withImperialPerLine(product.dimensions)} />
        )}

        {/* Dual-axis with fixed (non-variant) dimensions: render dims at the top */}
        {hasVariants && isDualAxis && !baseAxisIsDim && !topAxisIsDim && (dualSizeOptions?.length ?? 0) === 0 && product.dimensions && looksLikeDimension(product.dimensions) && (
          <ExpandableSpec icon={specIcon("📐")} text={withImperialPerLine(product.dimensions)} />
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

        {/* Model-style base axis whose options carry dimensions (e.g. Bora Sconce
            Uplight / Downlight) — render BEFORE the finish swatches and use the
            dimensions icon since the value is fundamentally a size choice. */}
        {isBaseOnly && !baseAxisIsDim && !suppressBaseAsFinish
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

        {/* Dual-axis with a Model/Size base whose options carry dimensions —
            render BEFORE the finish swatches with the dimensions icon. */}
        {isDualAxis && !baseAxisIsDim && !suppressBaseAsFinish
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
    </div>
  );
};


/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
const PublicProductPage: React.FC = () => {
  const { slug: designerSlug, productSlug } = useParams<{ slug: string; productSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isTradeUser, tradeStatus, loading: authLoading } = useAuth();
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
  const { data: publicRrpRow } = usePublicRrp(data?.product?.id);
  const catalogueRrpLabel = formatPublicRrp(publicRrpRow);
  // Price of the size/finish combination the visitor has currently selected.
  // `exact` = a single variant matched, so we drop the "From" prefix.
  const [selectedRrp, setSelectedRrp] = useState<{ cents: number; exact: boolean } | null>(null);
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

  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { requireAuth, gateOpen, gateAction, closeGate } = useAuthGate();

  const [favIds, setFavIds] = useState(readFavs);
  const [relatedIndex, setRelatedIndex] = useState(0);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [galleryActiveIndex, setGalleryActiveIndex] = useState<number | undefined>(undefined);
  // Bumped on every parent-initiated jump so the gallery re-syncs even when the
  // numeric index is identical to the previous one (e.g. re-selecting the same finish).
  const [galleryJumpNonce, setGalleryJumpNonce] = useState(0);
  // Currently-selected wood/top finish swatches that lack mapped images —
  // appended to the bespoke concierge message so they aren't overlooked.
  const [finishesMissingImages, setFinishesMissingImages] = useState<string[]>([]);
  const galleryScrollRef = React.useRef<HTMLDivElement | null>(null);
  // On mobile/PWA, when a finish selection updates the gallery image, scroll
  // the product image back into view so the user can actually see the change
  // instead of it happening off-screen above the finish dropdown.
  useEffect(() => {
    if (galleryJumpNonce === 0) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const el = galleryScrollRef.current;
    if (!el) return;
    const headerOffset = 80;
    const y = el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  }, [galleryJumpNonce]);

  // Mobile/PWA: shrink the product image once the user scrolls past a small threshold.
  const [galleryCompact, setGalleryCompact] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  // Finish/size selection surfaced in the authenticated Trade Workspace and
  // injected into Felix's product context.
  const [selectedFinishes, setSelectedFinishes] = useState<string[]>([]);
  // Signed-out visitors get an elegant explainer instead of the gated PDF.
  const [specSheetLocked, setSpecSheetLocked] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const onScroll = () => {
      const y = window.scrollY;
      setGalleryCompact(y > 40);
      // Show mini-bar only once the product image has fully scrolled past the
      // real fixed header. Measure the nav live so PWA (safe-area-inset-top)
      // triggers at the correct scroll position instead of a hardcoded 96px.
      const el = galleryScrollRef.current;
      const navEl = document.querySelector("nav.fixed, header.fixed") as HTMLElement | null;
      const headerBottom = navEl?.getBoundingClientRect().bottom ?? 96;
      if (el) {
        const rect = el.getBoundingClientRect();
        setShowStickyBar(rect.bottom < headerBottom);
      } else {
        setShowStickyBar(false);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);








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
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="pt-32 md:pt-[12rem]">
          <ProductDetailSkeleton variant="page" />
        </div>
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
      setGalleryActiveIndex(0);
      setGalleryJumpNonce((n) => n + 1);
      return;
    }
    const variantsForAxes = product.size_variants || [];
    // Public RRP follows the selection: match every chosen axis value against
    // the variant's base/top/label, then show that variant's price (exact when
    // one variant matches, "From <min>" while the selection is still partial).
    {
      const norm = (s: any) => String(s ?? "").trim().toLowerCase();
      // Swatch labels ("Apparatus — Marble - Nero Portoro") and variant axis
      // values ("Nero Portoro Marble") describe the same finish with different
      // word order and a brand prefix, so compare them as token sets.
      const tokenSet = (s: any) => {
        let t = String(s ?? "").toLowerCase();
        const dashIdx = t.indexOf("—");
        if (dashIdx !== -1) t = t.slice(dashIdx + 1);
        return new Set(
          t
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length > 1)
        );
      };
      // Tolerate a single-character spelling drift between catalogue and
      // swatch naming (e.g. "Nero Kinitra" vs "Nero Kinatra").
      const nearWord = (a: string, b: string) => {
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
      const sameFinish = (a: any, b: any) => {
        if (!a || !b) return false;
        if (norm(a) === norm(b)) return true;
        const A = tokenSet(a);
        const B = tokenSet(b);
        if (!A.size || !B.size) return false;
        const small = A.size <= B.size ? A : B;
        const large = A.size <= B.size ? B : A;
        // Every word of the shorter label must appear in the longer one.
        for (const w of small) {
          if (![...large].some((x) => nearWord(w, x))) return false;
        }
        return small.size >= 2;
      };


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

      <div className="min-h-screen bg-background text-foreground">
        <Navigation borderless />

        {/* Mobile sticky mini bar — shows on scroll (mirrors 1stdibs pattern) */}
        <div
          className={cn(
            "md:hidden fixed left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-b border-border shadow-sm transition-transform duration-300 ease-out",
            showStickyBar ? "translate-y-0" : "-translate-y-full pointer-events-none"
          )}
          style={{ top: "calc(env(safe-area-inset-top, 0px) + 6rem)" }}
          aria-hidden={!showStickyBar}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            {images[0] && (
              <img
                src={images[0]}
                alt=""
                className="w-11 h-11 rounded-md object-cover shrink-0 border border-border"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display text-[13px] leading-tight text-foreground truncate">
                {product.title}
              </p>
              <p className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground truncate">
                {designerDisplay}
              </p>
            </div>
            <Link
              to={`/contact?${new URLSearchParams({
                subject: `Price on Request — ${product.title} by ${designerDisplay}`,
                productId: product.id,
                productSlug: productSlug || "",
                productName: product.title || "",
                designerName: designerDisplay || "",
                back: (typeof window !== "undefined" ? location.pathname + location.search : "") || "",
              }).toString()}#contact`}
              className="shrink-0 px-3 py-2 rounded-md bg-foreground text-background font-body text-[10px] uppercase tracking-[0.12em] whitespace-nowrap"
            >
              Inquire for Pricing
            </Link>
          </div>
        </div>


        <div className="pt-[calc(env(safe-area-inset-top,0px)+7rem)] md:pt-36 pb-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
            <div className="relative md:relative sticky top-[calc(6rem+env(safe-area-inset-top))] md:top-0 self-start z-30 bg-background" ref={galleryScrollRef}>
              <ProductImageGallery
                images={images}
                alt={product.title}
                activeIndex={galleryActiveIndex}
                activeIndexNonce={galleryJumpNonce}
                onIndexChange={setGalleryActiveIndex}
                caption={product.gallery_captions?.[String(galleryActiveIndex ?? 0)] || null}
                compact={galleryCompact}

                firstImageBadge={
                  (() => {
                    const editionLabel = formatEditionLabel(product as any);
                    // Mobile/PWA: hide the edition pill (matches 1stdibs layout).
                    return editionLabel ? (
                      <span className="hidden md:inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm">
                        {editionLabel}
                      </span>
                    ) : null;
                  })()
                }
                overlay={
                  product.description ? (
                    <div className="hidden md:flex flex-col items-end gap-2">
                      <LightboxDescriptionDropdown
                        description={product.description}
                        ariaDescribedBy="product-description-hidden"
                      />
                    </div>
                  ) : null
                }
              />


              {/* Mobile-only image overlays: share (top-right) + favorite (bottom-right) */}
              <div className="md:hidden pointer-events-none absolute inset-x-0 top-0 z-40" style={{ height: galleryCompact ? "22vh" : "42vh" }}>
                <div className="absolute top-3 right-3 pointer-events-auto">
                  {(() => {
                    const shareUrl = buildPieceOgUrl(designerDisplay, product.title, product.subtitle);
                    return (
                      <ShareMenu
                        url={shareUrl}
                        message={`${product.title} by ${designerDisplay} — Maison Affluency: ${shareUrl}`}
                        className="flex items-center justify-center w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm border border-border shadow-sm text-foreground"
                        iconSize="w-[18px] h-[18px]"
                        iconVariant="ios"
                        showLabel={false}
                      />
                    );
                  })()}
                </div>

                <div className="absolute bottom-3 right-3 pointer-events-auto">
                  <FavoriteFolderPicker pickId={product.id} align="end" side="top">
                    <button
                      onClick={(e) => e.stopPropagation()}
                      aria-label={favorited ? "Saved to favorites" : "Add to favorites"}
                      className="flex items-center justify-center w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm border border-border shadow-sm"
                    >
                      <Heart size={16} className={cn(favorited ? "fill-destructive text-destructive" : "text-foreground")} />
                    </button>
                  </FavoriteFolderPicker>
                </div>
              </div>

              <div className="md:border-0 md:shadow-none border-b border-border/60 shadow-[0_6px_10px_-8px_rgba(0,0,0,0.35)] pb-2">
                <ActiveSwatchCaption pickId={product.id} activeIndex={galleryActiveIndex ?? 0} />
              </div>
            </div>

            <div className="relative flex flex-col gap-4">
              <div className="min-w-0">
                <Link
                  to={`/designers/${designer.slug}`}
                  onClick={() => rememberProductBackRef(designer.slug, location.pathname + location.search)}
                  className="font-body text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  {designerDisplay}
                </Link>
                <h1 className="font-display text-2xl md:text-3xl mt-1 leading-tight">
                  {product.title}
                  {product.subtitle &&
                    !product.title.toLowerCase().includes(product.subtitle.toLowerCase()) &&
                    !product.subtitle.toLowerCase().includes(product.title.toLowerCase()) &&
                    ` by ${product.subtitle}`}
                </h1>

                {/* Publicly disclosed RRP (currently Apparatus only) */}
                {publicRrpLabel && (
                  <div className="mt-3">
                    <p className="font-display text-lg md:text-xl">
                      {(() => {
                        const spaceIdx = publicRrpLabel.indexOf(" ");
                        if (spaceIdx === -1) return <span className="text-foreground">{publicRrpLabel}</span>;
                        const prefix = publicRrpLabel.slice(0, spaceIdx);
                        const rest = publicRrpLabel.slice(spaceIdx + 1);
                        return (
                          <>
                            <span className="text-muted-foreground">{prefix}</span>{" "}
                            <span className="text-foreground">{rest}</span>
                          </>
                        );
                      })()}
                    </p>
                    <p className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground mt-1">
                      excl. shipping &amp; duties
                    </p>
                  </div>
                )}
              </div>


              {/* Materials & dimensions with gold icons — shared parsing with TradeProductPage */}
              <div className="flex flex-col gap-2">
                <VariantSelectors
                  product={product}
                  onMaterialChange={handleMaterialChange}
                  galleryActiveIndex={galleryActiveIndex}
                  finishMap={productFinishMap}
                  onSwatchImagesChange={(indices) => {
                    if (!indices || indices.length === 0) return;
                    setGalleryActiveIndex(Math.max(0, indices[0] - 1));
                    setGalleryJumpNonce((n) => n + 1);
                  }}
                  onFinishesMissingImagesChange={setFinishesMissingImages}
                />
                {finishesMissingImages.length > 0 && (
                  <p className="font-body text-[11px] text-muted-foreground italic mt-1">
                    No reference image on file for{" "}
                    <span className="text-foreground">{finishesMissingImages.join(", ")}</span>.
                    We'll note this on your enquiry so our concierge can confirm visuals.
                  </p>
                )}




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
                        <p>{originLine}</p>
                        {leadLine && <p className="mt-0.5">{leadLine}</p>}
                      </div>
                    </div>
                  );
                })()}

                {/* Public, crawlable specification table (no session required) */}
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

                {!user && !authLoading && (
                  <TradeExclusiveCard
                    redirectTo={location.pathname + location.search}
                    rrpLabel={publicRrpLabel}
                    inquireHref={`/contact?${new URLSearchParams({
                      subject: `Price on Request — ${product.title} by ${designerDisplay}`,
                      productId: product.id,
                      productSlug: productSlug || "",
                      productName: product.title || "",
                      designerName: designerDisplay || "",
                      back: (typeof window !== "undefined" ? location.pathname + location.search : "") || "",
                    }).toString()}#contact`}
                  />
                )}

              </div>



              {/* Signed-in visitors. Verified trade members get the full
                  workspace (net pricing, availability, spec sheet + Felix);
                  everyone else signed in keeps the enquiry CTA. */}
              {user && (() => {
                const returnTo = typeof window !== "undefined" ? location.pathname + location.search : "";
                const q = new URLSearchParams({
                  subject: `Price on Request — ${product.title} by ${designerDisplay}`,
                  productId: product.id,
                  productSlug: productSlug || "",
                  productName: product.title || "",
                  designerName: designerDisplay || "",
                  back: returnTo || "",
                });
                const inquireHref = `/contact?${q.toString()}#contact`;

                // Vetting gate: an admin-granted trade role always counts as
                // approved; otherwise profiles.trade_status must be 'approved'.
                const tradeApproved = isTradeUser || tradeStatus === "approved";

                if (!tradeApproved && tradeStatus === "pending_review") {
                  return <TradePendingReviewCard />;
                }

                if (tradeApproved) {
                  return (
                    <TradeWorkspace
                      productId={product.id}
                      title={product.title}
                      designerDisplay={designerDisplay}
                      dimensions={product.dimensions}
                      materials={product.materials || (product as any).materials_description}
                      originLine={product.origin}
                      leadTime={product.lead_time}
                      selectedFinishes={selectedFinishes}
                      pdfUrl={product.pdf_url}
                      pdfUrls={product.pdf_urls}
                      inquireHref={inquireHref}
                      felixUrl={typeof window !== "undefined" ? window.location.href : undefined}
                    />
                  );
                }

                return (
                  <div className="mt-2 space-y-2">
                    <Link
                      to={inquireHref}
                      className="flex items-center justify-center gap-2 px-4 py-3.5 rounded-md font-body text-[11px] md:text-xs uppercase tracking-[0.12em] transition-all w-full text-center bg-foreground text-background hover:bg-foreground/90"
                    >
                      Inquire for Pricing
                    </Link>
                  </div>
                );
              })()}




              {/* Bespoke customization — public guests get the inquiry modal,
                  approved trade members are routed into Felix instead. */}
              <CustomizationRequest
                productId={product.id}
                productTitle={product.title}
                designerDisplay={designerDisplay}
                tradeApproved={!!user && (isTradeUser || tradeStatus === "approved")}
              />

              {/* Secondary actions: Favorite / Pin / Spec Sheet.
                  Always visible. Guests get the Sign In modal on click;
                  approved trade members get the spec sheet un-gated. */}
              {(() => {
                const tradeApprovedFooter = !!user && (isTradeUser || tradeStatus === "approved");
                const hasSheet = !!(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0));
                const baseBtn =
                  "w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border";
                const idleBtn =
                  "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30";

                return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="hidden md:block">
                {user ? (
                <FavoriteFolderPicker pickId={product.id} align="start" side="top">
                  <button
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      baseBtn,
                      favorited
                        ? "border-destructive/30 text-destructive bg-destructive/10"
                        : idleBtn
                    )}
                  >
                    <Heart size={13} className={cn(favorited && "fill-current")} />
                    {favorited ? "Saved" : "Favorite"}
                  </button>
                </FavoriteFolderPicker>
                ) : (
                  <button
                    onClick={() => requireAuth(() => {}, "save this piece to your favourites")}
                    className={cn(baseBtn, idleBtn)}
                  >
                    <Heart size={13} />
                    Favorite
                  </button>
                )}
                </div>

                <button
                  onClick={() => {
                    if (!user) {
                      requireAuth(() => {}, "pin this piece to your selection");
                      return;
                    }
                    togglePin(compareItem);
                  }}
                  className={cn(
                    "hidden md:flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border",
                    pinned
                      ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                      : idleBtn,
                    user && compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                  )}
                >
                  <Scale size={13} />
                  {pinned ? "Pinned" : "Pin to Selection"}
                </button>

                {hasSheet ? (
                  <div className="hidden md:block">
                    <SpecSheetButton
                      pdfUrl={product.pdf_url}
                      pdfUrls={product.pdf_urls}
                      brandName={designerDisplay}
                      productName={product.title}
                      variant="button"
                      onBeforeOpen={() => {
                        // Verified trade: open immediately, no gate.
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
                  </div>
                ) : (
                  <Link
                    to="/contact"
                    className="hidden md:flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  >
                    Contact Us
                  </Link>
                )}
              </div>
                );
              })()}

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
                      className="inline-flex items-center justify-center px-5 py-3 rounded-md bg-foreground text-background font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/90 transition-colors"
                    >
                      Sign in to view
                    </Link>
                    <Link
                      to="/trade/register"
                      className="inline-flex items-center justify-center px-5 py-3 rounded-md border border-foreground/40 text-foreground font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/5 transition-colors"
                    >
                      Apply for trade access
                    </Link>
                  </div>
                </DialogContent>
              </Dialog>



            </div>
          </div>

          {/* SEO crawlable internal links — description itself lives in the
              "Creation" pill above (in DOM, indexable). The pill is the single
              source of truth on desktop, mobile and PWA; we avoid duplicating
              the paragraph below it. */}
          {product.description && product.description.trim().length > 0 && (
            <section aria-label="Related links" className="sr-only">
              {/* Visually hidden full description for crawlers that don't
                  expand collapsed regions. Keeps the page free of visible
                  duplication while preserving SEO coverage. */}
              <div className="sr-only" id="product-description-hidden">
                <h2>About the {product.title}</h2>
                <p>{product.description}</p>
              </div>
            </section>
          )}

          {relatedPicks.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Mobile-only heading: shown above the carousel */}
                <div className="lg:hidden order-1">
                  <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {(product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title))) ? "From the Same Maker" : "From the Same Designer"}
                  </p>
                  <h2 className="font-display text-2xl leading-tight">
                    <Link
                      to={`/designers/${designer.slug}`}
                      onClick={() => rememberProductBackRef(designer.slug, location.pathname + location.search)}
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
                          to={`/designers/${designer.slug}/${rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
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
                        to={`/designers/${designer.slug}/${rp.slug || slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
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

                {/* Brand summary — above carousel on desktop, below on mobile */}
                <div className="lg:col-span-4 lg:pr-4 order-3 lg:order-1">
                  <div className="hidden lg:block">
                    <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      {(product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title))) ? "From the Same Maker" : "From the Same Designer"}
                    </p>
                    <h2 className="font-display text-2xl md:text-3xl leading-tight mb-5">
                      <Link
                        to={`/designers/${designer.slug}`}
                        onClick={() => rememberProductBackRef(designer.slug, location.pathname + location.search)}
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
      <GalleryDetailsFloatingNav
        showImmediately
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

export default PublicProductPage;
