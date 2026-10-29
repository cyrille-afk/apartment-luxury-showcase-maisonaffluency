/**
 * TradeProductPage — full product sheet for trade users.
 * Mirrors PublicProductPage layout but with trade pricing, "Add to Quote" CTA,
 * and an inline "Need a sample? Request via Procurement →" link (no big CTA,
 * since Sample Requests live in Procurement).
 *
 * Routes: /trade/products/:id and /trade/products/:slug/:productSlug
 *
 * Back navigation:
 *   1. location.state.from (preferred — set when navigating from grid/gallery)
 *   2. sessionStorage("trade_product_from_path") fallback for refresh resilience
 *   3. /trade/gallery as final fallback
 */
import { useProductDesignNotes } from "@/hooks/useProductDesignNotes";
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Button } from "@/components/ui/button";
import { useParams, useNavigate, Link, useLocation } from "@/lib/router-compat";
import { Helmet } from "react-helmet-async";
import { formatProductSubtitleLine } from "@/lib/subtitleDisplay";
import {
  Heart, ArrowLeft, Layers, Clock, Globe, ShoppingCart, Check, Loader2, Package, Wand2, ChevronDown, Sparkles, FileText, Box, Minus, Plus, Pin, Award, Compass, X,
  Maximize2 as FsIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { buildProductCuratorNotes } from "@/lib/productCuratorNotes";
import { renderParagraph } from "@/components/EditorialBiography";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import ShareMenu from "@/components/ShareMenu";
import CornerTooltip from "@/components/product/CornerTooltip";
import { buildPieceOgUrl } from "@/lib/whatsapp-share";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import ShippingDetailsAccordion from "@/components/product/ShippingDetailsAccordion";
import FavoriteFolderPicker from "@/components/FavoriteFolderPicker";
import FinishesPdfButton from "@/components/product/FinishesPdfButton";

import ActiveSwatchCaption from "@/components/product/ActiveSwatchCaption";
import PicturedFinishesStrip from "@/components/product/PicturedFinishesStrip";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import CopyTearsheetLink from "@/components/trade/CopyTearsheetLink";
import PresentationModeToggle from "@/components/trade/PresentationModeToggle";
import RetailPrice from "@/components/product/RetailPrice";
import { buildTradeCoverSheetPdf } from "@/lib/tradeCoverSheetPdf";
import CadAssetsSection from "@/components/trade/CadAssetsSection";
import Product3DViewer from "@/components/trade/Product3DViewer";
import ProductFinishCombinations from "@/components/trade/ProductFinishCombinations";
import ProductFullscreenGallery from "@/components/trade/ProductFullscreenGallery";
import { picturedFinishesForImage } from "@/lib/picturedFinishes";
import { parseDimensionString } from "@/lib/productDimensions";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useProjectInventory } from "@/contexts/ProjectInventoryContext";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { updateConciergeSession } from "@/hooks/useConciergeSession";
import TradeFavoriteFolderPicker from "@/components/trade/TradeFavoriteFolderPicker";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { normalizeCategoryContext } from "@/lib/categoryNormalization";
import { formatDesignerDisplayName } from "@/lib/designerDisplayName";
import { buildProductBreadcrumbs } from "@/lib/productBreadcrumbs";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import CustomRequestModal from "@/components/trade/CustomRequestModal";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates, convertCents } from "@/components/trade/CurrencyToggle";
import { productDisplayPolicy } from "@/lib/productDisplayMode";
import { isEcartReedition } from "@/lib/editionLabel";
import { ProductTitleBlock } from "@/components/trade/ProductTitleBlock";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ProductDetailSkeleton from "@/components/product/ProductDetailSkeleton";
import { sanitizeBiographyCitations } from "@/lib/sanitizeBiographyCitations";
import { everyOptionCoveredBySwatches } from "@/lib/finishDuplication";
import { normalizeFinishOption } from "@/lib/finishNormalization";
import ExpandableSpec from "@/components/ExpandableSpec";
import LegendDisclosure from "@/components/LegendDisclosure";
import FinishSelector, { OOL_MINIBAR_PICK_ID } from "@/components/FinishSelector";
import { isProductUpholstered } from "@/lib/upholstery";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { getBasePlaceholder, getTopPlaceholder, formatVariantAxisLabel, isDimensionAxisLabel, resolveFinishSectionLabels } from "@/lib/variantPlaceholders";
import { formatDimensionsMultiline, formatImperialDimensions, withImperialPerLine, withImperialStacked } from "@/lib/formatDimensions";
import { formatDrawerDimensions } from "@/lib/drawerDimensions";
import { computeVariantAxes, parseMaterialsFallback } from "@/lib/parseSizeVariants";
import { makeSwatchAxisFilter } from "@/lib/finishDuplication";
import { buildProductFinishMap, resolveFinishImageIndex, resolveVariantImageIndex, findVariantForImageIndex } from "@/lib/variantImageMap";
import { resolveAutoDefaultPair } from "@/lib/variantAutoDefault";
import { resolveDefaultVariant } from "@/lib/variantDefault";
import { formatHandcrafted } from "@/lib/formatHandcrafted";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useProductConfigOptional } from "@/contexts/ProductConfigContext";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { useClientProjectPricing } from "@/hooks/useClientProjectPricing";
import { rememberProductBackRef } from "@/lib/designerBackRef";
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";
import { categoryUrl } from "@/lib/categorySlugs";
import { priceRugVariantFromLabel, isRugCategory, looksLikeDimension } from "@/lib/rugPricing";
import { resolveActiveVariant, resolvePartialDualMinCents } from "@/lib/resolveActiveVariant";
import { findQuoteFinishSwatch } from "@/lib/quoteFinishSwatches";
import { configuredProductPrice } from "@/lib/configuredProductPrice";
import { felixFinishLabel, type FelixQuoteFinish } from "@/lib/felixQuoteFinishes";
import type { ProactiveTearsheetData } from "@/components/trade/concierge/ProactiveTearsheetCard";

import RugSizeColourPicker, { type RugSelection } from "@/components/rug/RugSizeColourPicker";
import SpecGlyph from "@/components/product/SpecGlyph";
import AlsoContainsFinishes from "@/components/product/AlsoContainsFinishes";
import { firstPublicVariantDimensionLabel } from "@/lib/productVariantSpecs";
import { createActiveDraftQuote, fetchActiveDraftQuoteId } from "@/lib/activeProjectId";
import { addToCart } from "@/lib/cart";
import NotFound from "@/pages/NotFound";
import ProductCommerceCta from "@/components/product/ProductCommerceCta";
import { resolveSwatchImageEvent } from "@/lib/swatchPreviewState";


const specIcon = (symbol: string, className = "") => (
  <SpecGlyph symbol={symbol} className={className} />
);

/** Inject per-sqm prices into rug variants when the pick has a price/m² rate. */
function applyRugPerSqmPricing(
  variants: { label?: string; base?: string; top?: string; price_cents?: number }[],
  category: string | null | undefined,
  pricePerSqmCents: number | null | undefined,
): { label?: string; base?: string; top?: string; price_cents: number }[] {
  if (!variants?.length) return [];
  if (!isRugCategory(category) || !pricePerSqmCents) {
    // Keep ALL variants — including those without an explicit price.
    // Variants with price_cents = 0 surface as "Price upon Request" in the UI
    // (e.g. a White Onyx finish that hasn't been quoted yet should still
    // appear in the finish dropdown).
    return variants
      .filter((v) => v != null)
      .map((v) => ({
        ...v,
        price_cents: typeof v.price_cents === "number" && v.price_cents > 0 ? v.price_cents : 0,
      }));
  }
  return variants
    .map((v) => {
      const explicit = typeof v.price_cents === "number" && v.price_cents > 0 ? v.price_cents : null;
      if (explicit) return { ...v, price_cents: explicit };
      const dimSource = v.base || v.label || "";
      const computed = priceRugVariantFromLabel(dimSource, pricePerSqmCents);
      // Rug variants without computable pricing still appear; they render as
      // "Price upon Request" via the 0-cents fallback.
      return { ...v, price_cents: computed ?? 0 };
    })
    .filter((v): v is { label?: string; base?: string; top?: string; price_cents: number } => v !== null);
}


function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function resolveGalleryImageByFinishFilename(heroList: string[], labels: Array<string | null | undefined>): string | null {
  const cleanLabels = labels.filter(Boolean).map((s) => String(s));
  const toTerms = (label: string) => label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((term) => term.length >= 4 && !["finish", "fabric", "marble", "wood", "ashwood"].includes(term));

  let best: { url: string; score: number; index: number } | null = null;
  for (const [index, url] of heroList.entries()) {
    const haystack = decodeURIComponent(url).toLowerCase().replace(/[^a-z0-9]+/g, " ");
    let score = 0;
    cleanLabels.forEach((label) => {
      const terms = toTerms(label);
      const hits = terms.filter((term) => haystack.includes(term)).length;
      if (hits > 0) score = Math.max(score, hits * 10 + terms.join(" ").length);
    });
    if (score > 0 && (!best || score > best.score || (score === best.score && index < best.index))) {
      best = { url, score, index };
    }
  }

  return best?.url ?? null;
}

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
  variant_placeholder: string | null;
  base_axis_label: string | null;
  top_axis_label: string | null;
  wood_label_override: string | null;
  size_variants?: { label?: string; base?: string; top?: string; price_cents?: number; meters?: number }[] | null;
  /** Variant the size picker opens with pre-selected (see src/lib/variantDefault.ts). */
  default_variant_label?: string | null;
  variant_image_map: Record<string, number> | null;
  gallery_captions?: Record<string, string> | null;
  edition: string | null;
  edition_number: string | null;
  edition_signing: string | null;
  is_upholstered: boolean | null;
  com_meters: number | null;
}

interface TradePricing {
  trade_price_cents: number | null;
  rrp_price_cents: number | null;
  currency: string;
  price_unit: string | null;
  price_prefix: string | null;
  spec_sheet_url: string | null;
  size_variants: { label?: string; base?: string; top?: string; price_cents: number }[] | null;
}

type TradeProductResult = {
  product: ProductRow;
  designer: {
    id: string;
    name: string;
    slug: string | null;
    biography: string;
    founder?: string | null;
  };
  pricing: TradePricing | null;
  relatedPicks: ProductRow[];
  tradeProductId: string | null;
  glbUrl?: string | null;
};

export function useTradeProductBySlug(
  tradeProductIdParam: string | undefined,
  designerSlug: string | undefined,
  productSlug: string | undefined,
) {
  const { isAdmin } = useAuth();
  return useQuery({
    queryKey: [...queryKeys.tradeProductPage(tradeProductIdParam, designerSlug, productSlug), isAdmin ? "admin" : "member"],
    queryFn: async () => {
      if (tradeProductIdParam) {
        const selectCols = "id, product_name, brand_name, image_url, gallery_images, materials, dimensions, description, category, subcategory, lead_time, origin, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix, spec_sheet_url, glb_url, source_pick_id";
        let { data: tradeProduct } = await supabase
          .from("trade_products")
          .select(selectCols)
          .eq("id", tradeProductIdParam)
          .eq("is_active", true)
          .maybeSingle();

        // The concierge (and some board flows) pass a *curator pick* id rather
        // than a trade_products id. Fall back to the mirrored twin so those
        // deep links resolve instead of rendering "Product not found".
        if (!tradeProduct) {
          const { data: twin } = await supabase
            .from("trade_products")
            .select(selectCols)
            .eq("source_pick_id", tradeProductIdParam)
            .eq("is_active", true)
            .maybeSingle();
          tradeProduct = twin as any;
        }

        if (!tradeProduct) return null;


        const brand = (tradeProduct as any).brand_name as string;
        const brandBase = brand.includes(" - ") ? brand.split(" - ")[0].trim() : brand;
        let designersQuery = supabase
          .from("designers")
          .select("id, name, slug, display_name, biography, founder");
        if (!isAdmin) designersQuery = designersQuery.eq("is_published", true);
        const { data: designers } = await designersQuery;
        const designer = (designers || []).find((d: any) =>
          [d.name, d.display_name].some((name) => {
            if (!name) return false;
            const normalized = name.trim().toLowerCase();
            return normalized === brand.trim().toLowerCase() || normalized === brandBase.trim().toLowerCase();
          })
        ) || null;

        let relatedPicks: ProductRow[] = [];
        let curatorPick: any = null;
        if (designer) {
          const { data: picks } = await supabase
            .from("designer_curator_picks")
            .select("id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, price_per_sqm_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered, com_meters, default_variant_label")
            .eq("designer_id", (designer as any).id)
            .order("sort_order", { ascending: true });
          const tradeName = ((tradeProduct as any).product_name || "").trim().toLowerCase();
          curatorPick = (picks || []).find((p: any) => (p.title || "").trim().toLowerCase() === tradeName) || null;
          relatedPicks = ((picks || []) as unknown as ProductRow[]).filter((p) => p.id !== curatorPick?.id);
        }

        // Fallback: the designer lookup above only sees PUBLISHED designers,
        // so picks belonging to an unpublished brand (e.g. Dagmar London)
        // resolved to null and the page fell back to the trade_products id —
        // which broke every pick-scoped feature (finish swatches live in
        // product_fabrics.pick_id). Resolve the twin directly via
        // trade_products.source_pick_id when the name join found nothing.
        if (!curatorPick && (tradeProduct as any).source_pick_id) {
          const { data: pickById } = await supabase
            .from("designer_curator_picks")
            .select("id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, price_per_sqm_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered, com_meters, default_variant_label")
            .eq("id", (tradeProduct as any).source_pick_id)
            .maybeSingle();
          curatorPick = pickById || null;
        }



        const publicVariantDimension = firstPublicVariantDimensionLabel(curatorPick?.size_variants);
        const product: ProductRow = {
          id: curatorPick?.id || (tradeProduct as any).id,
          slug: curatorPick?.slug || null,
          title: curatorPick?.title || (tradeProduct as any).product_name,
          subtitle: curatorPick?.subtitle || null,
          image_url: curatorPick?.image_url || (tradeProduct as any).image_url || null,
          hover_image_url: curatorPick?.hover_image_url || null,
          gallery_images: curatorPick?.gallery_images?.length ? curatorPick.gallery_images : (tradeProduct as any).gallery_images || null,
          materials: curatorPick?.materials || (tradeProduct as any).materials || null,
          materials_description: curatorPick?.materials_description || null,
          dimensions: publicVariantDimension || curatorPick?.dimensions || (tradeProduct as any).dimensions || null,
          description: curatorPick?.description || (tradeProduct as any).description || null,
          category: curatorPick?.category || (tradeProduct as any).category || null,
          subcategory: curatorPick?.subcategory || (tradeProduct as any).subcategory || null,
          pdf_url: curatorPick?.pdf_url || null,
          pdf_urls: curatorPick?.pdf_urls || null,
          lead_time: curatorPick?.lead_time || (tradeProduct as any).lead_time || null,
          origin: curatorPick?.origin || (tradeProduct as any).origin || null,
          designer_id: (designer as any)?.id || (tradeProduct as any).id,
          variant_placeholder: curatorPick?.variant_placeholder || null,
          base_axis_label: curatorPick?.base_axis_label || null,
          top_axis_label: curatorPick?.top_axis_label || null,
          wood_label_override: (curatorPick as any)?.wood_label_override || null,
          default_variant_label: (curatorPick as any)?.default_variant_label ?? null,
          size_variants: curatorPick?.size_variants || null,
          variant_image_map: curatorPick?.variant_image_map || null,
          edition: curatorPick?.edition || null,
          edition_number: curatorPick?.edition_number || null,
          edition_signing: curatorPick?.edition_signing || null,
          is_upholstered: (curatorPick as any)?.is_upholstered ?? (tradeProduct as any)?.is_upholstered ?? null,
          com_meters: (curatorPick as any)?.com_meters ?? null,
        };

        const rawSizeVariants = applyRugPerSqmPricing(
          Array.isArray(curatorPick?.size_variants) ? (curatorPick.size_variants as any[]) : [],
          curatorPick?.category,
          (curatorPick as any)?.price_per_sqm_cents,
        ).filter((v) => (
          (typeof v.label === "string" && v.label.trim()) ||
          (typeof v.base === "string" && v.base.trim()) ||
          (typeof v.top === "string" && v.top.trim())
        ));

        const pricing: TradePricing | null = {
          trade_price_cents: (tradeProduct as any).trade_price_cents ?? null,
          rrp_price_cents: (tradeProduct as any).rrp_price_cents ?? (curatorPick as any)?.trade_price_cents ?? null,
          currency: (tradeProduct as any).currency || (curatorPick as any)?.currency || "EUR",
          price_unit: (tradeProduct as any).price_unit ?? null,
          price_prefix: (tradeProduct as any).price_prefix ?? (curatorPick as any)?.price_prefix ?? null,
          spec_sheet_url: (tradeProduct as any).spec_sheet_url ?? null,
          size_variants: rawSizeVariants.length ? rawSizeVariants : null,
        };

        return {
          product,
          designer: {
            id: (designer as any)?.id || (tradeProduct as any).id,
            name: (designer as any)?.name || brand,
            slug: (designer as any)?.slug || null,
            biography: (designer as any)?.biography || "",
            founder: (designer as any)?.founder || null,
          },
          // Keep the pricing block whenever ANY pricing signal exists — including
          // 0, which renders as "Price upon Request". A truthy check here would
          // silently collapse zero-priced records and hide the RFQ CTA.
          pricing: (
            pricing.rrp_price_cents != null ||
            pricing.trade_price_cents != null ||
            (pricing.size_variants && pricing.size_variants.length)
          ) ? pricing : null,
          relatedPicks,
          tradeProductId: (tradeProduct as any).id,
          glbUrl: ((tradeProduct as any).glb_url as string | null) || null,
        } satisfies TradeProductResult;
      }

      if (!designerSlug || !productSlug) return null;

      // Admins can preview products of draft (unpublished) designers.
      let designerQuery = supabase
        .from("designers")
        .select("id, name, slug, display_name, biography, founder")
        .eq("slug", designerSlug);
      if (!isAdmin) designerQuery = designerQuery.eq("is_published", true);
      const { data: routeDesigner } = await designerQuery.maybeSingle();
      if (!routeDesigner) return null;
      let designer: any = routeDesigner;

      const pickFields = "id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, price_per_sqm_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered, com_meters, default_variant_label";
      let { data: picks } = await supabase
        .from("designer_curator_picks")
        .select(pickFields)
        .eq("designer_id", designer.id)
        .order("sort_order", { ascending: true });

      // Exact matches only (stored slug, title+subtitle, title, title without "by …").
      const exactMatch = (list: any[] | null | undefined) =>
        list?.find((p: any) => p.slug === productSlug) ||
        list?.find((p: any) => slugify(p.title + (p.subtitle ? `-${p.subtitle}` : "")) === productSlug) ||
        list?.find((p: any) => slugify(p.title) === productSlug) ||
        list?.find((p: any) => slugify(String(p.title).replace(/\s+by\s+.+$/i, "")) === productSlug) ||
        null;

      let product: any = exactMatch(picks);

      // A credited piece (e.g. Atelier Février's "Mushroom by Emma Donnersberg"
      // rug) can be linked under the credited designer's slug. Resolve an exact
      // stored slug anywhere in the catalogue BEFORE any fuzzy matching, so
      // "mushroom" never falls through to "Mushrooms – Gold Bronze".
      if (!product) {
        const { data: globalHits } = await supabase
          .from("designer_curator_picks")
          .select(pickFields)
          .eq("slug", productSlug)
          .limit(2);
        if (globalHits && globalHits.length === 1) {
          const hit: any = globalHits[0];
          const { data: owner } = await supabase
            .from("designers")
            .select("id, name, slug, display_name, biography, founder")
            .eq("id", hit.designer_id)
            .maybeSingle();
          if (owner) {
            designer = owner;
            product = hit;
            const { data: ownerPicks } = await supabase
              .from("designer_curator_picks")
              .select(pickFields)
              .eq("designer_id", owner.id)
              .order("sort_order", { ascending: true });
            picks = ownerPicks || [hit];
          }
        }
      }

      if (!picks || picks.length === 0) return null;

      // Fuzzy fallbacks: whole-word prefix/contains, then token overlap. Word
      // boundaries stop "mushroom" matching "mushrooms-gold-bronze".
      // Token overlap covers cases where the gallery card uses a trade_products name (e.g. "Angelo M Side Table Collection")
      // that doesn't slug-match the underlying curator pick title (e.g. "Angelo M/SR 45/55/80 Side Table Collection").
      const slugTokens = (s: string) =>
        s.split("-").filter((t) => t.length >= 3);
      const targetTokens = productSlug ? slugTokens(productSlug) : [];
      const overlapScore = (pickTitle: string) => {
        const ts = new Set(slugTokens(slugify(pickTitle)));
        return targetTokens.reduce((n, t) => n + (ts.has(t) ? 1 : 0), 0);
      };
      if (!product) {
        product =
          picks.find((p: any) => slugify(p.title).startsWith(`${productSlug}-`)) ||
          picks.find((p: any) => `-${slugify(p.title)}-`.includes(`-${productSlug}-`)) ||
          null;
      }

      if (!product && targetTokens.length >= 2) {
        const ranked = picks
          .map((p: any) => ({ p, score: overlapScore(p.title) }))
          .filter((r) => r.score >= Math.max(2, Math.ceil(targetTokens.length * 0.6)))
          .sort((a, b) => b.score - a.score);
        product = ranked[0]?.p ?? null;
      }

      if (!product) return null;

      const brandCandidates = Array.from(new Set([
        designer.display_name,
        designer.name,
      ].filter(Boolean))) as string[];

      // Pull trade pricing + extra images from trade_products.
      // PRIMARY join: source_pick_id (stable, set by the sync trigger).
      // FALLBACK: legacy (brand,name) match for rows still un-linked.
      const { data: byPick } = await supabase
        .from("trade_products")
        .select("id, image_url, gallery_images, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix, spec_sheet_url, dimensions, materials, lead_time, origin, description, glb_url")
        .eq("source_pick_id", (product as any).id)
        .eq("is_active", true)
        .limit(1);
      let tradeMatches = byPick;
      if (!tradeMatches || tradeMatches.length === 0) {
        let tradeQuery = supabase
          .from("trade_products")
          .select("id, image_url, gallery_images, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix, spec_sheet_url, dimensions, materials, lead_time, origin, description, glb_url")
          .eq("product_name", (product as any).title)
          .eq("is_active", true)
          .limit(1);
        if (brandCandidates.length === 1) tradeQuery = tradeQuery.eq("brand_name", brandCandidates[0]);
        else if (brandCandidates.length > 1) tradeQuery = tradeQuery.in("brand_name", brandCandidates);
        const { data: byBrand } = await tradeQuery;
        tradeMatches = byBrand;
      }
      const tradeProduct = tradeMatches?.[0] as any | undefined;

      const rawSizeVariants = applyRugPerSqmPricing(
        Array.isArray((product as any).size_variants) ? ((product as any).size_variants as any[]) : [],
        (product as any).category,
        (product as any).price_per_sqm_cents,
      ).filter((v) => (
        (typeof v.label === "string" && v.label.trim()) ||
        (typeof v.base === "string" && v.base.trim()) ||
        (typeof v.top === "string" && v.top.trim())
      ));

      const pricing: TradePricing | null = tradeProduct
        ? {
            trade_price_cents: tradeProduct.trade_price_cents ?? null,
            rrp_price_cents: tradeProduct.rrp_price_cents ?? null,
            currency: tradeProduct.currency || "EUR",
            price_unit: tradeProduct.price_unit ?? null,
            price_prefix: tradeProduct.price_prefix ?? null,
            spec_sheet_url: tradeProduct.spec_sheet_url ?? null,
            size_variants: rawSizeVariants.length ? rawSizeVariants : null,
          }
        : (rawSizeVariants.length || (product as any).trade_price_cents)
        ? {
            // Fallback: curator-pick price is treated as RRP; derive trade price below.
            trade_price_cents: null,
            rrp_price_cents: (product as any).trade_price_cents as number | null,
            currency: (product as any).currency || "EUR",
            price_unit: null,
            price_prefix: (product as any).price_prefix ?? null,
            spec_sheet_url: null,
            size_variants: rawSizeVariants.length ? rawSizeVariants : null,
          }
        : null;

      return {
        product: {
          ...(product as unknown as ProductRow),
          image_url: (product as any).image_url || tradeProduct?.image_url || null,
          gallery_images: (product as any).gallery_images?.length
            ? (product as any).gallery_images
            : tradeProduct?.gallery_images || null,
          // Fall back to trade_products for spec fields the curator pick
          // may have left blank — otherwise the trade sheet shows fewer
          // data points than the public page (which reads trade_products).
          dimensions: firstPublicVariantDimensionLabel((product as any).size_variants) || (product as any).dimensions || tradeProduct?.dimensions || null,
          materials: (product as any).materials || tradeProduct?.materials || null,
          lead_time: (product as any).lead_time || tradeProduct?.lead_time || null,
          origin: (product as any).origin || tradeProduct?.origin || null,
          description: (product as any).description || tradeProduct?.description || null,
          size_variants: (product as any).size_variants || null,
          is_upholstered: (product as any).is_upholstered ?? null,
          com_meters: (product as any).com_meters ?? null,
        },
        designer: {
          id: designer.id,
          // Use canonical brand/atelier name (e.g. "Atelier Pendhapa") as the
          // Maker label across the product page — NOT display_name, which often
          // resolves to the founders' personal duo (e.g. "Antonin Hautefort &
          // Ignatio Tenggara"). The duo attribution is still preserved on the
          // designer profile biography quote, which reads its own display_name.
          name: designer.name,
          slug: designer.slug,
          biography: (designer as any).biography || "",
          founder: (designer as any).founder || null,
        },
        pricing,
        relatedPicks: (picks as unknown as ProductRow[]).filter((p) => p.id !== (product as any).id),
        tradeProductId: tradeProduct?.id || null,
        glbUrl: (tradeProduct?.glb_url as string | null) || null,
      };
    },
    enabled: !!tradeProductIdParam || (!!designerSlug && !!productSlug),
    staleTime: 5 * 60_000,
  });
}

