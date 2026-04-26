/**
 * TradeProductPage — full product sheet for trade users.
 * Mirrors PublicProductPage layout but with trade pricing, "Add to Quote" CTA,
 * and an inline "Need a sample? Request via Procurement →" link (no big CTA,
 * since Sample Requests live in Procurement).
 *
 * Route: /trade/products/:slug/:productSlug
 *
 * Back navigation:
 *   1. location.state.from (preferred — set when navigating from grid/gallery)
 *   2. sessionStorage("trade_product_from_path") fallback for refresh resilience
 *   3. /trade/showroom?tab=grid as final fallback
 */
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Heart, Scale, ArrowLeft, Layers, Ruler, Clock, Globe, ShoppingCart, Check, Loader2, Package,
} from "lucide-react";
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
import { SUBCATEGORY_MAP } from "@/lib/productTaxonomy";
import QuoteDrawer from "@/components/trade/QuoteDrawer";
import CurrencyToggle, { type DisplayCurrency, formatPriceConverted, useFxRates } from "@/components/trade/CurrencyToggle";
import PageLoadingSkeleton from "@/components/PageLoadingSkeleton";
import ExpandableSpec from "@/components/ExpandableSpec";
import { getBasePlaceholder, getTopPlaceholder } from "@/lib/variantPlaceholders";
import { formatDimensionsMultiline } from "@/lib/formatDimensions";
import { computeVariantAxes } from "@/lib/parseSizeVariants";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";

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

function useTradeProductBySlug(designerSlug: string | undefined, productSlug: string | undefined) {
  return useQuery({
    queryKey: ["trade-product-page", designerSlug, productSlug],
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
        .from("designer_curator_picks")
        .select("id, title, subtitle, image_url, hover_image_url, gallery_images, materials, dimensions, description, category, subcategory, pdf_url, pdf_urls, lead_time, origin, designer_id, trade_price_cents, currency, price_prefix, size_variants, variant_placeholder, base_axis_label, top_axis_label")
        .eq("designer_id", designer.id)
        .order("sort_order", { ascending: true });

      if (!picks || picks.length === 0) return null;

      // Match priority: exact (title+subtitle) → exact (title) → startsWith (title) → contains (title)
      // Last two enable resilient deep-links where the slug is partial (e.g. "casque" → "Casque Bar Cabinet")
      const product =
        picks.find((p: any) => slugify(p.title + (p.subtitle ? `-${p.subtitle}` : "")) === productSlug) ||
        picks.find((p: any) => slugify(p.title) === productSlug) ||
        picks.find((p: any) => slugify(p.title).startsWith(productSlug!)) ||
        picks.find((p: any) => slugify(p.title).includes(productSlug!));

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
        },
        designer: {
          id: designer.id,
          name: (designer as any).display_name || designer.name,
          slug: designer.slug,
          biography: (designer as any).biography || "",
        },
        pricing,
        relatedPicks: (picks as unknown as ProductRow[]).filter((p) => p.id !== (product as any).id),
        tradeProductId: tradeProduct?.id || null,
      };
    },
    enabled: !!designerSlug && !!productSlug,
    staleTime: 5 * 60_000,
  });
}

