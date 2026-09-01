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
import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { formatProductSubtitleLine } from "@/lib/subtitleDisplay";
import {
  Heart, ArrowLeft, Layers, Clock, Globe, ShoppingCart, Check, Loader2, Package, Wand2, ChevronDown, Sparkles, FileText, Box,
} from "lucide-react";
import { renderParagraph } from "@/components/EditorialBiography";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import ShareMenu from "@/components/ShareMenu";
import CornerTooltip from "@/components/product/CornerTooltip";
import { buildPieceOgUrl } from "@/lib/whatsapp-share";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import ActiveSwatchCaption from "@/components/product/ActiveSwatchCaption";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import CadAssetsSection from "@/components/trade/CadAssetsSection";
import Product3DViewer from "@/components/trade/Product3DViewer";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { updateConciergeSession } from "@/hooks/useConciergeSession";
import AddToProjectPopover from "@/components/trade/AddToProjectPopover";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";
import { normalizeCategoryContext } from "@/lib/categoryNormalization";
import { formatDesignerDisplayName } from "@/lib/designerDisplayName";
import { buildProductBreadcrumbs } from "@/lib/productBreadcrumbs";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import CustomRequestModal from "@/components/trade/CustomRequestModal";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates, convertCents } from "@/components/trade/CurrencyToggle";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import { formatEditionLabel } from "@/lib/editionLabel";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ProductDetailSkeleton from "@/components/product/ProductDetailSkeleton";
import { sanitizeBiographyCitations } from "@/lib/sanitizeBiographyCitations";
import ExpandableSpec from "@/components/ExpandableSpec";
import LegendDisclosure from "@/components/LegendDisclosure";
import FinishSelector from "@/components/FinishSelector";
import { isProductUpholstered } from "@/lib/upholstery";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { getBasePlaceholder, getTopPlaceholder, formatVariantAxisLabel, isDimensionAxisLabel, resolveFinishSectionLabels } from "@/lib/variantPlaceholders";
import { formatDimensionsMultiline, formatImperialDimensions, withImperialPerLine, withImperialStacked } from "@/lib/formatDimensions";
import { computeVariantAxes, parseMaterialsFallback } from "@/lib/parseSizeVariants";
import { makeSwatchAxisFilter } from "@/lib/finishDuplication";
import { buildProductFinishMap, resolveFinishImageIndex, resolveVariantImageIndex, findVariantForImageIndex } from "@/lib/variantImageMap";
import { resolveAutoDefaultPair } from "@/lib/variantAutoDefault";
import { formatHandcrafted } from "@/lib/formatHandcrafted";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useProductConfigOptional } from "@/contexts/ProductConfigContext";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { rememberProductBackRef } from "@/lib/designerBackRef";
import GalleryDetailsFloatingNav from "@/components/GalleryDetailsFloatingNav";
import { categoryUrl } from "@/lib/categorySlugs";
import { priceRugVariantFromLabel, isRugCategory, looksLikeDimension } from "@/lib/rugPricing";
import { resolveActiveVariant, resolvePartialDualMinCents } from "@/lib/resolveActiveVariant";
import { findQuoteFinishSwatch } from "@/lib/quoteFinishSwatches";

import RugSizeColourPicker, { type RugSelection } from "@/components/rug/RugSizeColourPicker";
import SpecGlyph from "@/components/product/SpecGlyph";
import AlsoContainsFinishes from "@/components/product/AlsoContainsFinishes";
import { firstPublicVariantDimensionLabel } from "@/lib/productVariantSpecs";
import { createActiveDraftQuote, fetchActiveDraftQuoteId } from "@/lib/activeProjectId";

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
  return s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function resolveGalleryImageByFinishFilename(heroList: string[], labels: Array<string | null | undefined>): string | null {
  const cleanLabels = labels.filter(Boolean).map((s) => String(s));
  const toTerms = (label: string) => label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((term) => term.length >= 4 && !["finish", "fabric", "marble", "wood", "ashwood"].includes(term));

  let best: { url: string; score: number; index: number } | null = null;
  heroList.forEach((url, index) => {
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
  });

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
  };
  pricing: TradePricing | null;
  relatedPicks: ProductRow[];
  tradeProductId: string | null;
  glbUrl?: string | null;
};