const TradeProductPage: React.FC = () => {
  const { id: tradeProductIdParam, slug: designerSlug, productSlug } = useParams<{ id: string; slug: string; productSlug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile: authProfile } = useAuth();
  const { toast } = useToast();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();
  // Pricing math is owned by the container engine (ProductConfigContext) so
  // Variant A and Variant B always resolve identical figures. Falls back to the
  // tier hook when this layout is rendered outside the container.
  const productConfig = useProductConfigOptional();
  const [localQuantity, setLocalQuantity] = useState(1);
  const quantity = productConfig ? productConfig.quantity : localQuantity;
  const setQuantity = productConfig ? productConfig.setQuantity : setLocalQuantity;
  const tierFallback = useTradeDiscount();
  const TRADE_DISCOUNT = productConfig?.tierDiscountPct ?? tierFallback.discountPct;
  const discountLabel = productConfig?.discountLabel ?? tierFallback.discountLabel;
  const tierLabel = productConfig?.tierLabel ?? tierFallback.tierLabel;
  const { showTradePrice, setShowTradePrice } = useTradePriceMode();
  const clientMultiplier = useClientProjectPricing();

  // ── Smart back navigation ──
  const stateFrom = (location.state as { from?: string } | null)?.from;
  const isTradeOrigin = (p?: string | null) =>
    !!p && (p.startsWith("/trade/") || p === "/trade");
  const storedFrom = typeof window !== "undefined"
    ? sessionStorage.getItem("trade_product_from_path")
    : null;
  const fromPath =
    stateFrom ||
    (isTradeOrigin(storedFrom) ? storedFrom! : undefined);

  useEffect(() => {
    if (stateFrom && isTradeOrigin(stateFrom)) {
      try { sessionStorage.setItem("trade_product_from_path", stateFrom); } catch { /* ignore */ }
    }
  }, [stateFrom]);

  const { data, isLoading } = useTradeProductBySlug(tradeProductIdParam, designerSlug, productSlug);
  const designNotes = useProductDesignNotes((data as any)?.product?.id);

  // ── Pricing display state ──
  const displayCurrency = productDisplayPolicy(false, "EUR").currency as DisplayCurrency;
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedTop, setSelectedTop] = useState<string | null>(null);
  // User-clicked swatch label (e.g. "Port Saint Laurent") when the resolved
  // variant.top / variant.base is a slash-joined bundle covering several
  // equivalently-priced finishes ("Port Saint Laurent / Travertino Silver /
  // Rosso Lepanto"). We keep the resolved variant for pricing, but the caption
  // + quote line label + swatch chips should reflect ONLY the finish the user
  // actually picked. Null means "no shrink override".
  const [selectedTopDisplay, setSelectedTopDisplay] = useState<string | null>(null);
  const [selectedBaseDisplay, setSelectedBaseDisplay] = useState<string | null>(null);
  // Finishes the selector currently highlights (pictured in the gallery
  // photo). Used to price the pictured pairing when the user hasn't picked.
  const [displayedFinishes, setDisplayedFinishes] = useState<{ base: string | null; top: string | null }>({ base: null, top: null });

  // Mirror the dashboard's finish selection into the shared container engine.
  useEffect(() => {
    productConfig?.setSelectedWoodFinish(selectedBase);
  }, [productConfig, selectedBase]);
  useEffect(() => {
    productConfig?.setSelectedUpholstery(selectedTop);
  }, [productConfig, selectedTop]);
  const [selectedSwatchGalleryIndices, setSelectedSwatchGalleryIndices] = useState<number[] | null>(null);
  // Hold the reel back until FinishSelector resolves per-finish photo grouping
  // so the full mixed set never flashes before narrowing (mirrors public page).
  const [finishGroupingPending, setFinishGroupingPending] = useState(true);
  useEffect(() => {
    if (!finishGroupingPending) return;
    const t = setTimeout(() => setFinishGroupingPending(false), 2500);
    return () => clearTimeout(t);
  }, [finishGroupingPending]);
  const [selectedSwatchGalleryName, setSelectedSwatchGalleryName] = useState<string | null>(null);
  const [selectedDualSize, setSelectedDualSize] = useState<string | null>(null);
  const [rugSelection, setRugSelection] = useState<RugSelection | null>(null);
  const [defaultPair, setDefaultPair] = useState<{ base: string; top: string } | null>(null);
  // Single-axis split: when each variant label encodes both size + material,
  // we expose two independent dropdowns and resolve the active variant by both.
  const [selectedSingleSize, setSelectedSingleSize] = useState<string | null>(null);
  const [selectedSingleMaterial, setSelectedSingleMaterial] = useState<string | null>(null);
  // Mirrors PublicProductPage: gallery jumps to a finish's mapped image when a
  // material/finish dropdown is changed (state-backed so behaviour matches the
  // public side exactly).
  const [galleryActiveIndex, setGalleryActiveIndex] = useState<number | undefined>(undefined);
  const finishDrivenGalleryRef = useRef(false);
  // Active image index is part of the shared container state.
  useEffect(() => {
    productConfig?.setActiveImageIndex(galleryActiveIndex ?? 0);
  }, [productConfig, galleryActiveIndex]);
  // Bumped on every parent-initiated jump so the gallery re-syncs even when the
  // numeric index is identical to the previous one (e.g. re-selecting the same finish).
  const [galleryJumpNonce, setGalleryJumpNonce] = useState(0);
  const galleryScrollRef = useRef<HTMLDivElement | null>(null);
  // On mobile/PWA, scroll the product image back into view when a finish
  // selection updates the gallery — otherwise the image is off-screen above
  // the dropdown and the user can't see the change.
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

  // Desktop dashboard: one viewport-height workspace (single asset window + fixed panel).
  const [isLg, setIsLg] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const on = () => setIsLg(mql.matches);
    mql.addEventListener("change", on);
    return () => mql.removeEventListener("change", on);
  }, []);
  const [workspaceAsset, setWorkspaceAsset] = useState<"3d" | number>("3d");
  // Once the 3D model is opened it stays the primary workspace asset:
  // hovering a photo thumbnail previews its configuration, clicking locks it.
  const [viewer3dOpen, setViewer3dOpen] = useState(false);
  const [viewer3dKey, setViewer3dKey] = useState(0);
  const [hoverPreviewIdx, setHoverPreviewIdx] = useState<number | null>(null);
  // Swatch-grid hover pool: main viewport only, cleared on mouse leave.
  // Never read by Felix, the inventory or the locked sidebar card.
  const [hoveredPreviewIndex, setHoveredPreviewIndex] = useState<number | null>(null);
  const [fsStart, setFsStart] = useState<number | null>(null);
  const masterRef = useRef<HTMLDivElement | null>(null);
  const [masterHeight, setMasterHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!isLg) { setMasterHeight(null); return; }
    const measure = () => {
      const el = masterRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      // Workspace pins at top-4 while the page scrolls, so size it to the viewport.
      void top;
      setMasterHeight(Math.max(480, Math.min(window.innerHeight - 32, 1000)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });

  // Mobile/PWA: shrink the product image once the user scrolls past a small threshold.
  const [galleryCompact, setGalleryCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    const onScroll = () => setGalleryCompact(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);




  const fxRates = useFxRates();

  // ── Quote drawer ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const [drawerPriceSnapshot, setDrawerPriceSnapshot] = useState<{ itemId: string; retailLabel: string | null; netLabel: string | null; configuration?: string; imageUrl?: string | null; finishes?: { name: string; image_url: string }[] } | null>(null);
  const drawerPricesRef = useRef<{ retailLabel: string | null; netLabel: string | null }>({ retailLabel: null, netLabel: null });

  const [adding, setAdding] = useState(false);
  const [copilotSave, setCopilotSave] = useState<
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; quoteId: string; at: Date; quantity: number }
    | { state: "failed"; quoteId?: string | null; message: string }
  >({ state: "idle" });
  const [added, setAdded] = useState(false);
  const [customRequestOpen, setCustomRequestOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  // True when this product has linked fabric/leather swatches — used to hide
  // the redundant "Select your upholstery finish" dropdown, since the swatch
  // picker already drives the upholstery price tier.
  const [hasLinkedFabrics, setHasLinkedFabrics] = useState(false);
  const [linkedWoodFinishes, setLinkedWoodFinishes] = useState<string[]>([]);
  const [selectedFabric, setSelectedFabric] = useState<import("@/components/FinishSelector").SelectedFinishInfo | null>(null);
  const [selectorQuoteFinishes, setSelectorQuoteFinishes] = useState<{ pickId: string; finishes: FelixQuoteFinish[] } | null>(null);
  const { data: felixLinkedSwatches = [] } = useQuery({
    queryKey: ["felix-linked-swatches", data?.product.id],
    enabled: !!data?.product.id,
    queryFn: async () => {
      const id = data?.product.id;
      if (!id) return [];
      const { data: rows, error } = await supabase.from("product_fabrics").select("image_indices,fabric:fabrics(name,image_url)").eq("pick_id", id);
      if (error) throw error;
      return (rows ?? []).flatMap((row) => row.fabric ? [{ ...row.fabric, image_indices: row.image_indices }] : []);
    },
  });
  // When a wood-finish swatch carries its own frame price (product_fabrics.price_cents_a),
  // we use it as the RRP base and add the fabric per-LM upcharge on top.
  const [selectedWoodPrice, setSelectedWoodPrice] = useState<{ id: string; name: string; price_cents: number; currency: string; image_url: string | null } | null>(null);
  // Top-axis swatch (for dual-axis Base × Top products) — drives the 3D
  // viewer's `topTextureUrl` so the top material retextures independently.
  const [selectedTopSwatch, setSelectedTopSwatch] = useState<{ name: string; image_url: string | null } | null>(null);
  // Names of currently-selected wood/top finish swatches that lack mapped
  // gallery images — surfaced as a note on the quote line.
  const [finishesMissingImages, setFinishesMissingImages] = useState<string[]>([]);
  // Tracks whether linked finish swatches are still being fetched by the
  // FinishSelector so the tearsheet CTA can show a disabled loading state.
  const [finishesLoading, setFinishesLoading] = useState(true);
  // Preview-only default fabric/wood textures for the 3D configurator so it
  // opens with a plausible finish applied before the user picks a swatch.
  // Does NOT drive pricing or the "Draft Tearsheet" button.
  const [previewFabricImg, setPreviewFabricImg] = useState<string | null>(null);
  const [previewWoodImg, setPreviewWoodImg] = useState<string | null>(null);
  // Pictured finishes of the active gallery photo — the 3D viewer's default
  // textures, so the model opens looking like the real item until the user
  // picks different swatches.
  const [picturedFinishImgs, setPicturedFinishImgs] = useState<{ base: string | null; top: string | null }>({ base: null, top: null });
  const handlePreviewSwatchesResolved = useCallback(
    (p: { fabricImageUrl: string | null; woodImageUrl: string | null }) => {
      setPreviewFabricImg(p.fabricImageUrl);
      setPreviewWoodImg(p.woodImageUrl);
    },
    [],
  );

  const handleHasFabricsChange = useCallback((has: boolean) => {
    setHasLinkedFabrics(has);
    setFinishesLoading(false);
  }, []);

  const handleWoodFinishesAvailable = useCallback((names: string[]) => {
    setLinkedWoodFinishes(names);
    setFinishesLoading(false);
  }, []);

  // Per-variant 3D models: one row per size/label. `default` variant wins when
  // no size is selected. Falls back to legacy tradeProducts.glb_url otherwise.
  const [glbVariants, setGlbVariants] = useState<
    { variant_label: string; glb_url: string; is_default: boolean; material_roles: Record<string, "fabric" | "base" | "top" | "ignore"> | null }[]
  >([]);
  useEffect(() => {
    const tpId = (data as any)?.tradeProductId as string | null | undefined;
    if (!tpId) {
      setGlbVariants([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("trade_product_glb_variants")
        .select("variant_label, glb_url, is_default, material_roles")
        .eq("product_id", tpId);
      if (cancelled) return;
      setGlbVariants((rows as any[]) || []);
    })();

    return () => {
      cancelled = true;
    };
  }, [(data as any)?.tradeProductId]);

  // Resolve the finishes pictured in each gallery photo so the 3D
  // configurator opens with the real item's finishes applied, and so hovering
  // a thumbnail while the 3D view is live can preview that photo's finishes.
  const [swatchRows, setSwatchRows] = useState<any[]>([]);
  useEffect(() => {
    const pickId = (data as any)?.product?.id as string | undefined;
    if (!pickId) { setSwatchRows([]); return; }
    let cancelled = false;
    (async () => {
      const { data: rows } = await (supabase as any)
        .from("product_fabric_swatches_public")
        .select("fabric_id, name, image_url, image_indices, category, is_active")
        .eq("pick_id", pickId);
      if (cancelled) return;
      setSwatchRows((rows || []).filter(
        (r: any) => r && r.is_active !== false && Array.isArray(r.image_indices) && r.image_indices.length,
      ));
    })();
    return () => { cancelled = true; };
  }, [(data as any)?.product?.id]);
  const finishesForImage = useCallback((idx: number) => {
    const shown: any[] = picturedFinishesForImage(swatchRows, idx);
    const FRAME_RE = /^(cement stuc|glossy lacquer)\b/i;
    const base = shown.filter((s: any) => FRAME_RE.test(s.name) || (s.category || "").toLowerCase() === "wood");
    const top = shown.filter((s: any) => !base.includes(s));
    const b = base.find((s: any) => s.image_url) || base[0];
    const t = top.find((s: any) => s.image_url) || top[0];
    return { base: b?.image_url ?? null, top: t?.image_url ?? null, baseName: (b?.name as string) ?? null, topName: (t?.name as string) ?? null };
  }, [swatchRows]);
  useEffect(() => {
    const f = finishesForImage(galleryActiveIndex ?? 0);
    setPicturedFinishImgs({ base: f.base, top: f.top });
  }, [finishesForImage, galleryActiveIndex]);




  useEffect(() => {
    if (!user) return;
    (async () => {
      const id = await fetchActiveDraftQuoteId(user.id);
      // A quote restored after reload wins; don't swap the drawer's quote underneath it.
      setActiveQuoteId((cur) => cur || id);
    })();
  }, [user]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    // Reset gallery to first image when navigating between products — the page
    // component instance is reused across slug changes, so stale index from the
    // previous product would otherwise persist (e.g. land on picture 3).
    setGalleryActiveIndex(undefined);
    // Swatches are re-fetched by FinishSelector on slug change, so the CTA
    // should re-enter its loading/disabled state until the new data reports in.
    setFinishesLoading(true);
  }, [designerSlug, productSlug]);

  // ── Unified variant resolution ──
  // Both the price caption AND handleAddToQuote (and any downstream renderer)
  // MUST derive the "which variant is selected" from the same source, so a
  // Travertino Rosso pick surfaces identically in the header, the quote card
  // and the quote line unit price.
  const sizeVariantsForResolve: any[] | null =
    (data?.pricing?.size_variants as any[] | undefined) || null;
  const activeVariantContext = React.useMemo(() => {
    const axes = computeVariantAxes(sizeVariantsForResolve);
    const baseAxisLabelRaw = (((data?.product as any)?.base_axis_label) || "").trim();
    const baseAxisIsDim = baseAxisLabelRaw
      ? isDimensionAxisLabel(baseAxisLabelRaw)
      : (axes.baseOptions.length > 0 && axes.baseOptions.every(looksLikeDimension));
    const baseOnlySizeOptions = axes.isBaseOnly
      ? Array.from(new Set(
          (sizeVariantsForResolve || []).map((v: any) => (v.label || "").trim()).filter(Boolean),
        ))
      : [];
    const baseOnlyRequiresSize = axes.isBaseOnly && !baseAxisIsDim && baseOnlySizeOptions.length > 1;
    const hasDualSize = axes.dualSizeOptions.length > 1;
    return {
      sizeVariants: sizeVariantsForResolve,
      isDualAxis: axes.isDualAxis,
      isBaseOnly: axes.isBaseOnly,
      hasSingleAxisSplit: axes.hasSingleAxisSplit,
      hasDualSize,
      baseOnlyRequiresSize,
      singleAxisParsed: axes.singleAxisParsed,
    };
  }, [sizeVariantsForResolve, (data?.product as any)?.base_axis_label]);

  const activeVariant = React.useMemo(
    () => resolveActiveVariant(
      {
        selectedVariantIdx,
        selectedBase,
        selectedTop,
        selectedDualSize,
        selectedSingleSize,
        selectedSingleMaterial,
      },
      activeVariantContext,
    ),
    [
      activeVariantContext,
      selectedVariantIdx,
      selectedBase,
      selectedTop,
      selectedDualSize,
      selectedSingleSize,
      selectedSingleMaterial,
    ],
  );
  const activeVariantCents: number | null = (() => {
    const c = activeVariant?.price_cents;
    return typeof c === "number" && c > 0 ? c : null;
  })();


  const felixSelectionRef = useRef<ProactiveTearsheetData | null>(null);
  const { addToInventory } = useProjectInventory();

  const handleAddToQuote = useCallback(async () => {
    if (!user || !data) return;
    const felixSelection = felixSelectionRef.current;
    const selectedDrawerPrices = { ...drawerPricesRef.current };
    setAdding(true);
    setCopilotSave({ state: "saving" });
    try {
      const { product, designer } = data;
      let quoteId = activeQuoteId;
      if (!quoteId) {
        const quoteCurrencies = ["SGD", "USD", "EUR", "GBP"];
        const productCurrency = data?.pricing?.currency || "EUR";
        const initialCurrency = quoteCurrencies.includes(displayCurrency)
          ? displayCurrency
          : quoteCurrencies.includes(productCurrency)
            ? productCurrency
            : "EUR";
        const { data: q, error } = await createActiveDraftQuote(user.id, { currency: initialCurrency });
        if (error || !q) {
          toast({ title: "Error creating quote", description: error?.message, variant: "destructive" });
          return;
        }
        quoteId = q.id;
        setActiveQuoteId(quoteId);
      }


      // Build the chosen variant label (finish/size) from the current selection
      // so the quote line records exactly what the user picked.
      let variantLabel: string | null = null;
      let overrideUnitPriceCents: number | null = null;
      const sv: any[] | undefined = data?.pricing?.size_variants ?? undefined;
      const buildDualLabel = (v: any): string =>
        [v?.base, v?.top, v?.size, v?.label].filter(Boolean).map((s: string) => String(s).trim()).join(" · ");
      if (rugSelection && rugSelection.sizeLabel) {
        variantLabel = [rugSelection.sizeLabel, rugSelection.colour].filter(Boolean).join(" · ");
        if (rugSelection.totalCents) overrideUnitPriceCents = rugSelection.totalCents;
      } else if (selectedBase || selectedTop) {
        // Prefer the user's actual clicked swatch label when the resolved
        // variant bundles multiple finishes under one row (e.g. "Port Saint
        // Laurent / Travertino Silver / Rosso Lepanto" as a single top).
        const shrink = (resolved: string | null, display: string | null) => {
          if (!resolved) return null;
          if (!display) return resolved;
          return /\s\/\s/.test(resolved) && resolved.toLowerCase().includes(display.toLowerCase())
            ? display
            : resolved;
        };
        const baseForLabel = shrink(selectedBase, selectedBaseDisplay);
        const topForLabel = shrink(selectedTop, selectedTopDisplay);
        variantLabel = [baseForLabel, topForLabel, selectedDualSize].filter(Boolean).join(" · ");
      
      } else if (selectedSingleMaterial || selectedSingleSize) {
        variantLabel = [selectedSingleSize, selectedSingleMaterial].filter(Boolean).join(" · ");
      } else if (selectedVariantIdx != null) {
        const v = sv && sv[selectedVariantIdx];
        if (v?.label) variantLabel = String(v.label).trim();
      } else if (sv && sv.length === 1) {
        const v = sv[0];
        variantLabel = buildDualLabel(v) || (v?.label ? String(v.label).trim() : null);
      }
      // Fold the wood-finish swatch into the label so it appears on the quote.
      if (selectedWoodPrice?.name) {
        const wood = selectedWoodPrice.name.trim();
        if (wood && !(variantLabel && variantLabel.toLowerCase().includes(wood.toLowerCase()))) {
          variantLabel = variantLabel ? `${variantLabel} · ${wood}` : wood;
        }
      }


      // Resolve the finish-specific gallery photo so the quote thumbnail
      // reflects the finish the user actually picked (Walnut vs Oak, etc.)
      // instead of the product's default primary image.
      const galleryImgs = (((data?.product as any)?.gallery_images || []).filter(Boolean)) as string[];
      const heroList = galleryImgs.length > 0
        ? galleryImgs
        : ([product.image_url, (data?.product as any)?.hover_image_url].filter(Boolean) as string[]);
      const finishMapForQuote = buildProductFinishMap((data?.product as any)?.variant_image_map);
      const svForImage: any[] = sv || (product as any)?.size_variants || [];
      const requiresPair = activeVariantContext.isDualAxis;
      // IMPORTANT: use the user's actually-clicked swatch label (not the
      // slash-joined price-equivalence bundle) so both variant_image_map and
      // filename fallback lookups target the specific finish the user chose.
      // Otherwise a bundle like "Port Saint Laurent / Travertino Silver /
      // Rosso Lepanto" would let the filename matcher accidentally pick the
      // Travertino Silver gallery photo.
      const shrinkForImage = (resolved: string | null, display: string | null) => {
        if (!resolved) return null;
        if (!display) return resolved;
        return /\s\/\s/.test(resolved) && resolved.toLowerCase().includes(display.toLowerCase())
          ? display
          : resolved;
      };
      const baseForImage = shrinkForImage(selectedBase, selectedBaseDisplay);
      const topForImage = shrinkForImage(selectedTop, selectedTopDisplay);
      let resolvedImgIdx: number | undefined;
      const normImageLabel = (s: string | null | undefined) => (s || "").trim().toLowerCase();
      const swatchImageStillMatchesSelection = selectedSwatchGalleryName
        ? [
            selectedWoodPrice?.name,
            selectedFabric?.name,
            selectedTopDisplay,
            selectedBaseDisplay,
            topForImage,
            baseForImage,
            selectedSingleMaterial,
          ].some((label) => normImageLabel(label) === normImageLabel(selectedSwatchGalleryName))
        : false;
      if (selectedSwatchGalleryIndices?.length && swatchImageStillMatchesSelection) {
        const swatchIdx = Math.max(0, selectedSwatchGalleryIndices[0] - 1);
        if (swatchIdx >= 0 && swatchIdx < heroList.length) resolvedImgIdx = swatchIdx;
      }
      if (baseForImage || topForImage || selectedDualSize) {
        resolvedImgIdx ??= resolveVariantImageIndex(finishMapForQuote, {
          base: baseForImage,
          top: topForImage,
          size: selectedDualSize,
          label: null,
          variants: svForImage as any,
          imageCount: heroList.length,
          requireCompletePair: requiresPair,
        });
      }
      if (resolvedImgIdx === undefined) {
        const singleLabel = selectedSingleMaterial || selectedWoodPrice?.name || null;
        resolvedImgIdx = resolveFinishImageIndex(finishMapForQuote, singleLabel, heroList.length);
      }
      const filenameResolvedImageUrl = resolvedImgIdx == null
        ? resolveGalleryImageByFinishFilename(heroList, [
            selectedWoodPrice?.name,
            selectedFabric?.name,
            baseForImage,
            topForImage,
            selectedSingleMaterial,
            selectedSingleSize,
          ])
        : null;
      const resolvedImageUrl = (resolvedImgIdx != null ? heroList[resolvedImgIdx] : null) || filenameResolvedImageUrl || product.image_url || null;


      const { data: itemId, error } = await supabase.rpc("add_gallery_product_to_quote", {
        _user_id: user.id,
        _quote_id: quoteId,
        _product_name: product.title,
        _brand_name: designer.name,
        _category: product.category || "",
        _image_url: resolvedImageUrl,
        _dimensions: product.dimensions || null,
        _materials: product.materials || null,
        _quantity: 1,
        // Merge key: same product + same variant merges qty; different variants
        // (e.g. 10-Lights vs 20-Lights) stay as separate lines with their own price.
        _variant_label: variantLabel ?? undefined,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setCopilotSave({ state: "failed", quoteId, message: error.message });
      } else {
        // Persist the chosen variant on the freshly created/merged quote item,
        // and pre-fill shipping (CBM / kg / mode / origin country) from the
        // catalogue so the per-line shipping estimator is accurate from day one.
        if (itemId) {
          setDrawerPriceSnapshot({ itemId: String(itemId), ...selectedDrawerPrices,
            configuration: felixSelection?.finishes?.map((finish) => `${finish.label}: ${finish.name}`).join(" · "),
            imageUrl: images[galleryActiveIndex ?? 0] || resolvedImageUrl,
            finishes: felixSelection?.finishes?.filter((finish) => !!finish.imageUrl).map((finish) => ({ name: finish.name, image_url: finish.imageUrl || "" })),
          });
          const patch: any = {};
          if (variantLabel) patch.variant_label = variantLabel;
          // Ensure the finish-specific image sticks even when the RPC merged
          // this line onto an existing quote row that had the default photo.
          if (resolvedImageUrl && resolvedImageUrl !== product.image_url) {
            patch.image_url = resolvedImageUrl;
          }

          // Flag finishes the user selected that have no mapped reference
          // images so the concierge / designer doesn't assume a visual match.
          const noteParts: string[] = [];
          if (finishesMissingImages.length > 0) {
            noteParts.push(`Note: No reference image on file for selected finish${finishesMissingImages.length > 1 ? "es" : ""}: ${finishesMissingImages.join(", ")}. Concierge to confirm visuals before order.`);
          }
          // Carry the product legend (Technical Specs) onto the quote line so
          // voltage / lamping / certifications follow the product into quoting.
          if (product.materials_description?.trim()) {
            noteParts.push(product.materials_description.trim());
          }
          if (noteParts.length > 0) {
            patch.notes = noteParts.join("\n\n");
          }


          // Compute the chosen line's unit price: wood-finish base (if picked)
          // OR catalog RRP, PLUS the fabric per-LM upcharge. Both legs are
          // normalised into the product currency, then converted into the
          // quote currency so future FX moves don't shift this line.
          const productCcy = ((data?.pricing?.currency || "EUR") as DisplayCurrency);
          const activeV: any = (selectedVariantIdx != null && sv) ? sv[selectedVariantIdx] : null;
          const metersForLine =
            (activeV && typeof activeV.meters === "number" ? activeV.meters : null)
            ?? (data?.product as any)?.com_meters
            ?? null;

          // Persist fabric metadata
          if (selectedFabric?.id) {
            const upchargeCents =
              selectedFabric.price_per_lm_cents && metersForLine
                ? Math.round(selectedFabric.price_per_lm_cents * metersForLine)
                : null;
            patch.fabric_id = selectedFabric.id;
            patch.fabric_meters = metersForLine;
            patch.fabric_upcharge_cents = upchargeCents;
            patch.fabric_currency = selectedFabric.currency || null;
          }

          // Persist wood-finish swatch reference for the thumbnail.
          if (selectedWoodPrice?.id) {
            patch.wood_fabric_id = selectedWoodPrice.id;
          } else {
            // Fallback: marble/stone/other variants aren't in the wood-price
            // list, but they DO have a swatch row in product_fabric_swatches
            // (used by ActiveSwatchCaption). Match by name so the quote drawer
            // renders the correct swatch thumbnail (e.g. Angelo M/R table →
            // "Bianco Statuarietto") just like it does for the chair's Walnut.
            try {
              const candidates = [
                selectedWoodPrice?.name,
                selectedTopDisplay,
                selectedBaseDisplay,
                selectedSingleMaterial,
                selectedTop,
                selectedBase,
                variantLabel,
              ].filter(Boolean).map((s: any) => String(s));
              if (candidates.length && (product as any)?.id) {
                const { data: swRows } = await (supabase as any)
                  .from("product_fabric_swatches_public")
                  .select("fabric_id, name, image_url, sort_order, is_active")
                  .eq("pick_id", (product as any).id)
                  .order("sort_order", { ascending: true });
                const match = findQuoteFinishSwatch(
                  candidates,
                  (swRows || []).filter((r: any) => r?.is_active !== false),
                );
                if (match?.fabric_id) patch.wood_fabric_id = match.fabric_id;
              }
            } catch { /* non-blocking */ }
          }
          // Resolve the selected variant's price via the SHARED resolver used
          // by the caption. This guarantees the quote line reflects the finish/size
          // the user actually picked (e.g. Travertino Rosso €14,263) rather
          // than the RPC's default "starting" RRP (Kynos €12,116) — and stays
          // in lock-step with the price shown above the "Add to Quote" button.
          // Price resolution parity with the on-page caption: if the user
          // picked only one axis of a dual-axis product (e.g. finish but not
          // size), fall back to the cheapest priced variant that matches
          // the partial selection — same value the "From €X" caption shows —
          // instead of the RPC's default base RRP (Kynos €12,116).
          let selectedVariantCents: number | null = activeVariantCents;
          if (selectedVariantCents == null && sv) {
            selectedVariantCents = resolvePartialDualMinCents(
              { selectedBase, selectedTop, selectedDualSize },
              { sizeVariants: sv, isDualAxis: activeVariantContext.isDualAxis },
            );
          }


          // Combined override unit price (wood + fabric upcharge), in quote currency.
          if (overrideUnitPriceCents != null) {
            patch.unit_price_cents = overrideUnitPriceCents;
            patch.unit_price_currency = productCcy;
          } else if (selectedWoodPrice || selectedFabric || selectedVariantCents != null) {
            // Base price priority: wood swatch override > selected variant > catalog RRP.
            const woodInProd = selectedWoodPrice?.price_cents
              ? (selectedWoodPrice.currency === productCcy
                  ? selectedWoodPrice.price_cents
                  : (convertCents(selectedWoodPrice.price_cents, selectedWoodPrice.currency, productCcy, fxRates) ?? 0))
              : null;
            const rrpProd = (data?.pricing?.rrp_price_cents ?? null) as number | null;
            const baseProd = woodInProd ?? selectedVariantCents ?? rrpProd;
            // Fabric upcharge → product currency
            let upchargeProd = 0;
            if (selectedFabric?.price_per_lm_cents && metersForLine) {
              const raw = Math.round(selectedFabric.price_per_lm_cents * metersForLine);
              const ccy = selectedFabric.currency || productCcy;
              upchargeProd = ccy === productCcy
                ? raw
                : (convertCents(raw, ccy, productCcy, fxRates) ?? 0);
            }
            if (baseProd != null) {
              const totalProd = baseProd + upchargeProd;
              // Resolve the quote currency, then convert.
              const { data: qRow } = await supabase
                .from("trade_quotes")
                .select("currency")
                .eq("id", quoteId)
                .maybeSingle();
              const quoteCcy = ((qRow?.currency || productCcy) as DisplayCurrency);
              const totalQuote = productCcy === quoteCcy
                ? totalProd
                : (convertCents(totalProd, productCcy, quoteCcy, fxRates) ?? totalProd);
              patch.unit_price_cents = totalQuote;
              patch.unit_price_currency = quoteCcy;
            }
          }





          // Read the line's resolved product, then read the product's packing
          // defaults. Only fill ship_* fields that are still NULL on the line.
          const { data: itemRow } = await supabase
            .from("trade_quote_items")
            .select("id, product_id, ship_cbm, ship_weight_kg, ship_mode, ship_origin_country")
            .eq("id", itemId as unknown as string)
            .maybeSingle();
          if (itemRow?.product_id) {
            const { data: prod } = await supabase
              .from("trade_products")
              .select("pack_cbm, pack_weight_kg, default_ship_mode, pickup_country")
              .eq("id", itemRow.product_id)
              .maybeSingle();
            if (prod) {
              if (itemRow.ship_cbm == null && prod.pack_cbm != null)
                patch.ship_cbm = prod.pack_cbm;
              if (itemRow.ship_weight_kg == null && prod.pack_weight_kg != null)
                patch.ship_weight_kg = prod.pack_weight_kg;
              if (!itemRow.ship_mode && prod.default_ship_mode)
                patch.ship_mode = prod.default_ship_mode;
              if (!itemRow.ship_origin_country && prod.pickup_country)
                patch.ship_origin_country = prod.pickup_country;
            }
          }

          if (Object.keys(patch).length > 0) {
            const { error: patchError } = await supabase
              .from("trade_quote_items")
              .update(patch)
              .eq("id", itemId as unknown as string);
            if (patchError) throw new Error(`Line added but its finishes didn't save: ${patchError.message}`);
          }
        }
        // Confirm the line is really stored on this quote before calling it saved.
        const { data: savedRow, error: verifyError } = itemId
          ? await supabase.from("trade_quote_items").select("id, quantity").eq("id", String(itemId)).eq("quote_id", quoteId).maybeSingle()
          : { data: null, error: null };
        if (verifyError || !savedRow) {
          setCopilotSave({ state: "failed", quoteId, message: verifyError?.message || "The line isn't on this quote yet." });
          setDrawerRefreshKey((k) => k + 1);
          return;
        }
        setCopilotSave({ state: "saved", quoteId, at: new Date(), quantity: (savedRow as any).quantity });
        setAdded(true);
        // Mirror the piece into the global project inventory so the Spatial
        // Visualiser's Project Assets drawer can place it into the room.
        addToInventory({
          id: String(data.tradeProductId || (product as any)?.id || product.title),
          productName: product.title,
          productType: product.title,
          selectedUpholstery: selectedFabric?.name || selectedTopDisplay || null,
          selectedFrameFinish: selectedWoodPrice?.name || selectedBaseDisplay || selectedBase || null,
          upholsteryMaterial: selectedFabric ? {
            id: selectedFabric.id,
            name: selectedFabric.name,
            brand_name: designer.name,
            category: "Upholstery",
            material_type: "fabric",
            color_family: null,
            image_url: selectedFabric.image_url || null,
          } : null,
          brandName: designer.name,
          imageUrl: resolvedImageUrl,
          glbUrl: data.glbUrl || null,
          dimensions: selectedDualSize || selectedSingleSize || product.dimensions || null,
          variantLabel: [variantLabel, selectedFabric?.name].filter(Boolean).join(" · ") || null,
          finishes: [
            selectedBaseDisplay || selectedBase,
            selectedTopDisplay || selectedTop,
            selectedSingleMaterial,
            selectedWoodPrice?.name,
            selectedFabric?.name,
          ].filter(Boolean).map((s) => String(s)),
        });
        setDrawerRefreshKey((k) => k + 1);
        setDrawerOpen(true);
        try { window.sessionStorage.setItem(`ma-copilot-open-v1:${product.id}`, activeQuoteId || quoteId); } catch { /* noop */ }
        if (felixSelection) {
          window.dispatchEvent(new CustomEvent("concierge:propose_tearsheet_proactive", { detail: { ...structuredClone(felixSelection), lockedAt: Date.now() } }));
        }
        toast({
          title: "Added to quote",
          description: `${product.title} added to QU-${quoteId.slice(0, 6).toUpperCase()}`,
        });
        setTimeout(() => setAdded(false), 2500);
      }
    } catch (err) {
      setCopilotSave({ state: "failed", message: err instanceof Error ? err.message : "The quote line could not be saved." });
    } finally {
      setAdding(false);
    }
  }, [user, data, activeQuoteId, toast, addToInventory, selectedBase, selectedTop, selectedBaseDisplay, selectedTopDisplay, selectedSwatchGalleryIndices, selectedSwatchGalleryName, selectedDualSize, selectedSingleMaterial, selectedSingleSize, selectedVariantIdx, rugSelection, selectedFabric, selectedWoodPrice, fxRates, displayCurrency, finishesMissingImages, activeVariantCents]);

  // Preselect Base/Top/Size (dual-axis) or Material/Size (single-axis) from
  // URL query params — used when the concierge 3D drawer deep-links here so
  // the on-page price reflects the finishes the architect just chose.
  // Runs BEFORE the auto-default effect so ?base=/?top= take priority.
  useEffect(() => {
    const sv = data?.pricing?.size_variants ?? undefined;
    if (!sv || !sv.length) return;
    if (selectedBase || selectedTop || selectedSingleMaterial || selectedDualSize) return;
    const qp = new URLSearchParams(location.search);
    const qBase = qp.get("base");
    const qTop = qp.get("top");
    const qSize = qp.get("size");
    const qMaterial = qp.get("material");
    if (!qBase && !qTop && !qSize && !qMaterial) return;
    const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
    const matchName = (candidate: string | null, values: (string | undefined)[]) => {
      if (!candidate) return null;
      const c = norm(candidate);
      for (const v of values) {
        if (!v) continue;
        const vn = norm(v);
        if (vn === c || vn.includes(c) || c.includes(vn)) return v;
      }
      return null;
    };
    const svArr = sv as any[];
    if (qBase || qTop) {
      const baseVal = matchName(qBase, svArr.map((v) => v?.base)) ?? qBase;
      const topVal = matchName(qTop, svArr.map((v) => v?.top)) ?? qTop;
      if (baseVal) setSelectedBase(baseVal);
      if (topVal) setSelectedTop(topVal);
      if (qSize) setSelectedDualSize(qSize);
      const rawMap = (data?.product as any)?.variant_image_map;
      const finishMap = buildProductFinishMap(rawMap);
      const imgCount = ((data?.product as any)?.gallery_images?.length) ||
        ([(data?.product as any)?.image_url, (data?.product as any)?.hover_image_url].filter(Boolean).length);
      const idx = resolveVariantImageIndex(finishMap, {
        base: baseVal || undefined,
        top: topVal || undefined,
        size: qSize || undefined,
        variants: svArr as any,
        imageCount: imgCount,
      });
      if (idx !== undefined) {
        setGalleryActiveIndex(idx);
        setGalleryJumpNonce((n) => n + 1);
      }
    } else if (qMaterial || qSize) {
      if (qMaterial) setSelectedSingleMaterial(qMaterial);
      if (qSize) setSelectedSingleSize(qSize);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.product?.id]);

  // Default the dual-axis pickers to the first base + its uniquely-compatible
  // top so users see a complete pairing on load (e.g. Pars Cocktail Table:
  // "Aged Brass + Bisque Leather" → "Paglierino Travertine"). Picking the
  // other base then auto-swaps the top via the existing handlers.
  useEffect(() => {
    const sv = data?.pricing?.size_variants ?? undefined;
    if (!sv || !sv.length || selectedBase || selectedTop) return;
    // Shared gating: only auto-default when there is genuinely one pairing
    // to show. Products with multiple bases (e.g. Stone D Coffee Table)
    // require an explicit user pick — otherwise the gallery jumps to a
    // mapped finish image on load and hides the editorial photos.
    const pair = resolveAutoDefaultPair(sv as any);
    if (!pair) return;
    setSelectedBase(pair.base);
    setSelectedTop(pair.top);
    setDefaultPair(pair);
    // Sync gallery to the complete Base × Top mapped image (mirrors handleMaterialChange).
    const rawMap = (data?.product as any)?.variant_image_map;
    const finishMap = buildProductFinishMap(rawMap);
    const imgCount = ((data?.product as any)?.gallery_images?.length) ||
      ([(data?.product as any)?.image_url, (data?.product as any)?.hover_image_url].filter(Boolean).length);
    const idx = resolveVariantImageIndex(finishMap, {
      base: pair.base,
      top: pair.top,
      variants: sv as any,
      imageCount: imgCount,
    });
    if (idx !== undefined) {
      setGalleryActiveIndex(idx);
      setGalleryJumpNonce((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.product?.id]);

  // Reverse sync: when the user navigates the gallery via thumbnails / swipe
  // / arrows, snap the finish dropdowns to the variant whose mapped image is
  // now showing. No-op when the active image isn't tied to any variant
  // (e.g. an editorial photo) or when the dropdowns already match.
  useEffect(() => {
    if (finishDrivenGalleryRef.current) {
      finishDrivenGalleryRef.current = false;
      return;
    }
    // On load (no gallery navigation yet) sync from the photo actually shown
    // (index 0) so the price matches the pictured finishes — but never
    // override a finish the user has already picked.
    if (galleryActiveIndex === undefined && (selectedBase || selectedTop || selectedDualSize)) return;
    const rawMap = (data?.product as any)?.variant_image_map;
    const finishMap = buildProductFinishMap(rawMap);
    if (!finishMap) return;
    const variants = (data?.pricing?.size_variants
      || (data?.product as any)?.size_variants
      || []) as { label?: string; base?: string; top?: string }[];
    const match = findVariantForImageIndex(finishMap, variants, galleryActiveIndex ?? 0);
    if (!match) return;
    const nextBase = match.base;
    const nextTop = match.top;
    const nextLabel = match.label;
    // Dual-axis path
    if (nextBase != null || nextTop != null) {
      if ((nextBase ?? null) !== (selectedBase ?? null)) setSelectedBase(nextBase);
      if ((nextTop ?? null) !== (selectedTop ?? null)) setSelectedTop(nextTop);
      if (nextLabel && nextLabel !== (selectedDualSize ?? null)) setSelectedDualSize(nextLabel);
    }
    // Single-axis (size — material) path — parse the variant so we set
    // selectedSingleMaterial to just the material (e.g. "Grand Antique
    // Marble"), not the full "size — material" label, otherwise the size
    // availability check greys out every size and surfaces the wrong helper.
    if (nextLabel) {
      const parsed = singleAxisParsed.find((p) => p.variant?.label === nextLabel);
      if (parsed?.material && parsed.material !== (selectedSingleMaterial ?? null)) {
        setSelectedSingleMaterial(parsed.material);
      }
      if (parsed?.size && parsed.size !== (selectedSingleSize ?? null)) {
        setSelectedSingleSize(parsed.size);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [galleryActiveIndex, data?.product?.id]);

  // Product-level default variant (e.g. Galet Dining Table → Large): the size
  // picker opens on that option instead of the empty "Select Your Size"
  // placeholder. Applied once per product so a visitor who clears the choice is
  // never pushed back onto it. Declared above the loading guards so the hook
  // order can never change between renders.
  const defaultVariantAppliedFor = useRef<string | null>(null);
  useEffect(() => {
    const row = (data?.product ?? null) as any;
    const pid = row?.id ?? null;
    if (!pid || defaultVariantAppliedFor.current === pid) return;
    const wanted = row?.default_variant_label;
    const pickVariants = Array.isArray(row?.size_variants) ? row.size_variants : null;
    const axes = computeVariantAxes(pickVariants);
    if (!wanted || axes.isDualAxis || axes.isBaseOnly || axes.hasSingleAxisSplit) {
      defaultVariantAppliedFor.current = pid;
      return;
    }
    // Index the picker's own list: priced variants when the pricing service
    // supplies them, otherwise the curator pick's rows.
    const priced = Array.isArray((data?.pricing as any)?.size_variants)
      ? ((data?.pricing as any).size_variants as any[])
      : [];
    const match = resolveDefaultVariant(priced.length ? priced : pickVariants, wanted);
    // Variants can still be loading — retry on the next data tick.
    if (!match) return;
    defaultVariantAppliedFor.current = pid;
    setSelectedVariantIdx(match.index);
  }, [data]);

  // Runs after render, when the headline and its selection snapshot agree.
  // Update-only: the listener never creates a card or opens Felix.
  useEffect(() => {
    if (!data || isLoading) return;
    const selection = felixSelectionRef.current;
    if (selection?.productId !== data.product.id) return;
    window.dispatchEvent(new CustomEvent("concierge:update_product_selection", { detail: selection }));
  });

  // Reopen Co-Pilot only after a genuine page reload (never when arriving from
  // a gallery click), for the same quote the drawer was showing.
  useEffect(() => {
    if (!data?.product?.id) return;
    const pid = data.product.id;
    try {
      const key = `ma-copilot-open-v1:${pid}`;
      const savedQuote = window.sessionStorage.getItem(key);
      if (!savedQuote) return;
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      const isReload = nav?.type === "reload" && performance.now() < 15000;
      if (!isReload) { window.sessionStorage.removeItem(key); return; }
      setActiveQuoteId(savedQuote);
      setDrawerOpen(true);
    } catch { /* noop */ }
  }, [data?.product?.id]);

  if (isLoading) {
    return <div className="pt-8"><ProductDetailSkeleton variant="page" /></div>;
  }

  if (!data) {
    return <NotFound />;
  }

  const { product, designer, relatedPicks, pricing, tradeProductId, glbUrl } = data;

  const designerDisplay = formatDesignerDisplayName(designer.name);
  const isEcartProduct = isEcartReedition({
    designerName: designer.name,
    founder: designer.founder,
  });
  const curatorNotes = buildProductCuratorNotes({
    title: product.title,
    brandName: designerDisplay,
    description: product.description,
    dimensions: product.dimensions,
    category: product.category,
    subcategory: product.subcategory,
  });
  // Only hand-written, sourced notes are shown; description-derived or stock copy never is.
  const curatorNoteSections = designNotes.map((n, i) => ({ label: n.label as string, text: n.text, Icon: [Award, Compass, FileText, FileText][i] ?? FileText }));

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
    designerId: tradeProductId || product.id,
    section: "designers",
  };

  const pinned = isPinned(product.title, tradeProductId || product.id);
  const favoriteId = tradeProductId || product.id;
  const favorited = isFavorited(favoriteId);
  const requestedFabricName = new URLSearchParams(location.search).get("fabric");

  // Shared tearsheet URL builder — the "Draft Tearsheet with These Finishes"
  // button and its copy-link control both use this so they always agree on
  // the exact product + finish selection being shared.
  const buildTearsheetHref = () => {
    const params = new URLSearchParams();
    params.set("product", product.id);
    const fabricName = selectedFabric?.name || selectedTopDisplay || selectedTop || null;
    const woodName = selectedWoodPrice?.name || selectedBaseDisplay || selectedBase || selectedSingleMaterial || null;
    if (fabricName) params.set("fabric", String(fabricName));
    if (selectedFabric?.image_url) params.set("fabricImg", selectedFabric.image_url);
    if (woodName) params.set("wood", String(woodName));
    if (selectedWoodPrice?.image_url) params.set("woodImg", selectedWoodPrice.image_url);
    const variantLabelParts = [selectedBase, selectedTop, selectedDualSize, selectedSingleSize]
      .filter(Boolean).map(String);
    if (variantLabelParts.length) params.set("variant", variantLabelParts.join(" · "));
    if (!showTradePrice) params.set("presentation", "1");
    return `/trade/tearsheets?${params.toString()}`;
  };

  const { rawSubcategory, normalizedSubcategory } = normalizeCategoryContext(product.subcategory);

  // Fallback back-target: prefer the originating designer/atelier gallery so
  // users return to the same brand context they came from.
  const fallbackPath = designerSlug
    ? `/trade/gallery/${designerSlug}`
    : (() => {
        const fallbackParams = new URLSearchParams();
        if (product.category) fallbackParams.set("category", product.category);
        if (normalizedSubcategory) fallbackParams.set("subcategory", normalizedSubcategory);
        const query = fallbackParams.toString();
        return `/trade/gallery${query ? `?${query}` : ""}`;
      })();

  const galleryFromAdmin = (product.gallery_images || []).filter(Boolean) as string[];
  const images = (galleryFromAdmin.length > 0
    ? galleryFromAdmin
    : Array.from(new Set([product.image_url, product.hover_image_url].filter(Boolean)))
  ) as string[];

  // Finish-scoped reel: when the selected swatch owns a range of photos, show
  // only those (mirrors PublicProductPage).
  const visibleImageIndices: number[] | null = (() => {
    if (!selectedSwatchGalleryIndices || selectedSwatchGalleryIndices.length === 0) return null;
    const abs = Array.from(new Set(selectedSwatchGalleryIndices.map((i) => i - 1)))
      .filter((i) => i >= 0 && i < images.length)
      .sort((a, b) => a - b);
    return abs.length ? abs : null;
  })();
  const visibleImages = visibleImageIndices
    ? visibleImageIndices.map((i) => images[i])
    : finishGroupingPending && images.length > 1
    ? images.slice(0, 1)
    : images;
  // Main viewport shows the hover preview when present, else the permanent pick.
  const viewportImageIndex = hoveredPreviewIndex ?? galleryActiveIndex;
  const visibleActiveIndex = visibleImageIndices
    ? Math.max(0, visibleImageIndices.indexOf(viewportImageIndex ?? visibleImageIndices[0]))
    : viewportImageIndex;
  const hoveredPreviewImage: string | null = hoveredPreviewIndex !== null ? images[hoveredPreviewIndex] ?? null : null;
  const permanentlySelectedImage: string = images[galleryActiveIndex ?? 0] || product?.image_url || "";



  // Data-driven finish → gallery image index mapping (shared with PublicProductPage).
  const productFinishMap = buildProductFinishMap((product as any)?.variant_image_map);

  // Identical handler signature/behaviour to PublicProductPage.handleMaterialChange.
  // `opts` carries the *post-update* axis state (base, top, size) so the
  // resolver can always look up the canonical composite key for the
  // current selection — guaranteeing the hero image stays in sync no
  // matter which axis the user touches.
  const handleMaterialChange = (
    label: string | null,
    opts?: { base?: string | null; top?: string | null; size?: string | null; fromSwatch?: boolean }
  ) => {
    finishDrivenGalleryRef.current = true;
    setHoverPreviewIdx(null);
    // Detect a "clear selection" call: no label and no axis values.
    const isClear =
      !label &&
      (!opts || (!opts.base && !opts.top && !opts.size));
    if (isClear) {
      // Reset hero back to the primary product image so the gallery visibly
      // matches the cleared selection state.
      setGalleryActiveIndex(0);
      setGalleryJumpNonce((n) => n + 1);
      return;
    }
    const variantsForAxes = pricing?.size_variants || product.size_variants || [];
    const requiresBaseAndTopSelection =
      variantsForAxes.some((v: any) => v.base && String(v.base).trim()) &&
      variantsForAxes.some((v: any) => v.top && String(v.top).trim());
    // If the Base axis only offers one distinct value, treat it as implicitly
    // selected so picking just the Top still resolves the composite key.
    const distinctBases = Array.from(
      new Set(variantsForAxes.map((v: any) => (v.base || "").trim()).filter(Boolean))
    ) as string[];
    const distinctTops = Array.from(
      new Set(variantsForAxes.map((v: any) => (v.top || "").trim()).filter(Boolean))
    ) as string[];
    const effectiveOpts = opts ? { ...opts } : opts;
    if (requiresBaseAndTopSelection && effectiveOpts) {
      if (!effectiveOpts.base && distinctBases.length === 1) effectiveOpts.base = distinctBases[0];
      if (!effectiveOpts.top && distinctTops.length === 1) effectiveOpts.top = distinctTops[0];
    }
    if (requiresBaseAndTopSelection && effectiveOpts && (!effectiveOpts.base || !effectiveOpts.top)) {
      // Partial Base/Top selections must not fall back to a standalone finish
      // key (e.g. clearing Top while Base remains). A clear/partial state
      // should show the primary product image until a complete pairing is set.
      // Exception: when the change was triggered by a swatch click, the
      // FinishSelector is the source of truth for the image (via image_indices
      // or, when empty, the current gallery image) — don't snap to picture 1.
      if (!opts?.fromSwatch) {
        setGalleryActiveIndex(0);
        setGalleryJumpNonce((n) => n + 1);
      }
      return;
    }
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

  const handleResetDefaultPair = () => {
    if (!defaultPair) return;
    setSelectedBase(defaultPair.base);
    setSelectedTop(defaultPair.top);
    setSelectedDualSize(null);
    handleMaterialChange(defaultPair.base, { base: defaultPair.base, top: defaultPair.top, size: null });
  };

  // Single atomic reset for dual-axis selectors. Wipes Base/Top/Size in one
  // React batch and notifies the gallery resolver with an explicit cleared
  // payload so dropdowns and gallery never get out of sync (e.g. a stale
  // "Sand Blaster" finish appearing while the hero shows the default image).
  const clearAllDualSelections = () => {
    setSelectedBase(null);
    setSelectedTop(null);
    setSelectedDualSize(null);
    handleMaterialChange(null, { base: null, top: null, size: null });
  };
  const isAtDefaultPair =
    !!defaultPair &&
    selectedBase === defaultPair.base &&
    selectedTop === defaultPair.top &&
    !selectedDualSize;

  const pageTitle = `${product.title}${product.subtitle ? ` ${product.subtitle}` : ""} by ${designerDisplay}`;

  // Trade pricing rendering — supports single-axis (label) and dual-axis (base × top).
  // Parsing/deduping logic is shared with PublicProductPage via computeVariantAxes.
  const productSizeVariants = Array.isArray((product as any).size_variants)
    ? ((product as any).size_variants as { label?: string; base?: string; top?: string; price_cents?: number }[])
        .filter((v) => v && (
          (typeof v.label === "string" && v.label.trim()) ||
          (typeof v.base === "string" && v.base.trim()) ||
          (typeof v.top === "string" && v.top.trim())
        ))
    : [];
  const sizeVariants = pricing?.size_variants || (productSizeVariants.length ? productSizeVariants : null);
  const isRugSqmActive =
    isRugCategory(product.category) &&
    !!(product as any)?.price_per_sqm_cents &&
    ((product as any).price_per_sqm_cents as number) > 0 &&
    ((sizeVariants?.length || 0) > 0);
  const axes = computeVariantAxes(sizeVariants);
  const {
    hasVariants,
    isDualAxis,
    isBaseOnly,
    baseOptions,
    topOptions,
    dualSizeOptions,
    singleAxisParsed,
    singleSizeOptions,
    singleMaterialOptions,
    hasSingleAxisSplit,
  } = axes;
  // Only ask the user to choose a size when there is a real choice. If every
  // dual-axis variant shares one size label, material selection alone should
  // resolve the priced row (e.g. Soleil: Oak vs Straw Marquetry at Ø85).
  const hasDualSize = dualSizeOptions.length > 1;
  const isOolMinibar = product.id === OOL_MINIBAR_PICK_ID;
  const dualVariant = isDualAxis
    ? sizeVariants!.find((v) =>
        (v.base || "").trim() === (selectedBase || "") &&
        (v.top || "").trim() === (selectedTop || "") &&
        (!hasDualSize || (v.label || "").trim() === (selectedDualSize || ""))
      )
    : null;
  // When the Label axis holds a finish (e.g. wood "Oak") rather than a size,
  // dimensions come from the row's own `dimensions` field or the product.
  const dualLabelIsDim = dualSizeOptions.length > 0 && dualSizeOptions.every((s: string) => looksLikeDimension(s));
  const dualRowDims: string | null =
    ((dualVariant as any)?.dimensions ||
      ((sizeVariants || []).find((v: any) => v?.dimensions) as any)?.dimensions ||
      product?.dimensions ||
      null);

  const singleAxisActive = hasSingleAxisSplit
    ? singleAxisParsed.find((p) =>
        p.size === (selectedSingleSize || "") &&
        p.material === (selectedSingleMaterial || "")
      )?.variant ?? null
    : null;

  // Model dimensions shown inside the Quote & Order Workspace drawers —
  // mirrors the main page's dimension row and follows the selected size variant.
  const drawerDimensionsLabel = formatDrawerDimensions(
    (dualVariant as any)?.label ||
      (singleAxisActive as any)?.label ||
      selectedDualSize ||
      selectedSingleSize ||
      product?.dimensions ||
      null,
    product?.dimensions || null,
  );

  // Cross-axis availability: when a material is picked, disable sizes that
  // don't exist for that material (and vice versa). Keeps both dropdowns
  // honest about what combinations are actually offered.
  const disabledMaterialIndices = hasSingleAxisSplit && selectedSingleSize
    ? singleMaterialOptions
        .map((m, i) => (singleAxisParsed.some((p) => p.material === m && p.size === selectedSingleSize) ? -1 : i))
        .filter((i) => i >= 0)
    : [];
  const disabledSizeIndices = hasSingleAxisSplit && selectedSingleMaterial
    ? singleSizeOptions
        .map((s, i) => (singleAxisParsed.some((p) => p.size === s && p.material === selectedSingleMaterial) ? -1 : i))
        .filter((i) => i >= 0)
    : [];

  // Dual-axis: cross-disable base × top × size based on existing variants.
  const variantsList = sizeVariants || [];
  const matchesDual = (v: any, b: string | null, t: string | null, s: string | null) =>
    (b == null || (v.base || "").trim() === b) &&
    (t == null || (v.top || "").trim() === t) &&
    (s == null || (v.label || "").trim() === s);
  // Pictured finishes: when the user hasn't picked anything, the finish
  // selector highlights the finishes shown in the current gallery photo.
  // Price the page for THAT pairing instead of the cheapest "From" rate.
  const matchAxisOption = (name: string | null, options: string[]): string | null => {
    if (!name) return null;
    const norm = (s: string) => s.trim().toLowerCase();
    const nw = norm(name);
    return options.find((o) => norm(o) === nw)
      || options.find((o) => nw.includes(norm(o)))
      || options.find((o) => norm(o).includes(nw))
      || null;
  };
  // Only disable an axis option when NO variant exists for it given the size
  // selection. We intentionally do NOT cross-disable base ↔ top: picking the
  // other base should be allowed and will auto-swap the top to a compatible
  // pairing (handled in onChange below). Otherwise users have to "Clear
  // selection" every time they want to switch colorway.
  const disabledBaseIdx = isDualAxis && selectedDualSize
    ? baseOptions.map((b, i) => (variantsList.some((v: any) => matchesDual(v, b, null, selectedDualSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledTopIdx = isDualAxis && selectedDualSize
    ? topOptions.map((t, i) => (variantsList.some((v: any) => matchesDual(v, null, t, selectedDualSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledDualSizeIdx = isDualAxis && (selectedBase || selectedTop)
    ? dualSizeOptions.map((s, i) => (variantsList.some((v: any) => matchesDual(v, selectedBase, selectedTop, s)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  // If an explicit axis label is provided, trust it. Only auto-detect from
  // option strings when no label was set — otherwise things like
  // "ECART fabric (6 m)" get misread as dimensions.
  const baseAxisLabelRaw = ((product as any).base_axis_label || "").trim();
  const topAxisLabelRaw = ((product as any).top_axis_label || "").trim();
  const baseAxisIsDim = baseAxisLabelRaw
    ? isDimensionAxisLabel(baseAxisLabelRaw)
    : (baseOptions.length > 0 && baseOptions.every(looksLikeDimension));
  const topAxisIsDim = topAxisLabelRaw
    ? isDimensionAxisLabel(topAxisLabelRaw)
    : (topOptions.length > 0 && topOptions.every(looksLikeDimension));
  const baseOnlySizeOptions = isBaseOnly
    ? Array.from(new Set(
        ((sizeVariants || []) as Array<{ label?: string | null }>)
          .map((v) => (v.label || "").trim())
          .filter(Boolean),
      ))
    : [];
  const baseOnlyRequiresSize = isBaseOnly && !baseAxisIsDim && baseOnlySizeOptions.length > 1;

  // `activeVariant` is hoisted above `handleAddToQuote` (top of component) so
  // both the caption and the quote flow read from the same resolver.

  const isUpholsteredProduct = isProductUpholstered(product as any);
  // When FinishSelector is shown (upholstered), it already exposes fabric
  // + wood-finish swatches. Suppress duplicate base/top variant dropdowns
  // whose axis label is a finish/frame/wood concept already covered there.
  const isFinishAxisLabel = (label: string) =>
    /\b(frame|wood|finish|feet|foot|leg|legs|base)\b/i.test(label);
  // Only suppress the Base dropdown when every base option is also offered as
  // a wood swatch in FinishSelector — otherwise the user has no way to pick
  // bases that lack a swatch (e.g. Walnut, Thermo-treated wood).
  const normFinish = (s: string) => (s || "").trim().toLowerCase();
  const allBasesHaveSwatches =
    everyOptionCoveredBySwatches(baseOptions, linkedWoodFinishes);
  // When FinishSelector is present and exposes wood swatches, treat it as the
  // single source for the frame-finish axis — suppress the duplicate base
  // dropdown even if not every base option has a perfectly-matching swatch.
  const hasWoodSwatches = linkedWoodFinishes.length > 0;
  // Top-axis swatches are present when any linked finish matches a top option.
  const topAxisHasSwatches = !topAxisIsDim && topOptions.length > 0 && topOptions.some((t) => {
    const nt = normFinish(t);
    return linkedWoodFinishes.some((lw) => {
      const nlw = normFinish(lw);
      return nlw === nt || nlw.includes(nt) || nt.includes(nlw);
    });
  });
  const suppressBaseAsFinish = !baseAxisIsDim && (isFinishAxisLabel(baseAxisLabelRaw) || !baseAxisLabelRaw) && (allBasesHaveSwatches || (!isBaseOnly && hasWoodSwatches));
  const suppressTopAsFinish = !topAxisIsDim && (topAxisHasSwatches || (isUpholsteredProduct && isFinishAxisLabel(topAxisLabelRaw)) || (hasWoodSwatches && isFinishAxisLabel(topAxisLabelRaw)));

  // When the product has variants but the user hasn't picked one yet, fall back
  // to the cheapest *priced* variant so we can show "From €X" instead of "Price upon Request".
  // Variants without a price (price_cents = 0 → "Price upon Request" finishes) are skipped here.
  const pricedVariantCents = hasVariants && sizeVariants
    ? sizeVariants.map((v) => v.price_cents).filter((c): c is number => typeof c === "number" && c > 0)
    : [];
  const minVariantCents = pricedVariantCents.length > 0 ? Math.min(...pricedVariantCents) : null;
  // If the user has actively selected a Base/Top/Size in a dual-axis product
  // but no priced variant matches that combination (e.g. a linked swatch like
  // "Ceppo di Sicilia" that hasn't been quoted yet), do NOT fall back to the
  // cheapest "From €X" — show "Price upon Request" instead so the UI matches
  // the selection.
  const dualSelectionMade = isDualAxis && !!(selectedBase || selectedTop || selectedDualSize);
  // Cheapest priced variant matching the user's partial dual-axis selection.
  // Lets us keep showing "From €X" once they pick just a Finish or just a Size,
  // instead of falling all the way back to "Price upon Request".
  const partialDualMinCents = resolvePartialDualMinCents(
    { selectedBase, selectedTop, selectedDualSize },
    { sizeVariants: variantsList, isDualAxis },
  );
  const dualSelectionUnpriced = dualSelectionMade && (!dualVariant || !(typeof dualVariant.price_cents === "number" && dualVariant.price_cents > 0)) && partialDualMinCents == null;
  // Pictured finishes: when the user hasn't picked anything, the finish
  // selector highlights the finishes shown in the current gallery photo.
  // Price the page for THAT pairing instead of the cheapest "From" rate.
  const picturedVariant = (!activeVariant && !dualSelectionMade && isDualAxis)
    ? (() => {
        const b = matchAxisOption(displayedFinishes.base, baseOptions);
        const t = matchAxisOption(displayedFinishes.top, topOptions);
        if (!b && !t) return null;
        return variantsList.find((v: any) => matchesDual(v, b, t, null)) ?? null;
      })()
    : null;
  const picturedVariantCents = picturedVariant && typeof picturedVariant.price_cents === "number" && picturedVariant.price_cents > 0
    ? picturedVariant.price_cents
    : null;
  // Catalogue rate on the product itself. Many pieces carry finish options that
  // do not change the price (every variant is price_cents = 0) — those must
  // still show the catalogue rate rather than "Price upon Request".
  // NOTE: when the catalogue only stores a NET trade price (no RRP), gross it
  // back up to the retail base — priceLabels applies the tier discount once on
  // top of this value, so feeding it a net figure would discount it twice.
  const catalogueRrpCents = (() => {
    const rrp = pricing?.rrp_price_cents ?? null;
    if (rrp && rrp > 0) return rrp;
    const net = pricing?.trade_price_cents ?? null;
    if (net && net > 0) {
      const factor = 1 - (TRADE_DISCOUNT ?? 0);
      return factor > 0 ? Math.round(net / factor) : net;
    }
    return null;
  })();
  const variantsCarryNoPrice = hasVariants && minVariantCents == null;
  const effectiveRrpCents = hasVariants
    ? (variantsCarryNoPrice
      ? catalogueRrpCents
      : (activeVariant
        ? (typeof activeVariant.price_cents === "number" && activeVariant.price_cents > 0 ? activeVariant.price_cents : catalogueRrpCents)
        : (dualSelectionUnpriced ? catalogueRrpCents : (picturedVariantCents ?? partialDualMinCents ?? minVariantCents))))
    : catalogueRrpCents;
  const isFromPrice = hasVariants && !variantsCarryNoPrice && !activeVariant && !dualSelectionUnpriced && picturedVariantCents == null && effectiveRrpCents != null;


  // Per-meter fabric upcharge in the product's currency. We always charge the
  // active variant's meters when present (e.g. 3.5 m for outdoor frames vs
  // 6 m for indoor) and fall back to the pick-level com_meters default.
  const fabricMeters =
    (activeVariant && typeof (activeVariant as any).meters === "number" ? (activeVariant as any).meters : null)
    ?? (product as any).com_meters
    ?? null;
  const fabricUpchargeCentsRaw =
    selectedFabric?.price_per_lm_cents && fabricMeters
      ? Math.round(selectedFabric.price_per_lm_cents * fabricMeters)
      : 0;

  /**
   * Catalogue (RRP) rate for the CURRENT selection, in the product currency.
   * The tier discount is applied once, server-side, at checkout — the cart
   * always carries the retail rate so both surfaces reconcile.
   */
  const currentRrpCents = (): number => {
    if (!pricing || !effectiveRrpCents) return 0;
    let rrp = effectiveRrpCents;
    if (selectedWoodPrice?.price_cents && selectedWoodPrice.price_cents > 0) {
      rrp = selectedWoodPrice.currency === pricing.currency
        ? selectedWoodPrice.price_cents
        : convertCents(selectedWoodPrice.price_cents, selectedWoodPrice.currency, pricing.currency as DisplayCurrency, fxRates);
    }
    let upcharge = 0;
    if (fabricUpchargeCentsRaw > 0) {
      const fromCcy = selectedFabric?.currency || pricing.currency;
      upcharge = fromCcy === pricing.currency
        ? fabricUpchargeCentsRaw
        : convertCents(fabricUpchargeCentsRaw, fromCcy, pricing.currency as DisplayCurrency, fxRates);
    }
    return rrp + upcharge;
  };

  /** Direct order — writes the configured piece into the shared cart. */
  const handleProceedToOrder = (orderQuantity = quantity, persistOnly = false) => {
    const unit = currentRrpCents();
    if (!unit) {
      toast({ title: "Price upon Request", description: "Our concierge will confirm the rate for this configuration." });
      return false;
    }
    const finishLabel = [selectedBase, selectedTop, selectedDualSize, selectedSingleSize, selectedFabric?.name]
      .filter(Boolean).map(String).join(" · ") || null;
    // Carry the price in the currency the user is actually looking at, and
    // keep the original rate + FX factor on the line so the cart can show
    // exactly what was converted and at which rate.
    const srcCcy = (pricing?.currency || "USD").toUpperCase();
    const tgtCcy = displayCurrency === "original" ? srcCcy : displayCurrency;
    const converted = convertCents(unit, srcCcy, tgtCcy as DisplayCurrency, fxRates);
    const didConvert = tgtCcy !== srcCcy && converted !== unit;

    addToCart({
      pickId: product.id,
      productSlug: product.slug || slugify(product.title),
      designerSlug: designer.slug || slugify(designer.name),
      title: product.title,
      designerName: designerDisplay,
      finishLabel,
      finishSwatches: felixSelectionRef.current?.finishes?.filter((finish) => !!finish.imageUrl).map((finish) => ({ name: finish.name, image_url: finish.imageUrl || "" })),
      variant: { base: selectedBase, top: selectedTop, size: selectedDualSize || selectedSingleSize },
      imageUrl: product.image_url || null,
      leadTime: product.lead_time || null,
      unitPriceCents: converted,
      netUnitPriceCents: (() => {
        const rawUpcharge = fabricUpchargeCentsRaw > 0 ? convertCents(fabricUpchargeCentsRaw, selectedFabric?.currency || srcCcy, srcCcy as DisplayCurrency, fxRates) : 0;
        return convertCents(configuredProductPrice(unit - rawUpcharge, rawUpcharge, TRADE_DISCOUNT).netCents, srcCcy, tgtCcy as DisplayCurrency, fxRates);
      })(),
      currency: tgtCcy,
      quantity: orderQuantity,
      sourceCurrency: didConvert ? srcCcy : null,
      sourceUnitPriceCents: didConvert ? unit : null,
      fxRate: didConvert ? fxRates[`${srcCcy}_${tgtCcy}`] ?? converted / unit : null,
      origin: product.origin,
    });
    if (!persistOnly) navigate("/cart");
    return true;
  };

  /**
   * Shared price maths for both the headline price line and the boxed action
   * panel, so the trade catalogue sheet reads exactly like the designer-side
   * trade sheet (net trade price + struck retail).
   */
  const priceLabels = (() => {
    if (!pricing || !effectiveRrpCents) return null;
    // When a wood-finish swatch carries a frame-price override, it becomes
    // the RRP base; otherwise fall back to the size_variants base.
    let rrp = effectiveRrpCents;
    if (selectedWoodPrice?.price_cents && selectedWoodPrice.price_cents > 0) {
      rrp = selectedWoodPrice.currency === pricing.currency
        ? selectedWoodPrice.price_cents
        : convertCents(selectedWoodPrice.price_cents, selectedWoodPrice.currency, pricing.currency as DisplayCurrency, fxRates);
    }
    // Add the fabric per-LM upcharge on top. The upcharge sits in the fabric's
    // currency; convert to the product currency when they differ.
    let upcharge = 0;
    if (fabricUpchargeCentsRaw > 0) {
      const fromCcy = selectedFabric?.currency || pricing.currency;
      upcharge = fromCcy === pricing.currency
        ? fabricUpchargeCentsRaw
        : convertCents(fabricUpchargeCentsRaw, fromCcy, pricing.currency as DisplayCurrency, fxRates);
    }
    const { retailCents, netCents } = configuredProductPrice(rrp, upcharge, TRADE_DISCOUNT);
    // Once the user has made a concrete fabric or wood-frame selection, the
    // price is fully resolved — never show "From".
    const hasConcreteSelection = !!selectedFabric || !!selectedWoodPrice || !!activeVariant || !!picturedVariant;
    const explicitPrefix = pricing.price_prefix && !hasConcreteSelection ? `${pricing.price_prefix} ` : "";
    const prefix = explicitPrefix || (isFromPrice && !hasConcreteSelection ? "From " : "");
    const unit = pricing.price_unit || undefined;
    return {
      prefix,
      upcharge,
      retailCents,
      netCents,
      currency: pricing.currency as string,
      netLabel: formatPriceConverted(netCents, pricing.currency, displayCurrency, fxRates, unit),
      clientLabel: formatPriceConverted(clientMultiplier === 1 ? retailCents : Math.round(netCents * clientMultiplier), pricing.currency, displayCurrency, fxRates, unit),
      retailLabel: formatPriceConverted(retailCents, pricing.currency, displayCurrency, fxRates, unit),
    };
  })();

  // Same render snapshot as the headline; captured before the asynchronous add.
  const felixSectionLabels = resolveFinishSectionLabels({
    baseAxisLabel: product.base_axis_label, topAxisLabel: product.top_axis_label,
    baseAxisIsDimension: baseAxisIsDim, isUpholstered: isProductUpholstered(product as any),
    woodLabelOverride: product.wood_label_override,
  });
  drawerPricesRef.current = { retailLabel: priceLabels?.retailLabel ?? null, netLabel: priceLabels?.netLabel ?? null };
  const felixBaseSwatch = findQuoteFinishSwatch([selectedWoodPrice?.name, selectedBaseDisplay, displayedFinishes.base, selectedBase], felixLinkedSwatches);
  const felixPicturedSwatches = felixLinkedSwatches.filter((swatch) => swatch.image_indices?.includes((galleryActiveIndex ?? 0) + 1));
  const felixTopSwatch = findQuoteFinishSwatch([selectedFabric?.name, selectedTopSwatch?.name, selectedTopDisplay, displayedFinishes.top, selectedTop, selectedSwatchGalleryName], felixLinkedSwatches)
    ?? felixPicturedSwatches.find((swatch) => selectedTop && swatch.name.toLowerCase().startsWith(selectedTop.replace(/\s+range$/i, "").toLowerCase() + " -"));
  felixSelectionRef.current = {
    productId: product.id,
    productName: product.title,
    brandName: designerDisplay,
    // Historical snapshot of the explicitly selected photo (lockedItem.savedImageField);
    // hover previews never reach the locked Felix card.
    imageUrl: permanentlySelectedImage || null,
    savedImageField: permanentlySelectedImage || null,
    fabricLabel: selectedFabric?.name ?? null,
    baseLabel: selectedWoodPrice?.name ?? selectedBase ?? null,
    topLabel: selectedTopSwatch?.name ?? selectedTop ?? null,
    finishes: selectorQuoteFinishes?.pickId === product.id && (selectorQuoteFinishes.finishes.length > 0 || felixLinkedSwatches.length > 0) ? selectorQuoteFinishes.finishes : [
      selectedFabric && { label: felixFinishLabel(felixSectionLabels.upholsteryLabel, "Upholstery Fabric"), name: selectedFabric.name, imageUrl: selectedFabric.image_url || felixTopSwatch?.image_url },
      (selectedWoodPrice?.name || selectedBase) && { label: felixFinishLabel(selectedWoodPrice ? felixSectionLabels.woodLabel : getBasePlaceholder(product), "Frame Finish"), name: selectedWoodPrice?.name || selectedBaseDisplay || selectedBase || "", imageUrl: selectedWoodPrice?.image_url || felixBaseSwatch?.image_url },
      !selectedFabric && (selectedTopSwatch?.name || selectedTop) && { label: felixFinishLabel(getTopPlaceholder(product), "Top Finish"), name: selectedTopSwatch?.name || selectedTopDisplay || felixTopSwatch?.name || selectedTop || "", imageUrl: selectedTopSwatch?.image_url || felixTopSwatch?.image_url },
    ].filter((finish): finish is { label: string; name: string; imageUrl: string | null | undefined } => !!finish),
    tradePriceLabel: priceLabels?.netLabel ?? null,
    unitPriceCents: priceLabels ? convertCents(priceLabels.netCents, priceLabels.currency, displayCurrency, fxRates) : null,
    priceCurrency: displayCurrency === "original" ? priceLabels?.currency ?? pricing?.currency ?? "EUR" : displayCurrency,
    quantity,
    leadTimeLabel: product.lead_time,
  };

  const renderPrice = () => {
    if (!priceLabels) return null;
    const { prefix, netLabel, retailLabel, upcharge } = priceLabels;


    return (
      <div>
        <PresentationModeToggle />
        {/* Headline price — identical to the designer-side trade sheet:
            net trade price with the struck retail rate underneath. */}
          {!showTradePrice ? <RetailPrice label={`${prefix}${retailLabel}`} /> : <p data-trade-sensitive className="font-body font-light text-base md:text-lg tabular-nums tracking-[0.01em]">
          {prefix && (
            <span className="text-muted-foreground text-[11px] uppercase tracking-[0.22em] align-middle mr-2">
              {prefix.trim()}
            </span>
          )}
           <span className="text-foreground align-middle">{showTradePrice ? netLabel : retailLabel}</span>
          <span className="ml-2 align-middle font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
             {showTradePrice ? "Net Trade Price" : "Retail Price"}
          </span>
        </p>}
         {showTradePrice && <span data-client-placeholder aria-hidden="true" className="h-5 w-28 animate-pulse bg-muted/60" />}
         {showTradePrice && retailLabel && (
           <p data-trade-sensitive className="mt-1 font-body text-[11px] tracking-[0.04em] text-muted-foreground">
            <span className="line-through decoration-muted-foreground/50">Retail: {retailLabel}</span>
          </p>
        )}
        {(selectedWoodPrice || selectedFabric || (!selectedWoodPrice && !selectedFabric && (selectedTop || (isDualAxis && selectedBase && !baseAxisIsDim && !isFinishAxisLabel(baseAxisLabelRaw) ? false : selectedBase)))) && (
          <span className="block mt-2 font-body text-[10px] tracking-[0.06em] text-muted-foreground leading-snug">
            {selectedWoodPrice && (
              <>Frame: {selectedWoodPrice.name}</>
            )}
            {selectedWoodPrice && selectedFabric && " · "}
            {selectedFabric && (
              <>
                {selectedWoodPrice ? "Fabric: " : "Includes "}{selectedFabric.name}
               {showTradePrice && selectedFabric.tier ? ` (CAT ${selectedFabric.tier})` : ""}
               {showTradePrice && upcharge > 0 && (
                  <>
                    {" — "}
                    {formatPriceConverted(selectedFabric.price_per_lm_cents || 0, selectedFabric.currency, displayCurrency, fxRates)}/lm × {fabricMeters} m
                  </>
                )}
              </>
            )}
            {!selectedWoodPrice && !selectedFabric && (selectedTop || (isDualAxis && !baseAxisIsDim && selectedBase)) && (() => {
              const shrinkCap = (resolved: string | null, display: string | null) =>
                !resolved ? null
                : display && /\s\/\s/.test(resolved) && resolved.toLowerCase().includes(display.toLowerCase())
                  ? display
                  : resolved;
              const finishText = shrinkCap(selectedTop, selectedTopDisplay) || shrinkCap(selectedBase, selectedBaseDisplay);
              return <>Finish: {finishText}</>;
            })()}
          </span>
        )}
      </div>
    );

  };

  // Sample request deep-link to Procurement
  const sampleRequestUrl = `/trade/samples?product=${encodeURIComponent(product.title)}&brand=${encodeURIComponent(designerDisplay)}&productId=${encodeURIComponent(tradeProductId || product.id)}`;

  const resolve3d = () => {
    const norm = (v: string | null | undefined) => (v || "").trim().toLowerCase().replace(/\s+/g, " ");
    const av: any = activeVariant || {};
    const candidates = [av.label, selectedDualSize, selectedSingleSize, av.base, av.top, selectedBase, selectedTop, [av.base, av.top].filter(Boolean).join(" × ")]
      .map(norm).filter(Boolean);
    const byLabel = candidates.reduce<any>((hit, cand) => hit || glbVariants.find((v) => norm(v.variant_label) === cand) || null, null);
    const variant = byLabel || glbVariants.find((v) => v.is_default) || null;
    const url = variant?.glb_url || glbUrl || null;
    return url ? { url, roles: variant?.material_roles || undefined, label: byLabel?.variant_label as string | undefined } : null;
  };

  const renderLowerDetails = () => (
        <div className={isLg ? "flex flex-col gap-6" : "mt-16 flex flex-col gap-10 border-t border-border/50 pt-10"}>
          <div>
            {curatorNoteSections.length > 0 && (<section aria-label="Curator notes" className="hidden md:block">
              <h2 className="mb-3 font-display text-2xl italic text-foreground">Curator Notes</h2>
              {/* Product page: notes read vertically beneath the gallery; the lightbox uses a separate three-column treatment. */}
              <div className="grid grid-cols-1 gap-4">
                {curatorNoteSections.map(({ label, text, Icon }, noteIdx) => {
                  const isLead = noteIdx === 0;
                  return (
                    <article key={label} className={cn("group flex min-w-0 flex-col", isLead && "rounded-[2px] bg-muted px-4 py-2.5 border-l-2 border-l-accent")}>
                      <div
                        className={cn(
                          "mb-2 flex items-center justify-start gap-2"
                        )}
                      >

                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-colors duration-150 group-hover:text-foreground",
                            isLead ? "text-accent" : "text-muted-foreground/60"
                          )}
                          strokeWidth={1.25}
                        />
                        <h3
                          className={cn(
                            "font-body text-[10px] uppercase tracking-[0.2em] text-foreground",
                            isLead && "font-bold"
                          )}
                        >
                          {label}
                        </h3>
                      </div>
                      <p className="font-body text-sm italic leading-relaxed text-justify text-muted-foreground">
                        {text}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>)}
          </div>
          <div className="flex flex-col gap-4">
            {/* CAD / 3D file downloads (trade-gated; only renders when files exist) */}
            <CadAssetsSection productId={tradeProductId} productName={product.title} />


            {/* Inline subtle nudge: Sample Requests live in Procurement */}
            <p className="font-body text-[11px] text-muted-foreground text-center">
              Need a material sample?{" "}
              <Link
                to={sampleRequestUrl}
                className="underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Request via Procurement →
              </Link>
            </p>

            {/* Origin only — lead time lives exclusively in the pricing block. */}
            <div className="flex flex-col gap-2">
              {(() => {
                const handcrafted = formatHandcrafted(showTradePrice ? product.origin : null, null);
                if (!handcrafted) return null;
                return (
                  <div className="-mt-4 border-b border-border/60 py-4 flex items-start gap-5">
                    {specIcon("✦", "mt-0.5")}
                    <div className="font-body text-sm leading-relaxed text-muted-foreground font-normal">
                      <p>{handcrafted}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
  );

  const renderDesktopWorkspace = () => {
    const r3d = resolve3d();
    const asset: "3d" | number = workspaceAsset === "3d" && !r3d ? 0 : workspaceAsset;
    const photoIdx = typeof asset === "number" ? Math.min(asset, Math.max(0, visibleImages.length - 1)) : null;
    const hoverVisibleIdx = hoveredPreviewImage ? visibleImages.indexOf(hoveredPreviewImage) : -1;
    const stagePhotoIdx = hoverVisibleIdx >= 0 && !(asset === "3d" && viewer3dOpen) ? hoverVisibleIdx : photoIdx;
    const realIdx = (i: number) => (visibleImageIndices ? (visibleImageIndices[i] ?? i) : i);
    const live3d = asset === "3d" && !!r3d && viewer3dOpen;
    // Configuration carried by a photo: pictured finishes + the mapped variant (size).
    const configForPhoto = (i: number) => {
      const ri = realIdx(i);
      const fin = finishesForImage(ri);
      const variants = ((data?.pricing?.size_variants || (product as any)?.size_variants || []) as any[]);
      const v = findVariantForImageIndex(buildProductFinishMap((product as any)?.variant_image_map), variants, ri);
      const cur = parseDimensionString((activeVariant as any)?.label || selectedDualSize || selectedSingleSize || product.dimensions);
      const nxt = parseDimensionString(v?.label);
      let scale: string | null = null;
      let dimLabel: string | null = null;
      if (cur && nxt && cur.w && cur.d && cur.h) {
        const r = [nxt.w / cur.w, nxt.h / cur.h, nxt.d / cur.d];
        if (r.every((x) => x > 0.25 && x < 4) && r.some((x) => Math.abs(x - 1) > 0.01)) {
          scale = r.map((x) => x.toFixed(3)).join(" ");
        }
        dimLabel = `W ${Math.round(nxt.w / 10)} × D ${Math.round(nxt.d / 10)} cm`;
      }
      const baseName = fin.baseName || v?.base || null;
      const topName = fin.topName || v?.top || null;
      const parts = [dimLabel, baseName, topName].filter(Boolean) as string[];
      return { ri, fin, scale, label: parts.length ? parts.join(" · ") : `photo ${i + 1}` };
    };
    const hoverCfg = live3d && hoverPreviewIdx !== null ? configForPhoto(hoverPreviewIdx) : null;
    const lockPhoto = (i: number) => {
      // Locks the photo's configuration: the existing reverse sync snaps the
      // Base/Top/size dropdowns to the variant mapped to this photo.
      finishDrivenGalleryRef.current = false;
      const { fin } = configForPhoto(i);
      setSelectedWoodPrice(null);
      setSelectedTopSwatch(fin.topName ? { name: fin.topName, image_url: fin.top } : null);
      setSelectedFabric(null);
      setPicturedFinishImgs({ base: fin.base, top: fin.top });
      setGalleryActiveIndex(realIdx(i));
      setHoverPreviewIdx(null);
    };
    const thumbCls = (on: boolean) => cn(
      "relative shrink-0 h-16 w-16 xl:h-[80px] xl:w-[80px] 2xl:h-[88px] 2xl:w-[88px] overflow-hidden border bg-muted/40 transition-colors",
      on ? "border-foreground" : "border-border/60 hover:border-foreground/50",
    );
    return (
      <div className="flex min-w-0 flex-col" ref={galleryScrollRef}>
        <div className="flex min-w-0 items-stretch gap-3 xl:gap-4">
          <div className="relative w-16 xl:w-[80px] 2xl:w-[88px] shrink-0">
          <div className="absolute inset-0 flex flex-col gap-2 overflow-y-auto [scrollbar-width:none]" aria-label="Product views">
            {r3d && (
              <button type="button" aria-label="Show 3D model" aria-pressed={asset === "3d"} onClick={() => { setWorkspaceAsset("3d"); setHoverPreviewIdx(null); }} className={thumbCls(asset === "3d")}>
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-muted font-body text-[9px] uppercase tracking-[0.14em] text-foreground">
                  <Box size={16} className="text-accent" />3D
                </span>
              </button>
            )}
            {visibleImages.map((src, i) => (
              <button
                key={src + i}
                type="button"
                aria-label={`Show photo ${i + 1}`}
                aria-pressed={live3d ? (galleryActiveIndex ?? 0) === realIdx(i) : photoIdx === i}
                title={live3d ? "Hover to preview in 3D · click to apply" : undefined}
                onMouseEnter={() => live3d && setHoverPreviewIdx(i)}
                onMouseLeave={() => setHoverPreviewIdx((h) => (h === i ? null : h))}
                onFocus={() => live3d && setHoverPreviewIdx(i)}
                onBlur={() => setHoverPreviewIdx((h) => (h === i ? null : h))}
                onClick={() => { if (live3d) lockPhoto(i); else { setWorkspaceAsset(i); setGalleryActiveIndex(realIdx(i)); } }}
                className={cn(thumbCls(live3d ? (galleryActiveIndex ?? 0) === realIdx(i) : photoIdx === i), live3d && hoverPreviewIdx === i && "border-accent")}
              >
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          </div>
          <div className="relative flex aspect-[4/3] max-h-[calc(100vh-14rem)] min-w-0 flex-1 items-center justify-center overflow-hidden bg-muted/40">
            {asset === "3d" && r3d && (viewer3dOpen || hoverVisibleIdx < 0) ? (
              <div className="aspect-square h-full max-h-full max-w-full">
                <Product3DViewer
                  key={viewer3dKey}
                  autoOpen={viewer3dOpen}
                  url={r3d.url}
                  alt={`${product.title} — 3D model${r3d.label ? ` (${r3d.label})` : ""}`}
                  poster={product.image_url}
                  fabricTextureUrl={selectedFabric?.image_url || previewFabricImg || null}
                  baseTextureUrl={hoverCfg?.fin.base || selectedWoodPrice?.image_url || picturedFinishImgs.base || previewWoodImg || null}
                  topTextureUrl={hoverCfg?.fin.top || selectedTopSwatch?.image_url || picturedFinishImgs.top || null}
                  materialRoles={r3d.roles}
                  scale={hoverCfg?.scale || null}
                  onOpenedChange={setViewer3dOpen}
                />
              </div>
            ) : stagePhotoIdx !== null && visibleImages[stagePhotoIdx] ? (
              <img src={visibleImages[stagePhotoIdx]} alt={`${product.title} — photo ${stagePhotoIdx + 1}`} className="h-full w-full object-contain" />
            ) : null}
            {/* Fractional counter, lower-left — matches the public gallery. The 3D slide counts as 1. */}
            {(visibleImages.length + (r3d ? 1 : 0)) > 1 && (
              <div className="pointer-events-none absolute bottom-4 left-4 z-20">
                <span data-testid="gallery-counter" className="inline-block rounded-full bg-background/70 px-2.5 py-1 font-body text-[11px] font-light tracking-widest text-muted-foreground tabular-nums backdrop-blur-sm">
                  {asset === "3d" ? 1 : (photoIdx ?? 0) + 1 + (r3d ? 1 : 0)} / {visibleImages.length + (r3d ? 1 : 0)}
                </span>
              </div>
            )}
            {hoverCfg && (
              <div role="status" aria-live="polite" className="pointer-events-none absolute bottom-12 left-1/2 z-20 max-w-[85%] -translate-x-1/2 truncate rounded-full border border-border/60 bg-background/90 px-3.5 py-1.5 font-body text-[11px] tracking-[0.04em] text-foreground shadow-sm backdrop-blur-md motion-safe:animate-fade-in">
                Previewing {hoverCfg.label}
              </div>
            )}
            {live3d && (
              <button
                type="button"
                onClick={() => { setViewer3dOpen(false); setViewer3dKey((k) => k + 1); setWorkspaceAsset(visibleImageIndices ? Math.max(0, visibleImageIndices.indexOf(galleryActiveIndex ?? 0)) : (galleryActiveIndex ?? 0)); }}
                className="absolute left-3 top-14 z-10 flex h-9 items-center gap-1.5 rounded-full border border-border/40 bg-background/80 px-3 font-body text-[10px] uppercase tracking-[0.14em] text-foreground/80 backdrop-blur-md hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                Exit 3D
              </button>
            )}
            <div className={cn("absolute right-3 z-10 flex items-center gap-2", asset === "3d" ? "top-14" : "top-3")}>
              <button type="button" aria-label="Open full-screen gallery" title="Full screen" onClick={() => setFsStart(asset === "3d" ? 0 : (r3d ? 1 : 0) + (photoIdx ?? 0))} className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-background/80 text-foreground/80 backdrop-blur-md hover:text-foreground">
                <FsIcon className="h-4 w-4" strokeWidth={1.5} />
              </button>
              <TradeFavoriteFolderPicker productId={favoriteId} productName={product.title} align="end">
                  <button type="button" aria-label="Add to Project" className="flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-background/80 text-foreground/80 backdrop-blur-md">
                    <Heart className={cn("h-4 w-4", favorited && "fill-current")} strokeWidth={1.5} />
                  </button>
                </TradeFavoriteFolderPicker>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <PicturedFinishesStrip pickId={product.id} activeIndex={galleryActiveIndex ?? 0} baseLabel={product.base_axis_label} topLabel={product.top_axis_label} biekeLayout={designer.slug === "bieke-casteleyn"} />
        </div>
      </div>
    );
  };

  const fs3d = resolve3d();
  return (
    <div className="motion-safe:animate-fade-in">
      <ProductFullscreenGallery
        open={fsStart !== null}
        onClose={() => setFsStart(null)}
        startIndex={fsStart ?? 0}
        images={visibleImages}
        alt={product.title}
        render3d={fs3d ? () => (
          <Product3DViewer
            url={fs3d.url}
            alt={`${product.title} — 3D model`}
            poster={product.image_url}
            fabricTextureUrl={selectedFabric?.image_url || previewFabricImg || null}
            baseTextureUrl={selectedWoodPrice?.image_url || picturedFinishImgs.base || previewWoodImg || null}
            topTextureUrl={selectedTopSwatch?.image_url || picturedFinishImgs.top || null}
            materialRoles={fs3d.roles}
          />
        ) : null}
      />
      <Helmet>
        <title>{pageTitle} — Trade — Maison Affluency</title>
      </Helmet>

      <div className="w-full max-w-[1760px] pb-12 lg:pb-0">
        <button
          type="button"
          onClick={() => navigate(fromPath || fallbackPath)}
          className="mb-4 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />{" "}
          {fromPath && !fromPath.startsWith("/trade") ? "Back to product" : "Back"}
        </button>

        {/* Breadcrumbs route back to the Trade Gallery grid pre-filtered
            to the same category/subcategory, so users stay inside the
            trade portal instead of being sent to the public catalogue. */}
        <Breadcrumbs
          items={buildProductBreadcrumbs({
            root: { label: "Trade Gallery", to: "/trade/gallery" },
            category: product.category,
            subcategory: product.subcategory,
            title: product.title,
            buildCategoryHref: (cat, sub) => {
              const params = new URLSearchParams({ category: cat });
              if (sub) params.set("subcategory", sub);
              return `/trade/gallery?${params.toString()}`;
            },
          })}
          className="mb-6"
        />

        <div ref={masterRef} className="grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:items-start gap-8 lg:gap-6 xl:gap-10 2xl:gap-14">
          {isLg ? (
            // Pinned media viewport: the whole left column (3D/photo stage,
            // pictured finishes, Curator Notes, technical details) stays
            // stuck to the viewport while the configuration drawer scrolls.
            // Overflowing notes scroll inside the pinned column itself.
            <div className="min-w-0 lg:sticky lg:top-24 lg:flex lg:h-[calc(100vh-12rem)] lg:flex-col lg:overflow-y-auto lg:[scrollbar-width:none]">
              {renderDesktopWorkspace()}
              <section aria-label="Curator notes and logistics" className="mt-7 border-t border-border/50 pt-5">
                {renderLowerDetails()}
              </section>
            </div>
          ) : (
          <div className="relative self-start bg-background" ref={galleryScrollRef}>
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

              firstImageBadge={null}
              overlay={
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Open full-screen gallery"
                    onClick={(e) => { e.stopPropagation(); setFsStart((resolve3d() ? 1 : 0) + (visibleActiveIndex ?? 0)); }}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25 text-foreground/80"
                  >
                    <FsIcon size={16} strokeWidth={1.5} />
                  </button>
                  {/* Description now reads as Curator Notes below the gallery,
                      matching the public product page. */}
                  <TradeFavoriteFolderPicker productId={favoriteId} productName={product.title} align="end">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        aria-label={favorited ? "Saved to favorites" : "Add to favorites"}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25"
                      >
                        <Heart size={18} strokeWidth={1.5} className={cn(favorited ? "fill-destructive text-destructive" : "text-foreground/80")} />
                      </button>
                    </TradeFavoriteFolderPicker>
                </div>
              }
              bottomRightOverlay={(() => {
                // Bridge filenames use the raw designer name, not the shortened display name.
                const shareUrl = buildPieceOgUrl(designer.name, product.title, product.subtitle);
                return (
                  <CornerTooltip label="Share" side="bottom" align="start">
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
            {/* Mobile/PWA: the "Shown in" caption lives on the presentation
                photography instead of stacking under the gallery. */}
            <PicturedFinishesStrip pickId={product.id} activeIndex={galleryActiveIndex ?? 0} baseLabel={product.base_axis_label} topLabel={product.top_axis_label} biekeLayout={designer.slug === "bieke-casteleyn"} />

            {/* Interactive 3D model — collapsed by default under the photo.
                The finish selectors in the right column act as its legend. */}
            {(() => {
              const norm = (s: string | null | undefined) =>
                (s || "").trim().toLowerCase().replace(/\s+/g, " ");
              const av: any = activeVariant || {};
              const candidates: string[] = [
                av.label,
                selectedDualSize,
                selectedSingleSize,
                av.base,
                av.top,
                selectedBase,
                selectedTop,
                [av.base, av.top].filter(Boolean).join(" × "),
              ]
                .map(norm)
                .filter(Boolean);
              const byLabel = candidates.reduce<
                { variant_label: string; glb_url: string; is_default: boolean; material_roles: Record<string, "fabric" | "base" | "top" | "ignore"> | null } | null
              >((hit, cand) => {
                if (hit) return hit;
                return (
                  glbVariants.find((v) => norm(v.variant_label) === cand) || null
                );
              }, null);
              const byDefault = glbVariants.find((v) => v.is_default);
              const resolvedVariant = byLabel || byDefault || null;
              const resolvedGlbUrl = resolvedVariant?.glb_url || glbUrl || null;
              if (!resolvedGlbUrl) return null;
              const resolvedRoles = resolvedVariant?.material_roles || undefined;
              return (
                <details open={viewer3dOpen} onToggle={(event) => setViewer3dOpen(event.currentTarget.open)} className="mt-6 group rounded-[2px] bg-muted border-l-2 border-l-accent">
                  <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none select-none border-b border-border/60">
                    <div className="flex items-center gap-2">
                      <Box size={14} className="text-accent" />
                      <span className="font-display text-base leading-none text-foreground">Configure in 3D</span>
                      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground ml-2">
                        Live preview · rotate · AR
                      </span>
                    </div>
                    <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground group-open:hidden">
                      Open ▾
                    </span>
                    <span className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground hidden group-open:inline">
                      Close ▴
                    </span>
                  </summary>
                  <div className="p-3">
                    <Product3DViewer
                      autoOpen={viewer3dOpen}
                      url={resolvedGlbUrl}
                      alt={`${product.title} — 3D model${byLabel ? ` (${byLabel.variant_label})` : ""}`}
                      poster={product.image_url}
                      fabricTextureUrl={selectedFabric?.image_url || previewFabricImg || null}
                      baseTextureUrl={selectedWoodPrice?.image_url || picturedFinishImgs.base || previewWoodImg || null}
                      topTextureUrl={selectedTopSwatch?.image_url || picturedFinishImgs.top || null}
                      materialRoles={resolvedRoles || undefined}
                    />
                  </div>
                </details>
              );
            })()}

          </div>
          )}

          <div className="relative flex flex-col gap-4 lg:min-w-0">
            <div className="flex items-start justify-between gap-3 order-[-4] md:order-none">
              <div className="min-w-0">
                <Link
                  to={designer.slug ? `/trade/gallery/${designer.slug}` : fallbackPath}
                  onClick={() => {
                    if (designer.slug) rememberProductBackRef(designer.slug, location.pathname + location.search);
                  }}
                  className="font-body text-[12px] uppercase tracking-[0.18em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                   {showTradePrice ? designerDisplay : "Curated Collection"}
                </Link>
                <ProductTitleBlock
                  title={product.title}
                  subtitleLine={formatProductSubtitleLine(product.title, product.subtitle)}
                  product={product}
                  isEcartProduct={isEcartProduct}
                  showBadge={showTradePrice}
                />
              </div>
              <div className="shrink-0 mt-1 flex items-center gap-2">
                <span className="font-body text-[11px] text-muted-foreground" title="Contract baseline currency">EUR</span>
              </div>
            </div>


            {/* Headline trade price — sits above the finish selectors on
                desktop, exactly like the designer-side trade sheet. */}
            {effectiveRrpCents ? (
              <div className="order-[-3] md:order-none">{renderPrice()}</div>
            ) : (
              <p className="font-body text-sm text-muted-foreground italic order-[-3] md:order-none">
                Price upon Request
              </p>
            )}

            {/* Collection description — directly below the price */}
            <div className="order-[-2] md:order-none">
              {product.materials_description?.trim() && (isRugCategory(product.category) || (!hasLinkedFabrics && linkedWoodFinishes.length === 0)) && (
                <LegendDisclosure
                  icon={specIcon("⬗")}
                  text={product.materials_description.trim()}
                />
              )}
            </div>

            {/* Finish selection — mobile: directly under the photography */}

            <div className="flex flex-col gap-2 order-[-5] md:order-none">
              {!isOolMinibar && isDualAxis && !baseAxisIsDim && !topAxisIsDim && resolve3d() && (
                <ProductFinishCombinations pickId={product.id} variants={variantsList} size={selectedDualSize}
                  base={selectedBase} top={selectedTop}
                  onSelect={(combination) => {
                    setSelectedBase(combination.base);
                    setSelectedTop(combination.top);
                    setSelectedWoodPrice(null);
                    setSelectedFabric(null);
                    setSelectedTopSwatch({ name: combination.top, image_url: combination.topTextureUrl });
                    setPicturedFinishImgs({ base: combination.baseTextureUrl, top: combination.topTextureUrl });
                    setWorkspaceAsset("3d");
                    setViewer3dOpen(true);
                    handleMaterialChange(combination.base, { base: combination.base, top: combination.top, size: selectedDualSize });
                  }} />
              )}
              <FinishSelector
                  pickId={product.id}
                  photoLedFinishes
                  onQuoteFinishesChange={(finishes) => setSelectorQuoteFinishes({ pickId: product.id, finishes })}
                  frameOptions={isOolMinibar ? dualSizeOptions : undefined}
                  onFrameFinishChange={isOolMinibar ? (frame) => {
                    setSelectedDualSize(frame);
                    handleMaterialChange(frame, { base: selectedBase, top: selectedTop, size: frame, fromSwatch: true });
                  } : undefined}
                  axisBaseLabel={product.base_axis_label ? getBasePlaceholder({ base_axis_label: product.base_axis_label }) : null}
                  baseAxisOptions={isDualAxis && !baseAxisIsDim ? baseOptions : undefined}
                  topAxisOptions={isDualAxis && !topAxisIsDim ? topOptions : undefined}
                  disabledBaseOptions={viewer3dOpen ? [] : disabledBaseIdx.map((i) => baseOptions[i])}
                  disabledTopOptions={viewer3dOpen ? [] : disabledTopIdx.map((i) => topOptions[i])}
                  productTitle={product.title}
                  productCategory={product.category}
                  currentGalleryIndex={galleryActiveIndex ?? 0}
                  onDisplayedFinishesChange={(n) => setDisplayedFinishes({ base: n.base, top: n.top })}
                  preselectFabricName={requestedFabricName}
                  upholsteryLabel={
                    resolveFinishSectionLabels({
                      baseAxisLabel: product.base_axis_label,
                      topAxisLabel: product.top_axis_label,
                      baseAxisIsDimension: baseAxisIsDim,
                      isUpholstered: isProductUpholstered(product as any),
                      woodLabelOverride: (product as any).wood_label_override,
                    }).upholsteryLabel
                  }
                  woodLabel={isBaseOnly && !suppressBaseAsFinish ? "Material Samples" : isOolMinibar ? getBasePlaceholder(product) :
                    resolveFinishSectionLabels({
                      baseAxisLabel: product.base_axis_label,
                      topAxisLabel: product.top_axis_label,
                      baseAxisIsDimension: baseAxisIsDim,
                      isUpholstered: isProductUpholstered(product as any),
                      woodLabelOverride: (product as any).wood_label_override,
                    }).woodLabel
                  }
                  woodFilter={
                    // Dual-axis: only show base swatches in the Base section
                    // so top-axis swatches don't bleed in. Token-aware so
                    // compound rows like "Travertino Rosso / Grey Saint
                    // Laurent / Picasso Green" don't hide the middle/trailing
                    // swatches in the picker (Alinea Angelo M regression).
                    isDualAxis && baseOptions.length >= 1
                      ? makeSwatchAxisFilter(baseOptions)
                      : undefined
                  }
                  topLabel={
                    product.top_axis_label
                      ? getTopPlaceholder({ top_axis_label: product.top_axis_label })
                      : null
                  }
                  topFilter={
                    isDualAxis && topOptions.length >= 1
                      ? makeSwatchAxisFilter(topOptions)
                      : undefined
                  }


                  onTopFinishChange={(topName) => {
                    if (!topName) { setSelectedTopDisplay(null); return; }
                    if (isOolMinibar) {
                      setSelectedTop(topName);
                      handleMaterialChange(topName, { base: selectedBase, top: topName, size: selectedDualSize, fromSwatch: true });
                      return;
                    }
                    const norm = (s: string) => s.trim().toLowerCase();
                    const nw = norm(topName);
                    const match =
                      topOptions.find((t) => norm(t) === nw)
                      || topOptions.find((t) => nw.includes(norm(t)))
                      || topOptions.find((t) => norm(t).includes(nw))
                      || topName;
                    setSelectedTop(match);
                    // Preserve the user-clicked swatch name when the variant
                    // groups several finishes under one slash-joined label.
                    setSelectedTopDisplay(match !== topName && /\s\/\s/.test(match) ? topName.trim() : null);
                    let nextBase = selectedBase;
                    if (nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, match, selectedDualSize))) {
                      setSelectedBase(null);
                      setSelectedBaseDisplay(null);
                      nextBase = null;
                    }
                    handleMaterialChange(match, { base: nextBase, top: match, size: selectedDualSize, fromSwatch: true });
                  }}
                  includePricing
                  showUpholsterySection={isUpholsteredProduct}
                  showWoodSection
                  hideBaseAccordion={isDualAxis && baseAxisIsDim}
                  onHasFabricsChange={handleHasFabricsChange}
                  onWoodFinishesAvailable={handleWoodFinishesAvailable}
                  onPreviewSwatchesResolved={handlePreviewSwatchesResolved}
                  onFinishesMissingImagesChange={setFinishesMissingImages}
                  onFinishGroupingResolved={() => setFinishGroupingPending(false)}
                  onFabricChange={setSelectedFabric}
                  onWoodFinishPricingChange={setSelectedWoodPrice}
                  onTopFinishSwatchChange={setSelectedTopSwatch}
                  onSwatchImagesChange={(indices, meta) => {
                    if (meta?.committed) {
                      setSelectedSwatchGalleryIndices(indices?.length ? indices : null);
                      setSelectedSwatchGalleryName(meta.swatchName || null);
                    }
                    // Hover writes only the preview pool (main viewport);
                    // clicks write the permanent pool that Felix snapshots.
                    const next = resolveSwatchImageEvent(indices, meta);
                    setHoveredPreviewIndex(next.hoveredPreviewIndex);
                    if (next.permanentIndex !== undefined) {
                      finishDrivenGalleryRef.current = true;
                      setHoverPreviewIdx(null);
                      setGalleryActiveIndex(next.permanentIndex);
                      setGalleryJumpNonce((n) => n + 1);
                    } else if (next.hoveredPreviewIndex !== null) {
                      setGalleryJumpNonce((n) => n + 1);
                    }
                  }}
                  onWoodFinishChange={(woodName) => {
                    if (!woodName) { setSelectedBaseDisplay(null); return; }
                    if (isOolMinibar) {
                      setSelectedBase("Wood");
                      handleMaterialChange("Wood", { base: "Wood", top: selectedTop, size: selectedDualSize, fromSwatch: true });
                      return;
                    }
                    // Match the swatch name to a Base axis value (case/space tolerant,
                    // and tolerant of code prefixes like "ECRT-SY-20 — Black Lacquered Sycamore").
                    const match = normalizeFinishOption(woodName, baseOptions);
                    setSelectedBase(match);
                    setSelectedBaseDisplay(match !== woodName && /\s\/\s/.test(match) ? woodName.trim() : null);
                    // If the current Top is incompatible with the new Base, clear it.
                    let nextTop = selectedTop;
                    if (nextTop && !variantsList.some((x: any) => matchesDual(x, match, nextTop, selectedDualSize))) {
                      setSelectedTop(null);
                      setSelectedTopDisplay(null);
                      nextTop = null;
                    }
                    handleMaterialChange(match, { base: match, top: nextTop, size: selectedDualSize, fromSwatch: true });
                  }}
                  onUpholsteryTierChange={(rawTier) => {

                    if (!rawTier) return;
                    const nt = rawTier.toLowerCase();
                    const candidates = topOptions.filter(
                      (t) => {
                        const lt = t.toLowerCase();
                        return lt === nt || lt.startsWith(nt) || nt.startsWith(lt) || lt.includes(nt) || nt.includes(lt);
                      },
                    );
                    if (candidates.length === 0) return;
                    const sized =
                      (selectedDualSize &&
                        candidates.find((t) =>
                          variantsList.some((x: any) => matchesDual(x, null, t, selectedDualSize)),
                        )) ||
                      candidates[0];
                    setSelectedTop(sized);
                    let nextBase = selectedBase;
                    if (selectedDualSize && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, sized, selectedDualSize))) {
                      setSelectedBase(null);
                      nextBase = null;
                    }
                    handleMaterialChange(sized, { base: nextBase, top: sized, size: selectedDualSize });
                  }}
                />


              {/* Material dropdown — when variants encode (size × material), bind it to selectedSingleMaterial */}
              {!isRugSqmActive && !isDualAxis && hasSingleAxisSplit && (
                <ExpandableSpec
                  icon={specIcon("⬗")}
                  text={singleMaterialOptions.join("\n")}
                  placeholder="Select your finish"
                  emphasized
                  value={selectedSingleMaterial != null ? Math.max(0, singleMaterialOptions.indexOf(selectedSingleMaterial)) : null}
                  onChange={(idx) => {
                    const newMat = singleMaterialOptions[idx] ?? null;
                    setSelectedSingleMaterial(newMat);
                    // Reset size if it isn't offered for the new material
                    let nextSize = selectedSingleSize;
                    if (newMat && nextSize && !singleAxisParsed.some((p) => p.material === newMat && p.size === nextSize)) {
                      setSelectedSingleSize(null);
                      nextSize = null;
                    }
                    // Use the matched variant's full raw label so the
                    // variant_image_map lookup (which keys on size+material)
                    // resolves to the right gallery image.
                    const match = newMat
                      ? singleAxisParsed.find((p) => p.material === newMat && (!nextSize || p.size === nextSize))
                      : null;
                    handleMaterialChange((match?.variant.label || newMat || null) as string | null);
                  }}

                  disabledIndices={disabledMaterialIndices}
                  helperText={
                    disabledMaterialIndices.length > 0 && selectedSingleSize
                      ? `Some materials aren't offered in ${selectedSingleSize} — greyed out.`
                      : undefined
                  }
                />
              )}
              {!isRugSqmActive && isBaseOnly && !baseAxisIsDim && !suppressBaseAsFinish && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension)) && (
                <ExpandableSpec
                  icon={specIcon(baseAxisIsDim ? "📐" : "⬗")}
                  text={withImperialPerLine(baseOptions.join("\n"))}
                  placeholder={product.wood_label_override || getBasePlaceholder(product)}
                  selectedValueLabel={product.wood_label_override?.replace(/^select\s+(?:your\s+|the\s+)?/i, "") || formatVariantAxisLabel(product.base_axis_label) || undefined}
                  singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
                  emphasized
                  value={selectedBase != null ? Math.max(0, baseOptions.indexOf(selectedBase)) : null}
                  onChange={(idx) => {
                    if (idx < 0) {
                      setSelectedBase(null);
                      handleMaterialChange(null, { base: null, top: null, size: null });
                      return;
                    }
                    const v = baseOptions[idx] ?? null;
                    setSelectedBase(v);
                    handleMaterialChange(v, { base: v, top: null, size: selectedDualSize });
                  }}
                />
              )}
              {!isRugSqmActive && !isDualAxis && !isBaseOnly && !hasSingleAxisSplit && !hasLinkedFabrics && linkedWoodFinishes.length === 0 && product.materials && (() => {
                const parsed = parseMaterialsFallback(product.materials);
                return (
                  <ExpandableSpec
                    icon={specIcon("⬗")}
                    text={product.materials}
                    placeholder="Select your finish"
                    autoSplit
                    autoDetectedHint
                    onChange={(idx) => handleMaterialChange(parsed[idx] ?? null)}
                  />
                );
              })()}
              {/* Dual-axis: Base × Top finish dropdowns */}
              {!isRugSqmActive && isDualAxis && (
                <>
                  {/* Dual-axis: always render Base picker so both axes are visible.
                      ExpandableSpec collapses single-option lists to a labeled row. */}
                  {!isOolMinibar && !baseAxisIsDim && !suppressBaseAsFinish && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension)) && (
                    <ExpandableSpec
                      icon={specIcon("⬗")}
                      text={withImperialPerLine(baseOptions.join("\n"))}
                      placeholder={getBasePlaceholder(product)}
                      singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
                      emphasized
                      value={selectedBase != null ? Math.max(0, baseOptions.indexOf(selectedBase)) : null}
                      onChange={(idx) => {
                        if (idx < 0) {
                          clearAllDualSelections();
                          return;
                        }
                        const v = baseOptions[idx] ?? null;
                        setSelectedBase(v);
                        let nextTop = selectedTop;
                        let nextSize = selectedDualSize;
                        if (v && nextTop && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelectedTop(null); nextTop = null; }
                        if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelectedDualSize(null); nextSize = null; }
                        if (v && !nextTop) {
                          const compatTops = topOptions.filter((t) => variantsList.some((x: any) => matchesDual(x, v, t, nextSize)));
                          if (compatTops.length === 1) { setSelectedTop(compatTops[0]); nextTop = compatTops[0]; }
                        }
                        handleMaterialChange(v, { base: v, top: nextTop, size: nextSize });
                      }}
                      disabledIndices={viewer3dOpen ? [] : disabledBaseIdx}
                      helperText={
                        disabledBaseIdx.length > 0 && (selectedTop || selectedDualSize)
                          ? `Some ${(getBasePlaceholder(product) || "base").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                          : undefined
                      }
                    />
                  )}
                  {/* Dual-axis: always render Top picker. */}
                  {!isOolMinibar && !suppressTopAsFinish && !(hasLinkedFabrics && !topAxisIsDim) && (
                  <ExpandableSpec

                    icon={specIcon(topAxisIsDim ? "📐" : "⬗")}
                    text={withImperialPerLine(topOptions.join("\n"))}
                    placeholder={getTopPlaceholder(product)}
                      singleValueLabel={formatVariantAxisLabel(product.top_axis_label) || undefined}
                    emphasized
                    value={selectedTop != null ? Math.max(0, topOptions.indexOf(selectedTop)) : null}
                    onChange={(idx) => {
                      if (idx < 0) {
                        clearAllDualSelections();
                        return;
                      }
                      const v = topOptions[idx] ?? null;
                      setSelectedTop(v);
                      let nextBase = selectedBase;
                      let nextSize = selectedDualSize;
                      if (v && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, v, nextSize))) { setSelectedBase(null); nextBase = null; }
                      if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, nextBase, v, nextSize))) { setSelectedDualSize(null); nextSize = null; }
                      if (v && !nextBase) {
                        const compatBases = baseOptions.filter((b) => variantsList.some((x: any) => matchesDual(x, b, v, nextSize)));
                        if (compatBases.length === 1) {
                          setSelectedBase(compatBases[0]);
                          nextBase = compatBases[0];
                        }
                      }
                      handleMaterialChange(v, { base: nextBase, top: v, size: nextSize });
                    }}
                    disabledIndices={viewer3dOpen && !topAxisIsDim ? [] : disabledTopIdx}
                    helperText={
                      disabledTopIdx.length > 0 && (selectedBase || selectedDualSize)
                        ? `Some ${(getTopPlaceholder(product) || "top").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                        : undefined
                    }
                  />
                  )}

                  {defaultPair && !isAtDefaultPair && (
                    <button
                      type="button"
                      onClick={handleResetDefaultPair}
                      className="self-start mt-1 ml-[26px] font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
                    >
                      Reset to default pairing
                    </button>
                  )}
                </>
              )}

              <AlsoContainsFinishes pickId={product.id} className="mt-1 pl-6" />
            </div>

            {/* Dimensions & size pickers — directly below the finish selectors */}
            <div className="flex flex-col gap-2">
              {(() => {
                const sqm = (product as any)?.price_per_sqm_cents as number | null | undefined;
                const isRugSqm = isRugCategory(product.category) && !!sqm && sqm > 0 && (sizeVariants?.length || 0) > 0;
                if (!isRugSqm) return null;
                return (
                  <RugSizeColourPicker
                    sizeVariants={sizeVariants as any}
                    pricePerSqmCents={sqm as number}
                    currency={pricing?.currency || (product as any).currency || "EUR"}
                    sizeAxisLabel={(product as any).base_axis_label}
                    colourAxisLabel={(product as any).top_axis_label}
                    onChange={setRugSelection}
                  />
                );
              })()}
              {!isRugSqmActive && isBaseOnly && !baseAxisIsDim && baseOnlySizeOptions.length > 1 && (
                <ExpandableSpec
                  icon={specIcon("📐")}
                  text={withImperialPerLine(baseOnlySizeOptions.join("\n"))}
                  secondaryText={null}
                  emphasized
                  placeholder="Select Your Size"
                  value={selectedDualSize != null ? Math.max(0, baseOnlySizeOptions.indexOf(selectedDualSize)) : null}
                  onChange={(idx) => {
                    if (idx < 0) {
                      setSelectedDualSize(null);
                      handleMaterialChange(null, { base: selectedBase, top: null, size: null });
                      return;
                    }
                    const s = baseOnlySizeOptions[idx] ?? null;
                    setSelectedDualSize(s);
                    let nextBase = selectedBase;
                    if (s && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, null, s))) {
                      setSelectedBase(null);
                      nextBase = null;
                    }
                    handleMaterialChange(s, { base: nextBase, top: null, size: s });
                  }}
                />
              )}
              {/* Base-only (finish) axis with fixed product dimensions: the
                  size row would otherwise never render, leaving the page
                  without any dimensions at all. */}
              {!isRugSqmActive && isBaseOnly && !baseAxisIsDim && baseOnlySizeOptions.length <= 1
                && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension))
                && product.dimensions && looksLikeDimension(product.dimensions) && (
                <ExpandableSpec icon={specIcon("📐")} text={withImperialStacked(product.dimensions)} />
              )}
              {/* Dual-axis with fixed (non-variant) dimensions: render dims at the top */}
              {!isRugSqmActive && isDualAxis && !baseAxisIsDim && !topAxisIsDim && (!hasDualSize || !dualLabelIsDim) && dualRowDims && looksLikeDimension(dualRowDims) && (
                <ExpandableSpec icon={specIcon("📐")} text={withImperialStacked(dualRowDims)} />
              )}
              {/* Single-axis split: dedicated size dropdown driven by unique sizes — shown FIRST */}
              {!isRugSqmActive && !isDualAxis && hasSingleAxisSplit && (
                <ExpandableSpec
                  icon={specIcon("📐")}
                  text={withImperialPerLine(singleSizeOptions.join("\n"))}
                  secondaryText={null}
                  emphasized
                  placeholder="Select Your Size"
                  value={selectedSingleSize != null ? Math.max(0, singleSizeOptions.indexOf(selectedSingleSize)) : null}
                  onChange={(idx) => {
                    const newSize = singleSizeOptions[idx] ?? null;
                    setSelectedSingleSize(newSize);
                    let nextMat = selectedSingleMaterial;
                    if (newSize && nextMat && !singleAxisParsed.some((p) => p.size === newSize && p.material === nextMat)) {
                      setSelectedSingleMaterial(null);
                      nextMat = null;
                    }
                    // Sync the gallery using the matched variant's full raw
                    // label so size+material combos map to the right image.
                    const match = newSize
                      ? singleAxisParsed.find((p) => p.size === newSize && (!nextMat || p.material === nextMat))
                      : null;
                    handleMaterialChange((match?.variant.label || nextMat || null) as string | null);
                  }}

                  disabledIndices={disabledSizeIndices}
                  helperText={
                    disabledSizeIndices.length > 0 && selectedSingleMaterial
                      ? `Some sizes aren't available in ${selectedSingleMaterial} — greyed out.`
                      : undefined
                  }
                />
              )}
              {/* Single-axis (no material split): show stripped size labels indexed by variant */}
              {!isRugSqmActive && product.dimensions && !isDualAxis && !isBaseOnly && !hasSingleAxisSplit && (() => {
                // Preserve variant-name prefixes ("Concept 1: Ø 244 cm") and
                // dedupe so repeated metal-finish rows collapse to one entry.
                const seen = new Set<string>();
                const variantSizeText = sizeVariants && sizeVariants.length > 0
                  ? sizeVariants
                      .map((v) => (v.label || "").trim())
                      .filter((label) => {
                        if (!label) return false;
                        if (seen.has(label)) return false;
                        seen.add(label);
                        return true;
                      })
                      .join("\n")
                  : null;
                // If variants are dimensional, use them as a size picker.
                // Otherwise (finish/material-only variants), fall back to the
                // product's raw dimensions so the row is never dropped.
                const variantsAreDimensional = variantSizeText && looksLikeDimension(variantSizeText);
                const sizeText = variantsAreDimensional
                  ? variantSizeText!
                  : formatDimensionsMultiline(product.dimensions);
                if (!looksLikeDimension(sizeText)) return null;
                // Keep the same "<cm> | <in>" format used for single-dim
                // products so axis labels (W × H × D) show on both sides.
                const formatted = withImperialPerLine(sizeText);
                const interactive = variantsAreDimensional && hasVariants;
                return (
                  <ExpandableSpec
                    icon={specIcon("📐")}
                    text={formatted}
                    emphasized
                    placeholder={interactive ? "Select Your Size" : undefined}
                    value={interactive ? selectedVariantIdx : undefined}
                    onChange={interactive ? setSelectedVariantIdx : undefined}
                  />
                );
              })()}

              {!isOolMinibar && !isRugSqmActive && isDualAxis && hasDualSize && (
                <ExpandableSpec
                  icon={specIcon(dualLabelIsDim ? "📐" : "✦")}
                  text={dualLabelIsDim ? withImperialPerLine(dualSizeOptions.join("\n")) : dualSizeOptions.join("\n")}
                  secondaryText={null}
                  emphasized
                  placeholder={dualLabelIsDim ? "Select Your Size" : ((product as any)?.wood_label_override || (isRugCategory(product.category) ? "Select Your Size" : "Select the Wood Finish"))}
                  value={selectedDualSize != null ? Math.max(0, dualSizeOptions.indexOf(selectedDualSize)) : null}
                  onChange={(idx) => {
                    if (idx < 0) {
                      clearAllDualSelections();
                      return;
                    }
                    const s = dualSizeOptions[idx] ?? null;
                    setSelectedDualSize(s);
                    let nextBase = selectedBase;
                    let nextTop = selectedTop;
                    if (s && nextBase && !variantsList.some((x: any) => matchesDual(x, nextBase, nextTop, s))) { setSelectedBase(null); nextBase = null; }
                    if (s && nextTop && !variantsList.some((x: any) => matchesDual(x, nextBase, nextTop, s))) { setSelectedTop(null); nextTop = null; }
                    // Re-sync the gallery to the canonical key for the
                    // (base, top, size) triple — same resolver as the
                    // Base/Top dropdowns, so all three axes stay aligned.
                    handleMaterialChange(nextTop ?? nextBase ?? s, { base: nextBase, top: nextTop, size: s });
                  }}
                  disabledIndices={disabledDualSizeIdx}
                  helperText={
                    disabledDualSizeIdx.length > 0 && (selectedBase || selectedTop)
                      ? `Some sizes aren't available with the current selection — greyed out.`
                      : undefined
                  }
                />
              )}

              {!isRugSqmActive && isBaseOnly && baseAxisIsDim && (
                <ExpandableSpec
                  icon={specIcon("📐")}
                  text={withImperialPerLine(baseOptions.join("\n"))}
                  placeholder={getBasePlaceholder(product)}
                  singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
                  emphasized
                  value={selectedBase != null ? Math.max(0, baseOptions.indexOf(selectedBase)) : null}
                  onChange={(idx) => {
                    if (idx < 0) {
                      setSelectedBase(null);
                      handleMaterialChange(null, { base: null, top: null, size: null });
                      return;
                    }
                    const v = baseOptions[idx] ?? null;
                    setSelectedBase(v);
                    handleMaterialChange(v, { base: v, top: null, size: null });
                  }}
                />
              )}

              {!isRugSqmActive && isDualAxis && baseAxisIsDim && (
                <ExpandableSpec
                  icon={specIcon("📐")}
                  text={withImperialPerLine(baseOptions.join("\n"))}
                  placeholder={getBasePlaceholder(product)}
                  singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
                  emphasized
                  value={selectedBase != null ? Math.max(0, baseOptions.indexOf(selectedBase)) : null}
                  onChange={(idx) => {
                    if (idx < 0) {
                      clearAllDualSelections();
                      return;
                    }
                    const v = baseOptions[idx] ?? null;
                    setSelectedBase(v);
                    let nextTop = selectedTop;
                    let nextSize = selectedDualSize;
                    if (v && nextTop && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelectedTop(null); nextTop = null; }
                    if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelectedDualSize(null); nextSize = null; }
                    if (v && !nextTop) {
                      const compatTops = topOptions.filter((t) => variantsList.some((x: any) => matchesDual(x, v, t, nextSize)));
                      if (compatTops.length === 1) { setSelectedTop(compatTops[0]); nextTop = compatTops[0]; }
                    }
                    handleMaterialChange(v, { base: v, top: nextTop, size: nextSize });
                  }}
                  disabledIndices={disabledBaseIdx}
                  helperText={
                    disabledBaseIdx.length > 0 && (selectedTop || selectedDualSize)
                      ? `Some ${(getBasePlaceholder(product) || "base").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                      : undefined
                  }
                />
              )}

              {/* Model-style base axis whose options carry dimensions (e.g. Bora Sconce
                  Uplight / Downlight) — render BEFORE the finish swatches and use
                  the dimensions icon since the value is fundamentally a size choice. */}
              {!isRugSqmActive && isBaseOnly && !baseAxisIsDim && !suppressBaseAsFinish
                && baseOptions.length > 0 && baseOptions.every(looksLikeDimension) && (
                <ExpandableSpec
                  icon={specIcon("📐")}
                  text={withImperialPerLine(baseOptions.join("\n"))}
                  placeholder={getBasePlaceholder(product)}
                  singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
                  emphasized
                  value={selectedBase != null ? Math.max(0, baseOptions.indexOf(selectedBase)) : null}
                  onChange={(idx) => {
                    if (idx < 0) {
                      setSelectedBase(null);
                      handleMaterialChange(null, { base: null, top: null, size: null });
                      return;
                    }
                    const v = baseOptions[idx] ?? null;
                    setSelectedBase(v);
                    handleMaterialChange(v, { base: v, top: null, size: null });
                  }}
                />
              )}

              {/* Dual-axis with a Model/Size base whose options carry dimensions
                  (e.g. Callisto Pendant x1 / 100 / x4) — render the base ABOVE
                  the finish swatches and use the dimensions icon. */}
              {!isRugSqmActive && isDualAxis && !baseAxisIsDim && !suppressBaseAsFinish
                && baseOptions.length > 0 && baseOptions.every(looksLikeDimension) && (
                <ExpandableSpec
                  icon={specIcon("📐")}
                  text={withImperialPerLine(baseOptions.join("\n"))}
                  placeholder={getBasePlaceholder(product)}
                  singleValueLabel={formatVariantAxisLabel(product.base_axis_label) || undefined}
                  emphasized
                  value={selectedBase != null ? Math.max(0, baseOptions.indexOf(selectedBase)) : null}
                  onChange={(idx) => {
                    if (idx < 0) {
                      clearAllDualSelections();
                      return;
                    }
                    const v = baseOptions[idx] ?? null;
                    setSelectedBase(v);
                    let nextTop = selectedTop;
                    let nextSize = selectedDualSize;
                    if (v && nextTop && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelectedTop(null); nextTop = null; }
                    if (v && nextSize && !variantsList.some((x: any) => matchesDual(x, v, nextTop, nextSize))) { setSelectedDualSize(null); nextSize = null; }
                    if (v && !nextTop) {
                      const compatTops = topOptions.filter((t) => variantsList.some((x: any) => matchesDual(x, v, t, nextSize)));
                      if (compatTops.length === 1) { setSelectedTop(compatTops[0]); nextTop = compatTops[0]; }
                    }
                    handleMaterialChange(v, { base: v, top: nextTop, size: nextSize });
                  }}
                  disabledIndices={disabledBaseIdx}
                  helperText={
                    disabledBaseIdx.length > 0 && (selectedTop || selectedDualSize)
                      ? `Some ${(getBasePlaceholder(product) || "base").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                      : undefined
                  }
                />
              )}
            </div>

            {/* Logistics sits with the specification block, directly beneath
                the dimensions row — never down with the curator notes. */}
            <ShippingDetailsAccordion variant="row" />






            {/* ===== Primary action block — boxed panel identical to the
                designer-side trade sheet (lead time, price, quantity, CTAs,
                utility links), followed by the trade-only secondary stack.
                Pinned to the viewport bottom while the finish drawer scrolls
                so the order CTA is always reachable. */}
            <div className="flex flex-col gap-2.5 lg:sticky lg:bottom-0 lg:z-20 lg:-mx-1 lg:border-t lg:border-border/60 lg:bg-background lg:px-1 lg:pb-4 lg:pt-3 lg:shadow-[0_-16px_28px_-20px_hsl(var(--foreground)/0.35)]">
              <div className="flex flex-col gap-3 rounded-none border border-border/60 bg-muted/30 p-5 md:p-6">
                {product.lead_time && (
                  <p className="font-body text-[11px] uppercase tracking-widest text-neutral-500">
                    Production lead time: {String(product.lead_time).replace(/^lead\s*time:?\s*/i, "")}
                  </p>
                )}

                {priceLabels && (
                  <div className="flex flex-col gap-1">
                    <PresentationModeToggle />
                     {showTradePrice && priceLabels.retailLabel && (
                       <p data-trade-sensitive className="font-body text-[11px] tracking-[0.04em] text-muted-foreground line-through decoration-muted-foreground/50">
                        Retail: {priceLabels.prefix}{priceLabels.retailLabel}
                      </p>
                    )}
                     {!showTradePrice ? <RetailPrice label={`${priceLabels.prefix}${priceLabels.retailLabel}`} /> : <p data-trade-sensitive className="font-display text-2xl leading-none text-foreground">
                       {priceLabels.prefix}{showTradePrice ? priceLabels.netLabel : priceLabels.retailLabel}{" "}
                      <span className="font-body text-xs tracking-widest uppercase text-muted-foreground">
                         {showTradePrice ? "Net Trade Price" : "Retail Price"}
                      </span>
                    </p>}
                     {showTradePrice && <span data-client-placeholder aria-hidden="true" className="h-6 w-32 animate-pulse bg-muted/60" />}
                  </div>
                )}

                {/* Quantity */}
                <div className="flex items-center justify-between border-y border-border/50 py-2.5">
                  <span className="font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Quantity:
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={quantity <= 1}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-none border border-transparent text-foreground transition-all hover:border-border hover:bg-muted/50 disabled:opacity-30"
                    >
                      <Minus className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                    <span className="min-w-8 text-center font-body text-sm font-medium tabular-nums text-foreground">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={quantity >= 99}
                      onClick={() => setQuantity(Math.min(99, quantity + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-none border border-transparent text-foreground transition-all hover:border-border hover:bg-muted/50 disabled:opacity-30"
                    >
                      <Plus className="h-4 w-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                {/* Primary CTA — shared intake before the existing order path */}
                <Button
                  data-commerce-primary
                  onClick={() => window.dispatchEvent(new Event("ma:open-workspace-order"))}
                  className="flex items-center justify-center gap-2 px-5 py-3 rounded-none font-body text-xs uppercase tracking-[0.18em] transition-all w-full bg-foreground text-background hover:bg-foreground/90"
                >
                  <ShoppingCart size={14} />
                  Proceed to Order
                </Button>

                {/* Secondary — co-pilot workspace (quote) */}
                <button
                  onClick={handleAddToQuote}
                  disabled={adding}
                  className={cn(
                    "flex items-center justify-center gap-2 px-5 py-3 rounded-none font-body text-xs uppercase tracking-[0.18em] transition-all w-full border",
                    added
                      ? "border-emerald-600 text-emerald-700 bg-background"
                      : "border-foreground/40 bg-background text-foreground hover:bg-muted/60",
                    adding && "opacity-60"
                  )}
                >
                  {adding ? (
                    <DotCircleLoader size="sm" />
                  ) : added ? (
                    <Check size={14} />
                  ) : null}
                  {added ? "Added to Co-Pilot Workspace" : "Add to Co-Pilot Workspace"}
                </button>

                {/* Utility links — Favorite / Pin / Fabric & Finishes PDF */}
                <div className="mt-1 border-t border-border/40 pt-4">
                  <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-2 px-2">
                    <FavoriteFolderPicker pickId={favoriteId} align="start" side="top">
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          "inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-foreground",
                          favorited && "text-destructive hover:text-destructive"
                        )}
                      >
                        <Heart size={12} strokeWidth={1.25} className={cn("shrink-0", favorited && "fill-current")} />
                        {favorited ? "Saved" : "Favorite"}
                      </button>
                    </FavoriteFolderPicker>

                    <button
                      onClick={() => togglePin(compareItem)}
                      className={cn(
                        "inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-foreground",
                        pinned && "text-[hsl(var(--gold))] hover:text-[hsl(var(--gold))]",
                        compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                      )}
                    >
                      <Pin size={12} strokeWidth={1.25} className={cn("shrink-0", pinned && "fill-current")} />
                      {pinned ? "Pinned" : "Pin to Selection"}
                    </button>

                    {(product.pdf_url || product.pdf_urls?.some((entry) => !/^fabric\s*(?:&|and)\s*finishes\b/i.test(entry.label)) || pricing?.spec_sheet_url) ? (
                      <SpecSheetButton
                        pdfUrl={product.pdf_url || pricing?.spec_sheet_url || null}
                        pdfUrls={product.pdf_urls?.filter((entry) => !/^fabric\s*(?:&|and)\s*finishes\b/i.test(entry.label))}
                        brandName={designerDisplay}
                        productName={product.title}
                        variant="button"
                        className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-foreground cursor-pointer"
                        icon={<FileText size={12} strokeWidth={1.25} className="shrink-0" />}
                      />
                    ) : null}
                    {priceLabels && showTradePrice && (
                      <button
                        type="button"
                        data-trade-sensitive
                        onClick={() => {
                          const blob = buildTradeCoverSheetPdf({
                            productName: product.title,
                            brand: designerDisplay,
                            dimensions: product.dimensions,
                            materials: product.materials,
                            leadTime: product.lead_time,
                            retailCents: priceLabels.retailCents,
                            netCents: priceLabels.netCents,
                            currency: priceLabels.currency,
                            studioName: authProfile?.company || [authProfile?.first_name, authProfile?.last_name].filter(Boolean).join(" ") || "Trade Studio",
                            tierLabel: tierLabel || "Trade",
                            discountPct: TRADE_DISCOUNT,
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${product.title.replace(/[^\w]+/g, "_")}_Trade_Cover_Sheet.pdf`;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 60000);
                        }}
                        className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-foreground cursor-pointer"
                      >
                        <FileText size={12} strokeWidth={1.25} className="shrink-0" />
                        Trade Cover Sheet
                      </button>
                    )}
                    <FinishesPdfButton
                      pickId={product.id}
                      productName={product.title}
                      brandName={designerDisplay}
                      documents={product.pdf_urls}
                      className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80 transition-colors hover:text-foreground cursor-pointer"
                      icon={<Layers size={12} strokeWidth={1.25} className="shrink-0" />}
                    />
                  </div>
                </div>
              </div>

              {finishesMissingImages.length > 0 && (
                <p className="font-body text-[11px] text-muted-foreground italic">
                  Heads up — no reference image on file for{" "}
                  <span className="text-foreground">{finishesMissingImages.join(", ")}</span>. A note
                  will be attached to the quote so our concierge can confirm visuals.
                </p>
              )}




              {/* Uniform secondary stack — identical widths, sharp corners,
                  consistent thin neutral outlines */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setCustomRequestOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-none font-body text-[10px] uppercase tracking-[0.18em] transition-colors border border-border bg-background text-neutral-900 hover:bg-muted/60 w-full"
                >
                  <Wand2 size={13} />
                  Request Customisation
                </button>

            {/* 3D model viewer moved beneath the photo (left column) as a
                collapsed accordion. Finish selectors act as its legend here. */}

            {/* Draft a tearsheet with the currently-selected fabric / wood finishes.
                Visible whenever the product has linked swatches. Disabled while
                swatches load and until at least one finish is chosen. */}
            {(finishesLoading || hasLinkedFabrics || linkedWoodFinishes.length > 0) && (
              (selectedFabric || selectedWoodPrice || selectedTop || selectedBase || selectedSingleMaterial) && !finishesLoading ? (
                <>
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("product", product.id);
                    const fabricName = selectedFabric?.name || selectedTopDisplay || selectedTop || null;
                    const woodName = selectedWoodPrice?.name || selectedBaseDisplay || selectedBase || selectedSingleMaterial || null;
                    if (fabricName) params.set("fabric", String(fabricName));
                    if (selectedFabric?.image_url) params.set("fabricImg", selectedFabric.image_url);
                    if (woodName) params.set("wood", String(woodName));
                    if (selectedWoodPrice?.image_url) params.set("woodImg", selectedWoodPrice.image_url);
                    const variantLabelParts = [selectedBase, selectedTop, selectedDualSize, selectedSingleSize]
                      .filter(Boolean).map(String);
                    if (variantLabelParts.length) params.set("variant", variantLabelParts.join(" · "));
                    // Persist product + locked finishes into the concierge session
                    // so the Tearsheet Builder and Quote flow can carry them forward.
                    updateConciergeSession({
                      product: {
                        id: product.id,
                        title: product.title,
                        designer_name: (product as { designer_name?: string | null }).designer_name ?? null,
                        imageUrl: selectedFabric?.image_url ?? null,
                        source: "trade",
                      },
                       finishes: {
                         fabric: fabricName,
                         fabricImg: selectedFabric?.image_url ?? null,
                         wood: woodName,
                         woodImg: selectedWoodPrice?.image_url ?? null,
                         variant: variantLabelParts.length ? variantLabelParts.join(" · ") : null,
                      },
                      locked: true,
                    });
                    navigate(buildTearsheetHref());
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-none font-body text-[10px] uppercase tracking-[0.18em] transition-colors border border-border bg-background text-neutral-900 hover:bg-muted/60 w-full"
                >
                  <FileText size={13} />
                  Draft Tearsheet with These Finishes
                </button>
                <CopyTearsheetLink path={buildTearsheetHref()} variant="block" />
                </>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-none font-body text-[10px] uppercase tracking-[0.18em] transition-colors border border-border bg-background text-neutral-900 opacity-50 cursor-not-allowed w-full"
                >
                  {finishesLoading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Loading finishes…
                    </>
                  ) : (
                    <>
                      <FileText size={13} />
                      Draft Tearsheet with These Finishes
                    </>
                  )}
                </button>
              )
            )}
              </div>
            </div>

          </div>
        </div>
        {!isLg && renderLowerDetails()}
        {/* From the Same Maker — related picks */}
        {showTradePrice && relatedPicks.length > 0 && (() => {
          const sameMakerLabel = (product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title)))
            ? "From the Same Maker"
            : "From the Same Designer";

          // Build brand summary from designer biography (mirror PublicProductPage logic).
          const bio = sanitizeBiographyCitations((designer as any).biography as string | undefined);
          let brandSummary = "";
          if (bio) {
            const cleaned = bio
              .split(/\n+/)
              .map((line) => line.trim())
              .filter((line) => line && !/^https?:\/\//i.test(line.split("|")[0].trim()))
              .join(" ")
              .replace(/\s+/g, " ")
              .trim();
            if (cleaned.length <= 480) {
              brandSummary = cleaned;
            } else {
              const sentenceEnd = cleaned.slice(480).search(/[.!?](\s|$)/);
              brandSummary = sentenceEnd !== -1
                ? cleaned.slice(0, 480 + sentenceEnd + 1).trim()
                : cleaned.slice(0, 480).replace(/\s+\S*$/, "") + "…";
            }
          }

          const PREVIEW_LEN = 240;
          const needsToggle = brandSummary.length > PREVIEW_LEN;
          let preview = brandSummary;
          if (needsToggle) {
            const slice = brandSummary.slice(0, PREVIEW_LEN);
            const lastSpace = slice.lastIndexOf(" ");
            preview = (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim() + "…";
          }
          const shownSummary = bioExpanded || !needsToggle ? brandSummary : preview;

          return (
            <div className="mt-16 pt-8 border-t border-border">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
                {/* Mobile-only heading */}
                <div className="lg:hidden order-1">
                  <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    {sameMakerLabel}
                  </p>
                  <h2 className="font-display text-2xl leading-tight">
                    <Link
                      to={designer.slug ? `/trade/gallery/${designer.slug}` : fallbackPath}
                      onClick={() => {
                        if (designer.slug) rememberProductBackRef(designer.slug, location.pathname + location.search);
                      }}
                      className="hover:text-primary transition-colors"
                    >
                      {designerDisplay}
                    </Link>
                  </h2>
                </div>

                {/* Product grid — mobile: horizontal swipe rail */}
                <div className="relative lg:col-span-8 order-3 lg:order-2">
                  {relatedPicks.length > 3 && (
                    <div className="mb-3 hidden justify-end gap-2 md:flex">
                      {[-1, 1].map((d) => (
                        <button key={d} type="button" aria-label={d < 0 ? "Previous pieces" : "Next pieces"}
                          onClick={() => { const el = document.getElementById("same-designer-rail"); el?.scrollBy({ left: d * el.clientWidth, behavior: "smooth" }); }}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground hover:border-foreground">
                          {d < 0 ? <ChevronLeft size={16} strokeWidth={1.5} /> : <ChevronRight size={16} strokeWidth={1.5} />}
                        </button>
                      ))}
                    </div>
                  )}
                  <div id="same-designer-rail" className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-6 md:mx-0 md:px-0">
                    {relatedPicks.slice(0, 6).map((rp) => (
                      <Link
                        key={rp.id}
                        to={designer.slug ? `/trade/products/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}` : fallbackPath}
                        state={{ from: location.pathname + location.search }}
                        className="group block shrink-0 w-[62%] snap-start md:w-[calc((100%-3rem)/3)]"
                      >
                        <div className="relative aspect-square rounded-none overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/40 transition-colors">
                          {rp.image_url ? (
                            <img
                              src={rp.image_url}
                              alt={rp.title}
                              className={cn(
                                "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
                                rp.hover_image_url ? "group-hover:opacity-0" : "group-hover:scale-105"
                              )}
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}
                          {rp.hover_image_url && (
                            <img
                              src={rp.hover_image_url}
                              alt=""
                              className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <p className="font-body text-xs md:text-sm text-foreground mt-2 text-center truncate">
                          {rp.title}
                        </p>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Brand summary — left column on desktop, directly under the name on mobile */}
                <div className="lg:col-span-4 lg:pr-4 order-2 lg:order-1">

                  <div className="hidden lg:block">
                    <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      {sameMakerLabel}
                    </p>
                    <h2 className="font-display text-2xl md:text-3xl leading-tight mb-5">
                      <Link
                        to={designer.slug ? `/trade/gallery/${designer.slug}` : fallbackPath}
                        onClick={() => {
                          if (designer.slug) rememberProductBackRef(designer.slug, location.pathname + location.search);
                        }}
                        className="hover:text-primary transition-colors"
                      >
                        {designerDisplay}
                      </Link>
                    </h2>
                  </div>
                  {brandSummary && (
                    <div>
                      <p className="font-body text-sm text-foreground/75 leading-relaxed text-justify">
                        {renderParagraph(shownSummary)}
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
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="h-28 md:hidden" aria-hidden="true" />
      <ProductCommerceCta
        productId={product.id}
        dockOnly
        fixedDock
        orderTriggerEvent="ma:open-workspace-order"
        tradeApproved
        productTitle={product.title}
        designerName={designerDisplay}
        imageUrl={images[galleryActiveIndex ?? 0] || product.image_url || null}
        rrpLabel={priceLabels?.retailLabel ?? null}
        retailLabelOverride={priceLabels?.retailLabel ?? null}
        netLabelOverride={priceLabels?.netLabel ?? null}
        selectedFinishes={[selectedBase, selectedTop, selectedDualSize, selectedSingleSize, selectedFabric?.name].filter((value): value is string => typeof value === "string" && value.length > 0)}
        orderFinishLabel={selectorQuoteFinishes?.pickId === product.id ? selectorQuoteFinishes.finishes.map((finish) => `${finish.label}: ${finish.name}`).join(" · ") : [selectedWoodPrice?.name || selectedBaseDisplay || selectedBase, selectedTopDisplay || selectedTop, selectedDualSize || selectedSingleSize, selectedFabric?.name].filter(Boolean).join(" · ")}
        dimensionsLabel={drawerDimensionsLabel}
        selectedFinishSwatches={felixSelectionRef.current?.finishes?.filter((finish) => !!finish.imageUrl).map((finish) => ({ name: finish.name, image_url: finish.imageUrl || "" }))}
        onAddToCart={(orderQuantity) => handleProceedToOrder(orderQuantity, true)}
        onPlaceOrder={() => currentRrpCents() ? handleProceedToOrder() : setCustomRequestOpen(true)}
      />

      <QuoteDrawer
        open={drawerOpen}
        onOpenChange={(next) => {
          setDrawerOpen(next);
          if (!next) { try { window.sessionStorage.removeItem(`ma-copilot-open-v1:${product.id}`); } catch { /* noop */ } }
        }}
        quoteId={activeQuoteId}
        refreshKey={drawerRefreshKey}
        activePriceSnapshot={drawerPriceSnapshot}
        activeDimensionsLabel={drawerDimensionsLabel}
      />

      <CustomRequestModal
        open={customRequestOpen}
        onClose={() => setCustomRequestOpen(false)}
        product={{
          id: tradeProductId || null,
          product_name: product?.title || "",
          brand_name: designerDisplay || null,
        }}
      />
      <GalleryDetailsFloatingNav
        showImmediately
        azHref="/designers"
        allCategoriesHref={
          product?.category
            ? categoryUrl(product.category, product.subcategory ?? null)
            : undefined
        }
      />
     </div>
  );
};

export default TradeProductPage;
