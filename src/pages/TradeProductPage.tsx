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
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Heart, Scale, ArrowLeft, Layers, Ruler, Clock, Globe, ShoppingCart, Check, Loader2, Package, Wand2, ChevronDown, Sparkles,
} from "lucide-react";
import { renderParagraph } from "@/components/EditorialBiography";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ShareMenu from "@/components/ShareMenu";
import { buildPieceOgUrl } from "@/lib/whatsapp-share";
import ProductImageGallery from "@/components/product/ProductImageGallery";
import SpecSheetButton, { type PdfEntry } from "@/components/trade/SpecSheetButton";
import CadAssetsSection from "@/components/trade/CadAssetsSection";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/hooks/useFavorites";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";
import { normalizeCategoryContext } from "@/lib/categoryNormalization";
import { buildProductBreadcrumbs } from "@/lib/productBreadcrumbs";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import CustomRequestModal from "@/components/trade/CustomRequestModal";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import { useTradeDisplayCurrency } from "@/hooks/useTradeDisplayCurrency";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ExpandableSpec from "@/components/ExpandableSpec";
import Breadcrumbs, { type Crumb } from "@/components/Breadcrumbs";
import { getBasePlaceholder, getTopPlaceholder } from "@/lib/variantPlaceholders";
import { formatDimensionsMultiline } from "@/lib/formatDimensions";
import { computeVariantAxes, parseMaterialsFallback } from "@/lib/parseSizeVariants";
import { buildProductFinishMap, resolveFinishImageIndex, resolveVariantImageIndex, findVariantForImageIndex } from "@/lib/variantImageMap";
import { resolveAutoDefaultPair } from "@/lib/variantAutoDefault";
import { formatHandcrafted } from "@/lib/formatHandcrafted";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { rememberProductBackRef } from "@/lib/designerBackRef";

function slugify(s: string) {
  return s.toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

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
  variant_placeholder: string | null;
  base_axis_label: string | null;
  top_axis_label: string | null;
  size_variants?: { label?: string; base?: string; top?: string; price_cents?: number }[] | null;
  variant_image_map: Record<string, number> | null;
  edition: string | null;
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
};