function useTradeProductBySlug(
  tradeProductIdParam: string | undefined,
  designerSlug: string | undefined,
  productSlug: string | undefined,
) {
  return useQuery({
    queryKey: queryKeys.tradeProductPage(tradeProductIdParam, designerSlug, productSlug),
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
        const { data: designers } = await supabase
          .from("designers")
          .select("id, name, slug, display_name, biography")
          .eq("is_published", true)
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
            .select("id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, price_per_sqm_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered, com_meters")
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
            .select("id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, price_per_sqm_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered, com_meters")
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

      const { data: designer } = await supabase
        .from("designers")
        .select("id, name, slug, display_name, biography")
        .eq("slug", designerSlug)
        .eq("is_published", true)
        .maybeSingle();
      if (!designer) return null;

      const { data: picks } = await supabase
        .from("designer_curator_picks")
        .select("id, slug, title, subtitle, image_url, hover_image_url, gallery_images, materials, materials_description, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, price_per_sqm_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, wood_label_override, variant_image_map, edition, edition_number, edition_signing, gallery_captions, is_upholstered, com_meters")
        .eq("designer_id", designer.id)
        .order("sort_order", { ascending: true });

      if (!picks || picks.length === 0) return null;

      // Match priority: exact (title+subtitle) → exact (title) → startsWith (title) → contains (title) → token overlap.
      // Token overlap covers cases where the gallery card uses a trade_products name (e.g. "Angelo M Side Table Collection")
      // that doesn't slug-match the underlying curator pick title (e.g. "Angelo M/SR 45/55/80 Side Table Collection").
      const slugTokens = (s: string) =>
        s.split("-").filter((t) => t.length >= 3);
      const targetTokens = productSlug ? slugTokens(productSlug) : [];
      const overlapScore = (pickTitle: string) => {
        const ts = new Set(slugTokens(slugify(pickTitle)));
        return targetTokens.reduce((n, t) => n + (ts.has(t) ? 1 : 0), 0);
      };
      let product: any =
        picks.find((p: any) => p.slug === productSlug) ||
        picks.find((p: any) => slugify(p.title + (p.subtitle ? `-${p.subtitle}` : "")) === productSlug) ||
        picks.find((p: any) => slugify(p.title) === productSlug) ||
        picks.find((p: any) => slugify(String(p.title).replace(/\s+by\s+.+$/i, "")) === productSlug) ||
        picks.find((p: any) => slugify(p.title).startsWith(productSlug!)) ||
        picks.find((p: any) => slugify(p.title).includes(productSlug!));

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
  const { user } = useAuth();
  const { toast } = useToast();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();
  // Pricing math is owned by the container engine (ProductConfigContext) so
  // Variant A and Variant B always resolve identical figures. Falls back to the
  // tier hook when this layout is rendered outside the container.
  const productConfig = useProductConfigOptional();
  const tierFallback = useTradeDiscount();
  const TRADE_DISCOUNT = productConfig?.tierDiscountPct ?? tierFallback.discountPct;
  const discountLabel = productConfig?.discountLabel ?? tierFallback.discountLabel;
  const tierLabel = productConfig?.tierLabel ?? tierFallback.tierLabel;
  const { showTradePrice, setShowTradePrice } = useTradePriceMode();

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

  // ── Pricing display state ──
  const [displayCurrency, setDisplayCurrency] = useTradeDisplayCurrency();
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

  // Honour `?ccy=<CODE>` from the concierge drawer's deep-link so the product
  // page opens in the same currency the drawer showed (the pick's base
  // currency), instead of the user's auto-defaulted display currency.
  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const raw = (qp.get("ccy") || "").trim().toUpperCase();
    if (!raw) return;
    const supported = ["original", "SGD", "EUR", "USD", "GBP", "CHF", "AED", "HKD", "AUD"] as const;
    const match = supported.find((c) => c.toUpperCase() === raw);
    if (match && match !== displayCurrency) setDisplayCurrency(match as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // ── Quote drawer ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [customRequestOpen, setCustomRequestOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);
  // True when this product has linked fabric/leather swatches — used to hide
  // the redundant "Select your upholstery finish" dropdown, since the swatch
  // picker already drives the upholstery price tier.
  const [hasLinkedFabrics, setHasLinkedFabrics] = useState(false);
  const [linkedWoodFinishes, setLinkedWoodFinishes] = useState<string[]>([]);
  const [selectedFabric, setSelectedFabric] = useState<import("@/components/FinishSelector").SelectedFinishInfo | null>(null);
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




  useEffect(() => {
    if (!user) return;
    (async () => {
      setActiveQuoteId(await fetchActiveDraftQuoteId(user.id));
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


  const handleAddToQuote = useCallback(async () => {
    if (!user || !data) return;
    setAdding(true);
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
      const sv: any[] | undefined = data?.pricing?.size_variants;
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
        _variant_label: variantLabel,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        // Persist the chosen variant on the freshly created/merged quote item,
        // and pre-fill shipping (CBM / kg / mode / origin country) from the
        // catalogue so the per-line shipping estimator is accurate from day one.
        if (itemId) {
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
            await supabase
              .from("trade_quote_items")
              .update(patch)
              .eq("id", itemId as unknown as string);
          }
        }
        setAdded(true);
        setDrawerRefreshKey((k) => k + 1);
        setDrawerOpen(true);
        toast({
          title: "Added to quote",
          description: `${product.title} added to QU-${quoteId!.slice(0, 6).toUpperCase()}`,
        });
        setTimeout(() => setAdded(false), 2500);
      }
    } finally {
      setAdding(false);
    }
  }, [user, data, activeQuoteId, toast, selectedBase, selectedTop, selectedBaseDisplay, selectedTopDisplay, selectedSwatchGalleryIndices, selectedSwatchGalleryName, selectedDualSize, selectedSingleMaterial, selectedSingleSize, selectedVariantIdx, rugSelection, selectedFabric, selectedWoodPrice, fxRates, displayCurrency, finishesMissingImages, activeVariantCents]);

  // Preselect Base/Top/Size (dual-axis) or Material/Size (single-axis) from
  // URL query params — used when the concierge 3D drawer deep-links here so
  // the on-page price reflects the finishes the architect just chose.
  // Runs BEFORE the auto-default effect so ?base=/?top= take priority.
  useEffect(() => {
    const sv = data?.pricing?.size_variants;
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
    const sv = data?.pricing?.size_variants;
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
    if (galleryActiveIndex === undefined) return;
    const rawMap = (data?.product as any)?.variant_image_map;
    const finishMap = buildProductFinishMap(rawMap);
    if (!finishMap) return;
    const variants = (data?.pricing?.size_variants
      || (data?.product as any)?.size_variants
      || []) as { label?: string; base?: string; top?: string }[];
    const match = findVariantForImageIndex(finishMap, variants, galleryActiveIndex);
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

  // Proactive tearsheet nudge — fires after the architect has stopped
  // changing finishes for 3s. Sends a lightweight "lock this in" spec card
  // into the concierge chat stream. Skips firing until at least one finish
  // axis is actually selected, and dedupes by (product + selection key) so
  // the same combo isn't re-nudged.
  const lastNudgeKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const productId = data?.product?.id as string | undefined;
    if (!productId) return;
    const fabricLabel = selectedFabric?.name ?? null;
    const baseLabel = selectedWoodPrice?.name ?? selectedBase ?? null;
    const topLabel = selectedTopSwatch?.name ?? selectedTop ?? null;
    // Nothing to lock in yet.
    if (!fabricLabel && !baseLabel && !topLabel) return;

    const selectionKey = `${productId}::${fabricLabel ?? ""}::${baseLabel ?? ""}::${topLabel ?? ""}`;
    if (lastNudgeKeyRef.current === selectionKey) return;

    const t = window.setTimeout(() => {
      // Format trade price using whichever cents we can trust.
      const pricing = data?.pricing;
      const product = data?.product as any;
      const rawCents =
        (selectedWoodPrice?.price_cents && selectedWoodPrice.price_cents > 0
          ? selectedWoodPrice.price_cents
          : null) ??
        pricing?.trade_price_cents ??
        product?.trade_price_cents ??
        null;
      const rawCcy = (selectedWoodPrice?.currency || pricing?.currency || product?.currency || "EUR") as DisplayCurrency;
      let tradePriceLabel: string | null = null;
      if (rawCents && rawCents > 0) {
        try {
          tradePriceLabel = formatPriceConverted(rawCents, rawCcy, displayCurrency, fxRates);
        } catch {
          tradePriceLabel = null;
        }
      }

      const leadTimeLabel = ((pricing as any)?.lead_time || product?.lead_time || null) as string | null;

      const detail = {
        productId,
        productName: (product?.title || product?.product_name || "This piece") as string,
        brandName: (product?.brand_name || product?.subtitle || null) as string | null,
        sku: null,
        imageUrl: (product?.image_url || (product?.gallery_images?.[0] ?? null)) as string | null,
        fabricLabel,
        baseLabel,
        topLabel,
        tradePriceLabel,
        leadTimeLabel,
      };

      lastNudgeKeyRef.current = selectionKey;
      window.dispatchEvent(new CustomEvent("concierge:propose_tearsheet_proactive", { detail }));
    }, 3000);

    return () => window.clearTimeout(t);
  }, [
    data?.product?.id,
    selectedFabric?.name,
    selectedWoodPrice?.name,
    selectedWoodPrice?.price_cents,
    selectedWoodPrice?.currency,
    selectedTopSwatch?.name,
    selectedBase,
    selectedTop,
    displayCurrency,
    fxRates,
    data?.pricing,
  ]);





  if (isLoading) {
    return <div className="pt-8"><ProductDetailSkeleton variant="page" /></div>;
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <p className="font-body text-sm text-muted-foreground">Product not found.</p>
        <button
          onClick={() => navigate(-1)}
          className="font-body text-xs uppercase tracking-[0.12em] underline underline-offset-4 text-foreground hover:text-primary transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  const { product, designer, relatedPicks, pricing, tradeProductId, glbUrl } = data;

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
    designerId: tradeProductId || product.id,
    section: "designers",
  };

  const pinned = isPinned(product.title, tradeProductId || product.id);
  const favoriteId = tradeProductId || product.id;
  const favorited = isFavorited(favoriteId);
  const requestedFabricName = new URLSearchParams(location.search).get("fabric");

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
  const visibleActiveIndex = visibleImageIndices
    ? Math.max(0, visibleImageIndices.indexOf(galleryActiveIndex ?? visibleImageIndices[0]))
    : galleryActiveIndex;



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
  const dualVariant = isDualAxis
    ? sizeVariants!.find((v) =>
        (v.base || "").trim() === (selectedBase || "") &&
        (v.top || "").trim() === (selectedTop || "") &&
        (!hasDualSize || (v.label || "").trim() === (selectedDualSize || ""))
      )
    : null;

  const singleAxisActive = hasSingleAxisSplit
    ? singleAxisParsed.find((p) =>
        p.size === (selectedSingleSize || "") &&
        p.material === (selectedSingleMaterial || "")
      )?.variant ?? null
    : null;

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
    baseOptions.length > 0 && baseOptions.every((b) => {
      const nb = normFinish(b);
      return linkedWoodFinishes.some((lw) => {
        const nlw = normFinish(lw);
        return nlw === nb || nlw.includes(nb) || nb.includes(nlw);
      });
    });
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
  const suppressBaseAsFinish = !baseAxisIsDim && isFinishAxisLabel(baseAxisLabelRaw) && (allBasesHaveSwatches || hasWoodSwatches);
  const suppressTopAsFinish = !topAxisIsDim && (topAxisHasSwatches || (isUpholsteredProduct && isFinishAxisLabel(topAxisLabelRaw)) || (hasWoodSwatches && isFinishAxisLabel(topAxisLabelRaw)));

  // When the product has variants but the user hasn't picked one yet, fall back
  // to the cheapest *priced* variant so we can show "From €X" instead of "Price upon Request".
  // Variants without a price (price_cents = 0 → "Price upon Request" finishes) are skipped here.
  const pricedVariantCents = hasVariants && sizeVariants
    ? sizeVariants.map((v) => v.price_cents).filter((c) => typeof c === "number" && c > 0)
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
  const effectiveRrpCents = hasVariants
    ? (activeVariant
      ? (typeof activeVariant.price_cents === "number" && activeVariant.price_cents > 0 ? activeVariant.price_cents : null)
      : (dualSelectionUnpriced ? null : (partialDualMinCents ?? minVariantCents)))
    : pricing?.rrp_price_cents ?? null;
  const isFromPrice = hasVariants && !activeVariant && !dualSelectionUnpriced && effectiveRrpCents != null;


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

  const renderPrice = () => {
    if (!pricing || !effectiveRrpCents) return null;
    // When a wood-finish swatch carries a frame-price override, it becomes
    // the RRP base; otherwise fall back to the size_variants base.
    let rrp = effectiveRrpCents;
    if (selectedWoodPrice?.price_cents && selectedWoodPrice.price_cents > 0) {
      const woodCents = selectedWoodPrice.currency === pricing.currency
        ? selectedWoodPrice.price_cents
        : convertCents(selectedWoodPrice.price_cents, selectedWoodPrice.currency, pricing.currency as DisplayCurrency, fxRates);
      rrp = woodCents;
    }
    const trade = Math.round(rrp * (1 - TRADE_DISCOUNT));
    const cents = showTradePrice ? trade : rrp;
    // Add the fabric per-LM upcharge on top. The upcharge sits in the fabric's
    // currency; convert to the product currency when they differ.
    let upcharge = 0;
    if (fabricUpchargeCentsRaw > 0) {
      const fromCcy = selectedFabric?.currency || pricing.currency;
      upcharge = fromCcy === pricing.currency
        ? fabricUpchargeCentsRaw
        : convertCents(fabricUpchargeCentsRaw, fromCcy, pricing.currency as DisplayCurrency, fxRates);
    }
    const centsWithFabric = cents + upcharge;
    const formatted = formatPriceConverted(centsWithFabric, pricing.currency, displayCurrency, fxRates, pricing.price_unit || undefined);
    // Once the user has made a concrete fabric or wood-frame selection, the
    // price is fully resolved — never show "From" (whether it comes from the
    // explicit curator prefix or the dual-axis fallback).
    const hasConcreteSelection = !!selectedFabric || !!selectedWoodPrice || !!activeVariant;
    const explicitPrefix = pricing.price_prefix && !hasConcreteSelection ? `${pricing.price_prefix} ` : "";
    const prefix = explicitPrefix || (isFromPrice && !hasConcreteSelection ? "From " : "");

    return (
      <div className="w-full bg-neutral-50 border border-border rounded-none px-4 py-3.5">
        {/* Cohesive pricing bar — net price anchored left, struck retail +
            tier badge anchored right as one standard flex row. The box's own
            px-4 padding is the only right inset, so the pair can never bleed
            past the inner border edge; the right pair is a single shrink-0
            flex child inside a justify-between row (no absolute positioning). */}
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-display text-2xl text-accent font-semibold leading-none whitespace-nowrap min-w-0">
            {prefix}{formatted}
          </span>
          {showTradePrice && (
            <span className="flex items-baseline justify-end gap-2.5 shrink-0">
              <span className="font-body text-[13px] text-muted-foreground line-through whitespace-nowrap">
                {prefix}{formatPriceConverted(rrp + upcharge, pricing.currency, displayCurrency, fxRates, pricing.price_unit || undefined)}
              </span>
              <span className="font-body text-[10px] bg-accent/15 text-accent px-2 py-0.5 uppercase tracking-[0.14em] whitespace-nowrap" title={`${tierLabel} tier — ${discountLabel} trade discount`}>
                {tierLabel} –{discountLabel}
              </span>
            </span>
          )}
        </div>
        {(selectedWoodPrice || selectedFabric || (!selectedWoodPrice && !selectedFabric && (selectedTop || (isDualAxis && selectedBase && !baseAxisIsDim && !isFinishAxisLabel(baseAxisLabelRaw) ? false : selectedBase)))) && (
          <span className="block mt-2 font-body text-[10px] tracking-[0.06em] text-muted-foreground leading-snug">
            {selectedWoodPrice && (
              <>Frame: {selectedWoodPrice.name}</>
            )}
            {selectedWoodPrice && selectedFabric && " · "}
            {selectedFabric && (
              <>
                {selectedWoodPrice ? "Fabric: " : "Includes "}{selectedFabric.name}
                {selectedFabric.tier ? ` (CAT ${selectedFabric.tier})` : ""}
                {upcharge > 0 && (
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
        <button
          onClick={() => setShowTradePrice(!showTradePrice)}
          className="mt-2 font-body text-[9px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
        >
          Show {showTradePrice ? "retail" : "trade"} price
        </button>
      </div>
    );
  };

  // Sample request deep-link to Procurement
  const sampleRequestUrl = `/trade/samples?product=${encodeURIComponent(product.title)}&brand=${encodeURIComponent(designerDisplay)}&productId=${encodeURIComponent(product.id)}`;

  return (
    <div className="motion-safe:animate-fade-in">
      <Helmet>
        <title>{pageTitle} — Trade — Maison Affluency</title>
      </Helmet>

      <div className="max-w-7xl pb-12">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          <div className="relative md:relative sticky top-[max(1rem,env(safe-area-inset-top))] md:top-0 self-start z-30 bg-background" ref={galleryScrollRef}>
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

              firstImageBadge={
                (() => {
                  const editionLabel = formatEditionLabel(product);
                  return editionLabel ? (
                    <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider font-body bg-black/50 text-white/90 rounded-full border border-black/20 backdrop-blur-sm">
                      {editionLabel}
                    </span>
                  ) : null;
                })()
              }
              overlay={
                <div className="flex items-center gap-2">
                  {product.description && (
                    <div className="hidden md:block">
                      <LightboxDescriptionDropdown description={product.description} />
                    </div>
                  )}
                  <CornerTooltip label={favorited ? "Saved to Project" : "Add to Project"} side="bottom" align="end">
                    <AddToProjectPopover
                      productId={favoriteId}
                      productName={product.title}
                      onAdded={async () => {
                        if (!isFavorited(favoriteId)) {
                          await toggleFavorite(favoriteId);
                        }
                      }}
                      align="end"
                    >
                      <button
                        onClick={(e) => e.stopPropagation()}
                        aria-label={favorited ? "Saved to favorites" : "Add to favorites"}
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25"
                      >
                        <Heart size={18} strokeWidth={1.5} className={cn(favorited ? "fill-destructive text-destructive" : "text-foreground/80")} />
                      </button>
                    </AddToProjectPopover>
                  </CornerTooltip>
                </div>
              }
              bottomRightOverlay={(() => {
                // Bridge filenames use the raw designer name, not the shortened display name.
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
            {/* Mobile/PWA: the "Shown in" caption lives on the presentation
                photography instead of stacking under the gallery. */}
            <div className="hidden md:block md:border-0 md:shadow-none">
              <ActiveSwatchCaption pickId={product.id} activeIndex={galleryActiveIndex ?? 0} />
            </div>

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
                <details open className="mt-6 group border border-border rounded-md bg-muted/20">
                  <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none select-none border-b border-border">
                    <div className="flex items-center gap-2">
                      <Box size={14} className="text-foreground" />
                      <span className="font-display text-base leading-none">Configure in 3D</span>
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
                      url={resolvedGlbUrl}
                      alt={`${product.title} — 3D model${byLabel ? ` (${byLabel.variant_label})` : ""}`}
                      poster={product.image_url}
                      fabricTextureUrl={selectedFabric?.image_url || previewFabricImg || null}
                      baseTextureUrl={selectedWoodPrice?.image_url || previewWoodImg || null}
                      topTextureUrl={selectedTopSwatch?.image_url || null}
                      materialRoles={resolvedRoles || undefined}
                      autoOpen
                    />
                    <p className="mt-2 font-body text-[10px] leading-snug text-muted-foreground">
                      Pick a fabric or wood finish on the right — the 3D preview updates live.
                    </p>
                  </div>
                </details>
              );
            })()}
          </div>

          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 order-[-4] md:order-none">
              <div className="min-w-0">
                <Link
                  to={designer.slug ? `/trade/designers/${designer.slug}` : fallbackPath}
                  onClick={() => {
                    if (designer.slug) rememberProductBackRef(designer.slug, location.pathname + location.search);
                  }}
                  className="font-body text-[12px] uppercase tracking-[0.18em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  {designerDisplay}
                </Link>
                <h1 className="font-display text-[1.5rem] md:text-[1.85rem] mt-1 leading-tight">
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
              </div>
              <div className="shrink-0 mt-1 flex items-center gap-2">
                <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} compact />
              </div>
            </div>


            {/* Finish selection — mobile: directly under the photography */}
            <div className="flex flex-col gap-2 order-[-5] md:order-none">
              <FinishSelector
                  pickId={product.id}
                  productTitle={product.title}
                  productCategory={product.category}
                  currentGalleryIndex={galleryActiveIndex ?? 0}
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
                  woodLabel={
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
                    if (!indices || indices.length === 0) {
                      if (meta?.committed) {
                        setSelectedSwatchGalleryIndices(null);
                        setSelectedSwatchGalleryName(null);
                      }
                      return;
                    }
                    if (meta?.committed) {
                      setSelectedSwatchGalleryIndices(indices);
                      setSelectedSwatchGalleryName(meta.swatchName || null);
                    }
                    // image_indices are 1-based; gallery is 0-based.
                    setGalleryActiveIndex(Math.max(0, indices[0] - 1));
                    setGalleryJumpNonce((n) => n + 1);
                  }}
                  onWoodFinishChange={(woodName) => {
                    if (!woodName) { setSelectedBaseDisplay(null); return; }
                    // Match the swatch name to a Base axis value (case/space tolerant,
                    // and tolerant of code prefixes like "ECRT-SY-20 — Black Lacquered Sycamore").
                    const norm = (s: string) => s.trim().toLowerCase();
                    const nw = norm(woodName);
                    const match =
                      baseOptions.find((b) => norm(b) === nw)
                      || baseOptions.find((b) => nw.includes(norm(b)))
                      || baseOptions.find((b) => norm(b).includes(nw))
                      || woodName;
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
                  {!baseAxisIsDim && !suppressBaseAsFinish && !(baseOptions.length > 0 && baseOptions.every(looksLikeDimension)) && (
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
                      disabledIndices={disabledBaseIdx}
                      helperText={
                        disabledBaseIdx.length > 0 && (selectedTop || selectedDualSize)
                          ? `Some ${(getBasePlaceholder(product) || "base").toLowerCase().replace(/^select your /, "")} options aren't available with the current selection — greyed out.`
                          : undefined
                      }
                    />
                  )}
                  {/* Dual-axis: always render Top picker. */}
                  {!suppressTopAsFinish && !(hasLinkedFabrics && !topAxisIsDim) && (
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
                    disabledIndices={disabledTopIdx}
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

              {!isRugSqmActive && product.materials_description?.trim() && (isRugCategory(product.category) || (!hasLinkedFabrics && linkedWoodFinishes.length === 0)) && (
                <LegendDisclosure
                  icon={specIcon("⬗")}
                  text={product.materials_description.trim()}
                />
              )}
              <AlsoContainsFinishes pickId={product.id} className="mt-1 pl-6" />
            </div>


            {/* Trade price + retail/trade toggle (size driven by selector above) */}
        {effectiveRrpCents ? (
              <div className="order-[-3] md:order-none">
                {renderPrice()}
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground italic order-[-3] md:order-none">Price upon Request</p>
            )}


            {/* ===== Primary action block — CTA, utility links, secondary stack ===== */}
            <div className="flex flex-col gap-2.5">
              {/* Primary CTA — Add to Quote (sleek, low-profile) */}
              <button
                onClick={handleAddToQuote}
                disabled={adding}
                className={cn(
                  "flex items-center justify-center gap-2 px-5 py-3 rounded-none font-body text-xs uppercase tracking-[0.18em] transition-all w-full",
                  added
                    ? "bg-emerald-600 text-white"
                    : "bg-foreground text-background hover:bg-foreground/90",
                  adding && "opacity-60"
                )}
              >
                {adding ? (
                  <DotCircleLoader size="sm" />
                ) : added ? (
                  <Check size={14} />
                ) : (
                  <ShoppingCart size={14} />
                )}
                {added ? "Added to Quote" : "Add to Quote"}
              </button>

            {finishesMissingImages.length > 0 && (
              <p className="font-body text-[11px] text-muted-foreground -mt-1 italic">
                Heads up — no reference image on file for{" "}
                <span className="text-foreground">{finishesMissingImages.join(", ")}</span>. A note
                will be attached to the quote so our concierge can confirm visuals.
              </p>
            )}

              {/* Utility links — centered, micro-typography, pipe-separated */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => togglePin(compareItem)}
                  className={cn(
                    "font-body text-[10px] uppercase tracking-[0.16em] transition-colors",
                    pinned
                      ? "text-[hsl(var(--gold))]"
                      : "text-muted-foreground hover:text-foreground",
                    compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                  )}
                >
                  {pinned ? "Pinned" : "Pin to Selection"}
                </button>

                <span aria-hidden="true" className="text-border select-none">|</span>

                {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0) || pricing?.spec_sheet_url) ? (
                  <SpecSheetButton
                    pdfUrl={product.pdf_url || pricing?.spec_sheet_url || null}
                    pdfUrls={product.pdf_urls}
                    brandName={designerDisplay}
                    productName={product.title}
                    variant="button"
                    className="font-body text-[10px] uppercase tracking-[0.16em] text-[hsl(var(--pdf-red))] hover:opacity-80 transition-opacity cursor-pointer"
                  />
                ) : (
                  <Link
                    to="/trade/samples"
                    className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Procurement
                  </Link>
                )}

                <span aria-hidden="true" className="text-border select-none">|</span>

                <a
                  href={`https://wa.me/6591393850?text=${encodeURIComponent(`Hello Maison Affluency — I'd like more information on the ${product.title} by ${designerDisplay}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Contact Us
                </a>
              </div>



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
              (selectedFabric || selectedWoodPrice) && !finishesLoading ? (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams();
                    params.set("product", product.id);
                    if (selectedFabric?.name) params.set("fabric", selectedFabric.name);
                    if (selectedFabric?.image_url) params.set("fabricImg", selectedFabric.image_url);
                    if (selectedWoodPrice?.name) params.set("wood", selectedWoodPrice.name);
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
                        fabric: selectedFabric?.name ?? null,
                        fabricImg: selectedFabric?.image_url ?? null,
                        wood: selectedWoodPrice?.name ?? null,
                        woodImg: selectedWoodPrice?.image_url ?? null,
                        variant: variantLabelParts.length ? variantLabelParts.join(" · ") : null,
                      },
                      locked: true,
                    });
                    navigate(`/trade/tearsheets?${params.toString()}`);
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-none font-body text-[10px] uppercase tracking-[0.18em] transition-colors border border-border bg-background text-neutral-900 hover:bg-muted/60 w-full"
                >
                  <FileText size={13} />
                  Draft Tearsheet with These Finishes
                </button>
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
            {/* Dimensions & size pickers — mobile: after the price */}
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
              {!isRugSqmActive && isDualAxis && !baseAxisIsDim && !topAxisIsDim && !hasDualSize && product.dimensions && looksLikeDimension(product.dimensions) && (
                <ExpandableSpec icon={specIcon("📐")} text={withImperialStacked(product.dimensions)} />
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

              {!isRugSqmActive && isDualAxis && hasDualSize && (
                <ExpandableSpec
                  icon={specIcon("📐")}
                  text={withImperialPerLine(dualSizeOptions.join("\n"))}
                  secondaryText={null}
                  emphasized
                  placeholder="Select Your Size"
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

            {/* Origin & lead time — mobile: after the price */}
            <div className="flex flex-col gap-2">
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
                  <div className="-mt-4 border-b border-border/60 py-4 flex items-start gap-5">
                    {specIcon("✦", "mt-0.5")}
                    <div className="font-body text-sm leading-relaxed text-muted-foreground font-normal">
                      <p>{originLine}</p>
                      {leadLine && <p className="mt-0.5">{leadLine}</p>}
                    </div>
                  </div>
                );
              })()}

            </div>
          </div>
        </div>

        {/* From the Same Maker — related picks */}
        {relatedPicks.length > 0 && (() => {
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
                      to={designer.slug ? `/trade/designers/${designer.slug}` : fallbackPath}
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
                <div className="lg:col-span-8 order-3 lg:order-2">
                  <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory -mx-4 px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:mx-0 md:px-0">
                    {relatedPicks.slice(0, 6).map((rp) => (
                      <Link
                        key={rp.id}
                        to={designer.slug ? `/trade/products/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}` : fallbackPath}
                        state={{ from: location.pathname + location.search }}
                        className="group block shrink-0 w-[62%] snap-start md:w-auto md:shrink"
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
                        to={designer.slug ? `/trade/designers/${designer.slug}` : fallbackPath}
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

      <QuoteDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        quoteId={activeQuoteId}
        refreshKey={drawerRefreshKey}
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