const TradeProductPage: React.FC = () => {
  const { slug: designerSlug, productSlug } = useParams<{ slug: string; productSlug: string }>();
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

  const { data, isLoading } = useTradeProductBySlug(designerSlug, productSlug);

  // ── Pricing display state ──
  const [displayCurrency, setDisplayCurrency] = useState<DisplayCurrency>("original");
  const [selectedVariantIdx, setSelectedVariantIdx] = useState<number | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [selectedTop, setSelectedTop] = useState<string | null>(null);
  const [selectedDualSize, setSelectedDualSize] = useState<string | null>(null);
  // Single-axis split: when each variant label encodes both size + material,
  // we expose two independent dropdowns and resolve the active variant by both.
  const [selectedSingleSize, setSelectedSingleSize] = useState<string | null>(null);
  const [selectedSingleMaterial, setSelectedSingleMaterial] = useState<string | null>(null);
  const fxRates = useFxRates();

  // ── Quote drawer ──
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [drawerRefreshKey, setDrawerRefreshKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

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
      const { error } = await supabase.rpc("add_gallery_product_to_quote", {
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
  }, [user, data, activeQuoteId, toast]);

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

  const rawSubcategory = product.subcategory?.trim();
  const normalizedSubcategory = rawSubcategory
    ? Object.entries(SUBCATEGORY_MAP).find(([, values]) =>
        values.some((value) => value.toLowerCase() === rawSubcategory.toLowerCase())
      )?.[0] || rawSubcategory
    : null;

  // Fallback back-target: showroom grid filtered to this category/subcategory
  const fallbackParams = new URLSearchParams({ tab: "grid" });
  if (product.category) fallbackParams.set("category", product.category);
  if (normalizedSubcategory) fallbackParams.set("subcategory", normalizedSubcategory);
  const fallbackPath = `/trade/showroom?${fallbackParams.toString()}`;

  const galleryFromAdmin = (product.gallery_images || []).filter(Boolean) as string[];
  const images = (galleryFromAdmin.length > 0
    ? galleryFromAdmin
    : Array.from(new Set([product.image_url, product.hover_image_url].filter(Boolean)))
  ) as string[];

  const pageTitle = `${product.title}${product.subtitle ? ` ${product.subtitle}` : ""} by ${designerDisplay}`;

  // Trade pricing rendering — supports single-axis (label) and dual-axis (base × top).
  // Parsing/deduping logic is shared with PublicProductPage via computeVariantAxes.
  const sizeVariants = pricing?.size_variants || null;
  const axes = computeVariantAxes(sizeVariants);
  const {
    hasVariants,
    isDualAxis,
    baseOptions,
    topOptions,
    dualSizeOptions,
    singleAxisParsed,
    singleSizeOptions,
    singleMaterialOptions,
    hasSingleAxisSplit,
  } = axes;
  const hasDualSize = dualSizeOptions.length > 0;
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

  const activeVariant = isDualAxis
    ? dualVariant
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
          onClick={() => {
            if (fromPath) {
              navigate(fromPath);
              return;
            }
            navigate(fallbackPath);
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
              overlay={
                product.description ? (
                  <div className="hidden md:block">
                    <LightboxDescriptionDropdown description={product.description} />
                  </div>
                ) : null
              }
            />
          </div>

          <div className="relative flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/trade/designers/${designer.slug}?from_product=${encodeURIComponent(location.pathname + location.search)}`}
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
                <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
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
                  value={selectedSingleMaterial != null ? Math.max(0, singleMaterialOptions.indexOf(selectedSingleMaterial)) : undefined}
                  onChange={(idx) => setSelectedSingleMaterial(singleMaterialOptions[idx] ?? null)}
                />
              )}
              {!isDualAxis && !hasSingleAxisSplit && product.materials && (
                <ExpandableSpec
                  icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                  text={product.materials}
                  placeholder="Select your material choice"
                  autoSplit
                  autoDetectedHint
                />
              )}
              {/* Dual-axis: Base × Top finish dropdowns */}
              {isDualAxis && (
                <>
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={baseOptions.join("\n")}
                    placeholder={getBasePlaceholder(product)}
                    emphasized
                    value={selectedBase != null ? Math.max(0, baseOptions.indexOf(selectedBase)) : undefined}
                    onChange={(idx) => setSelectedBase(baseOptions[idx] ?? null)}
                  />
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={topOptions.join("\n")}
                    placeholder={getTopPlaceholder(product)}
                    emphasized
                    value={selectedTop != null ? Math.max(0, topOptions.indexOf(selectedTop)) : undefined}
                    onChange={(idx) => setSelectedTop(topOptions[idx] ?? null)}
                  />
                </>
              )}
              {/* Single-axis split: dedicated size dropdown driven by unique sizes */}
              {!isDualAxis && hasSingleAxisSplit && (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={singleSizeOptions.join("\n")}
                  emphasized
                  placeholder="Select your size"
                  value={selectedSingleSize != null ? Math.max(0, singleSizeOptions.indexOf(selectedSingleSize)) : undefined}
                  onChange={(idx) => setSelectedSingleSize(singleSizeOptions[idx] ?? null)}
                />
              )}
              {/* Single-axis (no material split): show stripped size labels indexed by variant */}
              {product.dimensions && !isDualAxis && !hasSingleAxisSplit && (
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
                  value={hasVariants ? (selectedVariantIdx ?? undefined) : undefined}
                  onChange={hasVariants ? setSelectedVariantIdx : undefined}
                />
              )}
              {isDualAxis && hasDualSize && (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={dualSizeOptions.join("\n")}
                  emphasized
                  placeholder="Select your size"
                  value={selectedDualSize != null ? Math.max(0, dualSizeOptions.indexOf(selectedDualSize)) : undefined}
                  onChange={(idx) => setSelectedDualSize(dualSizeOptions[idx] ?? null)}
                />
              )}
              {product.dimensions && isDualAxis && !hasDualSize && (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={formatDimensionsMultiline(product.dimensions)}
                  emphasized
                />
              )}
              {product.origin && (
                <ExpandableSpec
                  icon={<Globe size={14} className="text-[hsl(var(--gold))]" />}
                  text={product.origin}
                />
              )}
              {product.lead_time && (
                <ExpandableSpec
                  icon={<Clock size={14} className="text-[hsl(var(--gold))]" />}
                  text={product.lead_time}
                />
              )}
            </div>

            {/* Trade price + retail/trade toggle (size driven by selector above) */}
            {effectiveRrpCents ? (
              <div className="flex flex-col gap-2 pt-1">
                {renderPrice()}
                <button
                  onClick={() => setShowTradePrice((v) => !v)}
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
        {relatedPicks.length > 0 && (
          <div className="mt-16 pt-8 border-t border-border">
            <div className="flex items-baseline justify-between mb-6">
              <div>
                <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                  {(product.subtitle || / by /i.test(product.title) || relatedPicks.some((rp) => rp.subtitle || / by /i.test(rp.title)))
                    ? "From the Same Maker"
                    : "From the Same Designer"}
                </p>
                <h2 className="font-display text-xl md:text-2xl leading-tight">
                  <Link
                    to={`/trade/designers/${designer.slug}?from_product=${encodeURIComponent(location.pathname + location.search)}`}
                    className="hover:text-primary transition-colors"
                  >
                    {designerDisplay}
                  </Link>
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {relatedPicks.slice(0, 8).map((rp) => (
                <Link
                  key={rp.id}
                  to={`/trade/products/${designer.slug}/${slugify(rp.title + (rp.subtitle ? `-${rp.subtitle}` : ""))}`}
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
        )}
      </div>

      <QuoteDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        quoteId={activeQuoteId}
        refreshKey={drawerRefreshKey}
      />
    </>
  );
};

export default TradeProductPage;