function useTradeProductBySlug(
  tradeProductIdParam: string | undefined,
  designerSlug: string | undefined,
  productSlug: string | undefined,
) {
  return useQuery({
    queryKey: ["trade-product-page", tradeProductIdParam, designerSlug, productSlug],
    queryFn: async () => {
      if (tradeProductIdParam) {
        const { data: tradeProduct } = await supabase
          .from("trade_products")
          .select("id, product_name, brand_name, image_url, gallery_images, materials, dimensions, description, category, subcategory, lead_time, origin, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix, spec_sheet_url")
          .eq("id", tradeProductIdParam)
          .eq("is_active", true)
          .maybeSingle();

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
            .select("id, title, subtitle, image_url, hover_image_url, gallery_images, materials, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, variant_image_map, edition")
            .eq("designer_id", (designer as any).id)
            .order("sort_order", { ascending: true });
          curatorPick = (picks || []).find((p: any) => p.title === (tradeProduct as any).product_name) || null;
          relatedPicks = ((picks || []) as unknown as ProductRow[]).filter((p) => p.id !== curatorPick?.id);
        }

        const product: ProductRow = {
          id: curatorPick?.id || (tradeProduct as any).id,
          title: curatorPick?.title || (tradeProduct as any).product_name,
          subtitle: curatorPick?.subtitle || null,
          image_url: curatorPick?.image_url || (tradeProduct as any).image_url || null,
          hover_image_url: curatorPick?.hover_image_url || null,
          gallery_images: curatorPick?.gallery_images?.length ? curatorPick.gallery_images : (tradeProduct as any).gallery_images || null,
          materials: curatorPick?.materials || (tradeProduct as any).materials || null,
          dimensions: curatorPick?.dimensions || (tradeProduct as any).dimensions || null,
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
          size_variants: curatorPick?.size_variants || null,
          variant_image_map: curatorPick?.variant_image_map || null,
          edition: curatorPick?.edition || null,
        };

        const rawSizeVariants = Array.isArray(curatorPick?.size_variants)
          ? (curatorPick.size_variants as { label?: string; base?: string; top?: string; price_cents: number }[])
              .filter((v) => v && typeof v.price_cents === "number" && v.price_cents > 0 && (
                (typeof v.label === "string" && v.label.trim()) ||
                (typeof v.base === "string" && v.base.trim()) ||
                (typeof v.top === "string" && v.top.trim())
              ))
          : [];

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
          pricing: pricing.rrp_price_cents || pricing.trade_price_cents || pricing.size_variants ? pricing : null,
          relatedPicks,
          tradeProductId: (tradeProduct as any).id,
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
        .select("id, title, subtitle, image_url, hover_image_url, gallery_images, materials, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label, variant_image_map, edition")
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
        picks.find((p: any) => slugify(p.title + (p.subtitle ? `-${p.subtitle}` : "")) === productSlug) ||
        picks.find((p: any) => slugify(p.title) === productSlug) ||
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

      // Pull trade pricing + extra images from trade_products
      let tradeQuery = supabase
        .from("trade_products")
        .select("id, image_url, gallery_images, trade_price_cents, rrp_price_cents, currency, price_unit, price_prefix, spec_sheet_url")
        .eq("product_name", (product as any).title)
        .eq("is_active", true)
        .limit(1);
      if (brandCandidates.length === 1) tradeQuery = tradeQuery.eq("brand_name", brandCandidates[0]);
      else if (brandCandidates.length > 1) tradeQuery = tradeQuery.in("brand_name", brandCandidates);

      const { data: tradeMatches } = await tradeQuery;
      const tradeProduct = tradeMatches?.[0] as any | undefined;

      const rawSizeVariants = Array.isArray((product as any).size_variants)
        ? ((product as any).size_variants as { label?: string; base?: string; top?: string; price_cents: number }[])
            .filter((v) => v && typeof v.price_cents === "number" && v.price_cents > 0 && (
              (typeof v.label === "string" && v.label.trim()) ||
              (typeof v.base === "string" && v.base.trim()) ||
              (typeof v.top === "string" && v.top.trim())
            ))
        : [];

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
          size_variants: (product as any).size_variants || null,
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
  const { discountPct: TRADE_DISCOUNT, discountLabel, tierLabel } = useTradeDiscount();
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
  const [selectedDualSize, setSelectedDualSize] = useState<string | null>(null);
  const [defaultPair, setDefaultPair] = useState<{ base: string; top: string } | null>(null);
  // Single-axis split: when each variant label encodes both size + material,
  // we expose two independent dropdowns and resolve the active variant by both.
  const [selectedSingleSize, setSelectedSingleSize] = useState<string | null>(null);
  const [selectedSingleMaterial, setSelectedSingleMaterial] = useState<string | null>(null);
  // Mirrors PublicProductPage: gallery jumps to a finish's mapped image when a
  // material/finish dropdown is changed (state-backed so behaviour matches the
  // public side exactly).
  const [galleryActiveIndex, setGalleryActiveIndex] = useState<number | undefined>(undefined);
  // Bumped on every parent-initiated jump so the gallery re-syncs even when the
  // numeric index is identical to the previous one (e.g. re-selecting the same finish).
  const [galleryJumpNonce, setGalleryJumpNonce] = useState(0);
  const fxRates = useFxRates();

  // ── Quote drawer ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [customRequestOpen, setCustomRequestOpen] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: drafts } = await supabase
        .from("trade_quotes")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1);
      if (drafts && drafts.length > 0) setActiveQuoteId(drafts[0].id);
    })();
  }, [user]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [designerSlug, productSlug]);

  const handleAddToQuote = useCallback(async () => {
    if (!user || !data) return;
    setAdding(true);
    try {
      let quoteId = activeQuoteId;
      if (!quoteId) {
        const { data: q, error } = await supabase
          .from("trade_quotes")
          .insert({ user_id: user.id, status: "draft" })
          .select("id")
          .single();
        if (error || !q) {
          toast({ title: "Error creating quote", description: error?.message, variant: "destructive" });
          return;
        }
        quoteId = q.id;
        setActiveQuoteId(quoteId);
      }

      const { product, designer } = data;

      // Build the chosen variant label (finish/size) from the current selection
      // so the quote line records exactly what the user picked.
      let variantLabel: string | null = null;
      const sv: any[] | undefined = data?.pricing?.size_variants;
      const buildDualLabel = (v: any): string =>
        [v?.base, v?.top, v?.size, v?.label].filter(Boolean).map((s: string) => String(s).trim()).join(" · ");
      if (selectedBase || selectedTop) {
        variantLabel = [selectedBase, selectedTop, selectedDualSize].filter(Boolean).join(" · ");
      } else if (selectedSingleMaterial || selectedSingleSize) {
        variantLabel = [selectedSingleSize, selectedSingleMaterial].filter(Boolean).join(" · ");
      } else if (selectedVariantIdx != null) {
        const v = sv && sv[selectedVariantIdx];
        if (v?.label) variantLabel = String(v.label).trim();
      } else if (sv && sv.length === 1) {
        // Single-variant product (e.g. Reda Amalou Lady Bug — one Base × Top
        // combination). The user never opens the dropdown, but the finish
        // should still be recorded on the quote line for clarity.
        const v = sv[0];
        variantLabel = buildDualLabel(v) || (v?.label ? String(v.label).trim() : null);
      }

      const { data: itemId, error } = await supabase.rpc("add_gallery_product_to_quote", {
        _user_id: user.id,
        _quote_id: quoteId,
        _product_name: product.title,
        _brand_name: designer.name,
        _category: product.category || "",
        _image_url: product.image_url || null,
        _dimensions: product.dimensions || null,
        _materials: product.materials || null,
        _quantity: 1,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        // Persist the chosen variant on the freshly created/merged quote item.
        if (itemId && variantLabel) {
          await supabase
            .from("trade_quote_items")
            .update({ variant_label: variantLabel } as any)
            .eq("id", itemId as unknown as string);
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
  }, [user, data, activeQuoteId, toast, selectedBase, selectedTop, selectedDualSize, selectedSingleMaterial, selectedSingleSize, selectedVariantIdx]);

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
    const idx = resolveVariantImageIndex(finishMap, { base: pair.base, top: pair.top, imageCount: imgCount });
    if (idx !== undefined) {
      setGalleryActiveIndex(idx);
      setGalleryJumpNonce((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.product?.id]);

  if (isLoading) {
    return <div className="pt-8"><PageLoadingSkeleton /></div>;
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

  const { product, designer, relatedPicks, pricing, tradeProductId } = data;

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
    designerId: tradeProductId || product.id,
    section: "designers",
  };

  const pinned = isPinned(product.title, tradeProductId || product.id);
  const favoriteId = tradeProductId || product.id;
  const favorited = isFavorited(favoriteId);

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

  // Data-driven finish → gallery image index mapping (shared with PublicProductPage).
  const productFinishMap = buildProductFinishMap((product as any)?.variant_image_map);

  // Identical handler signature/behaviour to PublicProductPage.handleMaterialChange.
  // `opts` carries the *post-update* axis state (base, top, size) so the
  // resolver can always look up the canonical composite key for the
  // current selection — guaranteeing the hero image stays in sync no
  // matter which axis the user touches.
  const handleMaterialChange = (
    label: string | null,
    opts?: { base?: string | null; top?: string | null; size?: string | null }
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
      setGalleryActiveIndex(0);
      setGalleryJumpNonce((n) => n + 1);
      return;
    }
    const idx = effectiveOpts && (effectiveOpts.base || effectiveOpts.top || effectiveOpts.size)
      ? resolveVariantImageIndex(productFinishMap, {
          base: effectiveOpts.base,
          top: effectiveOpts.top,
          size: effectiveOpts.size,
          label,
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

  const activeVariant = isDualAxis
    ? dualVariant
    : isBaseOnly
      ? (hasVariants && selectedBase
        ? sizeVariants!.find((v) => (v.base || "").trim() === selectedBase) ?? null
        : null)
    : hasSingleAxisSplit
      ? singleAxisActive
      : (hasVariants && selectedVariantIdx != null ? sizeVariants![selectedVariantIdx] : null);

  // When the product has variants but the user hasn't picked one yet, fall back
  // to the cheapest variant price so we can show "From €X" instead of "Price on request".
  const minVariantCents = hasVariants && sizeVariants && sizeVariants.length > 0
    ? Math.min(...sizeVariants.map((v) => v.price_cents))
    : null;
  const effectiveRrpCents = hasVariants
    ? (activeVariant ? activeVariant.price_cents : minVariantCents)
    : pricing?.rrp_price_cents ?? null;
  const isFromPrice = hasVariants && !activeVariant && effectiveRrpCents != null;

  const renderPrice = () => {
    if (!pricing || !effectiveRrpCents) return null;
    const rrp = effectiveRrpCents;
    const trade = Math.round(rrp * (1 - TRADE_DISCOUNT));
    const cents = showTradePrice ? trade : rrp;
    const formatted = formatPriceConverted(cents, pricing.currency, displayCurrency, fxRates, pricing.price_unit || undefined);
    // Honour the catalog price_prefix (e.g. "From"), and add an implicit "From"
    // when we're showing the minimum variant before the user selects a size.
    const explicitPrefix = pricing.price_prefix ? `${pricing.price_prefix} ` : "";
    const prefix = explicitPrefix || (isFromPrice ? "From " : "");
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-display text-2xl text-accent font-semibold">
          {prefix}{formatted}
        </span>
        {showTradePrice && (
          <>
            <span className="font-body text-sm text-muted-foreground line-through">
              {prefix}{formatPriceConverted(rrp, pricing.currency, displayCurrency, fxRates, pricing.price_unit || undefined)}
            </span>
            <span className="font-body text-[10px] bg-accent/15 text-accent px-2 py-0.5 rounded-full uppercase tracking-wider" title={`${tierLabel} tier — ${discountLabel} trade discount`}>
              {tierLabel} –{discountLabel}
            </span>
          </>
        )}
      </div>
    );
  };

  // Sample request deep-link to Procurement
  const sampleRequestUrl = `/trade/samples?product=${encodeURIComponent(product.title)}&brand=${encodeURIComponent(designerDisplay)}`;

  return (
    <>
      <Helmet>
        <title>{pageTitle} — Trade — Maison Affluency</title>
      </Helmet>

      <div className="max-w-7xl pb-12">
        <button
          type="button"
          onClick={() => navigate(fromPath || fallbackPath)}
          className="mb-4 inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
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
          <div className="relative">
            <ProductImageGallery
              images={images}
              alt={product.title}
              activeIndex={galleryActiveIndex}
              activeIndexNonce={galleryJumpNonce}
              onIndexChange={setGalleryActiveIndex}
              firstImageBadge={
                product.edition ? (
                  <span className="font-body text-[10px] uppercase tracking-[0.15em] bg-background/85 backdrop-blur-sm border border-[hsl(var(--gold))]/40 text-[hsl(var(--gold))] px-2.5 py-1 rounded-full shadow-sm">
                    {product.edition}
                  </span>
                ) : null
              }
              overlay={
                product.description ? (
                  <div className="flex flex-col items-end gap-2">
                    <div className="hidden md:block">
                      <LightboxDescriptionDropdown description={product.description} />
                    </div>
                  </div>
                ) : null
              }
            />
          </div>

          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={designer.slug ? `/trade/designers/${designer.slug}` : fallbackPath}
                  onClick={() => {
                    if (designer.slug) rememberProductBackRef(designer.slug, location.pathname + location.search);
                  }}
                  className="font-body text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gold))] hover:text-primary hover:underline underline-offset-2 transition-colors"
                >
                  {designerDisplay}
                </Link>
                <h1 className="font-display text-2xl md:text-3xl mt-1 leading-tight">
                  {product.title}
                  {product.subtitle && ` by ${product.subtitle}`}
                </h1>
              </div>
              <div className="shrink-0 mt-1 flex items-center gap-2">
                <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} compact />
                <ShareMenu
                  url={buildPieceOgUrl(designerDisplay, product.title)}
                  message={`${product.title} by ${designerDisplay} — Maison Affluency`}
                  iconSize="w-4 h-4"
                  showLabel={false}
                />
              </div>
            </div>

            {/* Materials & dimensions */}
            <div className="flex flex-col gap-2">
              {/* Material dropdown — when variants encode (size × material), bind it to selectedSingleMaterial */}
              {!isDualAxis && hasSingleAxisSplit && (
                <ExpandableSpec
                  icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                  text={singleMaterialOptions.join("\n")}
                  placeholder="Select your material choice"
                  emphasized
                  value={selectedSingleMaterial != null ? Math.max(0, singleMaterialOptions.indexOf(selectedSingleMaterial)) : null}
                  onChange={(idx) => {
                    const newMat = singleMaterialOptions[idx] ?? null;
                    setSelectedSingleMaterial(newMat);
                    handleMaterialChange(newMat);
                    // Reset size if it isn't offered for the new material
                    if (newMat && selectedSingleSize && !singleAxisParsed.some((p) => p.material === newMat && p.size === selectedSingleSize)) {
                      setSelectedSingleSize(null);
                    }
                  }}
                  disabledIndices={disabledMaterialIndices}
                  helperText={
                    disabledMaterialIndices.length > 0 && selectedSingleSize
                      ? `Some materials aren't offered in ${selectedSingleSize} — greyed out.`
                      : undefined
                  }
                />
              )}
              {isBaseOnly && (
                <ExpandableSpec
                  icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                  text={baseOptions.join("\n")}
                  placeholder={getBasePlaceholder(product)}
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
              {!isDualAxis && !isBaseOnly && !hasSingleAxisSplit && product.materials && (() => {
                const parsed = parseMaterialsFallback(product.materials);
                return (
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={product.materials}
                    placeholder="Select your material choice"
                    autoSplit
                    autoDetectedHint
                    onChange={(idx) => handleMaterialChange(parsed[idx] ?? null)}
                  />
                );
              })()}
              {/* Dual-axis: Base × Top finish dropdowns */}
              {isDualAxis && (
                <>
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={baseOptions.join("\n")}
                    placeholder={getBasePlaceholder(product)}
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
                      // Auto-select the only viable top when base narrows it down to one
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
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={topOptions.join("\n")}
                    placeholder={getTopPlaceholder(product)}
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
              {/* Single-axis split: dedicated size dropdown driven by unique sizes */}
              {!isDualAxis && hasSingleAxisSplit && (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={singleSizeOptions.join("\n")}
                  emphasized
                  placeholder="Select your size"
                  value={selectedSingleSize != null ? Math.max(0, singleSizeOptions.indexOf(selectedSingleSize)) : null}
                  onChange={(idx) => {
                    const newSize = singleSizeOptions[idx] ?? null;
                    setSelectedSingleSize(newSize);
                    if (newSize && selectedSingleMaterial && !singleAxisParsed.some((p) => p.size === newSize && p.material === selectedSingleMaterial)) {
                      setSelectedSingleMaterial(null);
                    }
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
              {product.dimensions && !isDualAxis && !isBaseOnly && !hasSingleAxisSplit && (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={
                    sizeVariants && sizeVariants.length > 0
                      ? sizeVariants
                          .map((v) => {
                            let label = (v.label || "").trim();
                            const colonIdx = label.indexOf(":");
                            if (colonIdx > -1 && colonIdx < 60) {
                              label = label.slice(colonIdx + 1).trim();
                            }
                            const dimMatch = label.match(/^(.*?\b(?:cm|mm|in)\b)/i)
                              || label.match(/^(.*?(?<![A-Za-z\/])[mM](?![A-Za-z\/]))/);
                            if (dimMatch) label = dimMatch[1].trim();
                            return label;
                          })
                          .join("\n")
                      : formatDimensionsMultiline(product.dimensions)
                  }
                  emphasized
                  placeholder="Select your size"
                  value={hasVariants ? selectedVariantIdx : undefined}
                  onChange={hasVariants ? setSelectedVariantIdx : undefined}
                />
              )}
              {isDualAxis && hasDualSize && (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={dualSizeOptions.join("\n")}
                  emphasized
                  placeholder="Select your size"
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
              {product.dimensions && isDualAxis && !hasDualSize && (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={formatDimensionsMultiline(product.dimensions)}
                  emphasized
                />
              )}
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

            {/* Trade price + retail/trade toggle (size driven by selector above) */}
            {effectiveRrpCents ? (
              <div className="flex flex-col gap-2 pt-1">
                {renderPrice()}
                <button
                  onClick={() => setShowTradePrice(!showTradePrice)}
                  className="self-start font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  Show {showTradePrice ? "retail" : "trade"} price
                </button>
              </div>
            ) : (
              <p className="font-body text-sm text-muted-foreground italic">Price on request</p>
            )}

            {/* Primary CTA — Add to Quote */}
            <button
              onClick={handleAddToQuote}
              disabled={adding}
              className={cn(
                "mt-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full",
                added
                  ? "bg-emerald-600 text-white"
                  : "bg-foreground text-background hover:bg-foreground/90",
                adding && "opacity-60"
              )}
            >
              {adding ? (
                <Loader2 size={14} className="animate-spin" />
              ) : added ? (
                <Check size={14} />
              ) : (
                <ShoppingCart size={14} />
              )}
              {added ? "Added to Quote" : "Add to Quote"}
            </button>

            {/* Secondary actions: Favorite / Pin / Spec Sheet */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => toggleFavorite(favoriteId, {
                  product_name: product.title,
                  brand_name: designerDisplay,
                  category: product.category || undefined,
                  image_url: product.image_url,
                  dimensions: product.dimensions,
                  materials: product.materials,
                })}
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

              {(product.pdf_url || (product.pdf_urls && product.pdf_urls.length > 0) || pricing?.spec_sheet_url) ? (
                <SpecSheetButton
                  pdfUrl={product.pdf_url || pricing?.spec_sheet_url || null}
                  pdfUrls={product.pdf_urls}
                  brandName={designerDisplay}
                  productName={product.title}
                  variant="button"
                />
              ) : (
                <Link
                  to="/trade/samples"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                >
                  Procurement
                </Link>
              )}
            </div>

            {/* Bespoke / customisation request */}
            <button
              onClick={() => setCustomRequestOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-body text-[11px] uppercase tracking-[0.12em] transition-all border border-border text-foreground hover:bg-muted w-full"
            >
              <Wand2 size={13} />
              Request Customisation
            </button>

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
          </div>
        </div>

        {/* From the Same Maker — related picks */}
        {relatedPicks.length > 0 && (() => {
          const sameMakerLabel = (product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title)))
            ? "From the Same Maker"
            : "From the Same Designer";

          // Build brand summary from designer biography (mirror PublicProductPage logic).
          const bio = (designer as any).biography as string | undefined;
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

                {/* Product grid */}
                <div className="lg:col-span-8 order-2 lg:order-2">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                    {relatedPicks.slice(0, 6).map((rp) => (
                      <Link
                        key={rp.id}
                        to={designer.slug ? `/trade/products/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}` : fallbackPath}
                        state={{ from: location.pathname + location.search }}
                        className="group block"
                      >
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/40 transition-colors">
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

                {/* Brand summary — left column on desktop, below grid on mobile */}
                <div className="lg:col-span-4 lg:pr-4 order-3 lg:order-1">
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
    </>
  );
};

export default TradeProductPage;
