import { motion, AnimatePresence } from "framer-motion";
import { X, Scale, ShoppingCart, Check, FileDown, Layers, Ruler, Loader2, Heart, FolderOpen, Info } from "lucide-react";
import LightboxDescriptionDropdown from "@/components/ui/LightboxDescriptionDropdown";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useFavorites } from "@/hooks/useFavorites";
import AddToProjectPopover from "@/components/trade/AddToProjectPopover";
import ExpandableSpec from "@/components/ExpandableSpec";
import { formatDimensionsMultiline } from "@/lib/formatDimensions";
import { computeVariantAxes } from "@/lib/parseSizeVariants";
import { getBasePlaceholder, getMaterialPlaceholder, getTopPlaceholder } from "@/lib/variantPlaceholders";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useState, useMemo, useEffect } from "react";
import { useTradeProducts } from "@/hooks/useTradeProducts";
import { useIsMobile } from "@/hooks/use-mobile";

export interface TradeProductLightboxItem {
  id: string;
  product_name: string;
  subtitle?: string;
  image_url: string | null;
  hover_image_url?: string;
  brand_name: string;
  materials?: string | null;
  dimensions?: string | null;
  description?: string | null;
  category?: string;
  subcategory?: string;
  pdf_url?: string | null;
  price?: string | null;
  /** Optional: priced variants (label/base/top + price_cents). When present, the
   *  lightbox shows each variant's price in the price block so users see how
   *  selecting a different finish/size changes the price. */
  size_variants?: { label?: string; base?: string; top?: string; price_cents?: number }[] | null;
  variant_placeholder?: string | null;
  base_axis_label?: string | null;
  top_axis_label?: string | null;
  currency?: string | null;
}

interface TradeProductLightboxProps {
  product: TradeProductLightboxItem | null;
  onClose: () => void;
  onAddToQuote: (product: TradeProductLightboxItem) => void;
  isAdding?: boolean;
  isAdded?: boolean;
  onSelectRelated?: (product: TradeProductLightboxItem) => void;
  /** All available picks from same designer/brand — used for "More from" carousel */
  allPicks?: TradeProductLightboxItem[];
}

const TradeProductLightbox = ({ product, onClose, onAddToQuote, isAdding, isAdded, onSelectRelated, allPicks }: TradeProductLightboxProps) => {
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();
  const isMobile = useIsMobile();
  const [showHoverImage, setShowHoverImage] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [hoverImageLoaded, setHoverImageLoaded] = useState(false);
  const [lastFavRealId, setLastFavRealId] = useState<string | null>(null);
  const [baseIdx, setBaseIdx] = useState<number | null>(null);
  const [topIdx, setTopIdx] = useState<number | null>(null);
  const [sizeIdx, setSizeIdx] = useState<number | null>(null);

  // Reset image + variant states when product changes
  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setHoverImageLoaded(false);
    setShowHoverImage(false);
    setBaseIdx(null);
    setTopIdx(null);
    setSizeIdx(null);
  }, [product?.id]);

  // Get merged trade products at top level (hooks can't be inside useMemo)
  const { allProducts: tradeProds } = useTradeProducts();

  // Related products — prefer allPicks (excludes current + varies selection), fallback to trade catalog
  const relatedProducts = useMemo(() => {
    if (!product) return [];

    // If allPicks provided, filter out current and pick 4 different items
    if (allPicks && allPicks.length > 0) {
      const candidates = allPicks.filter(p => p.id !== product.id && p.image_url);
      const hash = product.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
      const offset = hash % Math.max(candidates.length, 1);
      const picked: TradeProductLightboxItem[] = [];
      for (let i = 0; i < Math.min(4, candidates.length); i++) {
        picked.push(candidates[(offset + i) % candidates.length]);
      }
      return picked;
    }

    // Fallback: trade catalog
    return tradeProds
      .filter(p => p.brand_name === product.brand_name && p.id !== product.id && p.image_url)
      .slice(0, 4)
      .map(p => ({
        id: p.id,
        product_name: p.product_name,
        subtitle: p.subtitle,
        image_url: p.image_url,
        hover_image_url: p.hover_image_url,
        brand_name: p.brand_name,
        materials: p.materials,
        dimensions: p.dimensions,
        category: p.category,
        subcategory: p.subcategory,
      } as TradeProductLightboxItem));
  }, [product?.id, product?.brand_name, allPicks, tradeProds]);

  if (!product) return null;

  const canShowHoverImage = Boolean(product.hover_image_url) && !isMobile;
  const pinned = isPinned(product.product_name, product.id);
  const designerDisplay = product.brand_name.includes(" - ")
    ? product.brand_name.split(" - ")[0].trim()
    : product.brand_name;

  // Variant axes — drives Base/Top/Size dropdowns when size_variants are present
  const axes = computeVariantAxes(product.size_variants ?? []);
  const hasDualSize = axes.dualSizeOptions.length > 1;
  const variantsList = product.size_variants || [];
  const selectedBase = baseIdx != null && baseIdx >= 0 ? axes.baseOptions[baseIdx] : null;
  const selectedTop = topIdx != null && topIdx >= 0 ? axes.topOptions[topIdx] : null;
  const selectedSize = sizeIdx != null && sizeIdx >= 0 ? axes.dualSizeOptions[sizeIdx] : null;
  const matchesDual = (
    v: { label?: string; base?: string; top?: string },
    b: string | null,
    t: string | null,
    s: string | null,
  ) =>
    (b == null || (v.base || "").trim() === b) &&
    (t == null || (v.top || "").trim() === t) &&
    (s == null || (v.label || "").trim() === s);
  const disabledBaseIdx = axes.isDualAxis && selectedSize
    ? axes.baseOptions.map((b, i) => (variantsList.some((v) => matchesDual(v, b, null, selectedSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledTopIdx = axes.isDualAxis && selectedSize
    ? axes.topOptions.map((t, i) => (variantsList.some((v) => matchesDual(v, null, t, selectedSize)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const disabledDualSizeIdx = axes.isDualAxis && (selectedBase || selectedTop)
    ? axes.dualSizeOptions.map((s, i) => (variantsList.some((v) => matchesDual(v, selectedBase, selectedTop, s)) ? -1 : i)).filter((i) => i >= 0)
    : [];
  const clearAllDualSelections = () => {
    setBaseIdx(null);
    setTopIdx(null);
    setSizeIdx(null);
  };
  const currencySymbol = (() => {
    switch ((product.currency || "EUR").toUpperCase()) {
      case "USD": return "$";
      case "GBP": return "£";
      case "EUR": default: return "€";
    }
  })();

  // Find the matching variant for the current selection
  const selectedVariant = (() => {
    if (!axes.hasVariants) return null;
    const variants = product.size_variants || [];
    if (axes.isDualAxis) {
      if (!selectedBase || !selectedTop || (hasDualSize && !selectedSize)) return null;
      return variants.find(v =>
        (v.base || "").trim() === selectedBase &&
        (v.top || "").trim() === selectedTop &&
        (!hasDualSize || (v.label || "").trim() === selectedSize)
      ) || null;
    }
    if (axes.isBaseOnly) {
      const base = baseIdx != null && baseIdx >= 0 ? axes.baseOptions[baseIdx] : null;
      if (!base) return null;
      return variants.find(v => (v.base || "").trim() === base) || null;
    }
    // single-axis label
    if (sizeIdx != null && sizeIdx >= 0) {
      return variants[sizeIdx] || null;
    }
    return null;
  })();

  const livePrice = selectedVariant?.price_cents
    ? `${currencySymbol}${(selectedVariant.price_cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : product.price;


  const compareItem: CompareItem = {
    pick: {
      title: product.product_name,
      subtitle: product.subtitle,
      image: product.image_url || "",
      hoverImage: product.hover_image_url,
      materials: product.materials,
      dimensions: product.dimensions,
      category: product.category,
      subcategory: product.subcategory,
    },
    designerName: designerDisplay,
    designerId: product.id,
    section: "designers",
    price: product.price,
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-stretch md:items-center justify-center md:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
          className="relative max-w-4xl w-full h-[100dvh] md:h-auto md:max-h-[90vh] flex flex-col md:flex-row bg-background/85 backdrop-blur-xl md:rounded-xl rounded-none shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile header: drag indicator + close */}
          <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 pt-3 pb-2 bg-background/90 backdrop-blur-sm border-b border-border/60">
            <div className="w-8" />
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-foreground/15 text-foreground hover:bg-foreground/25 transition-all"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          {/* Desktop close button */}
          <button
            onClick={onClose}
            className="hidden md:flex absolute top-3 right-3 z-20 p-2 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Image */}
          <div
            className="relative w-full md:w-1/2 flex-1 md:flex-none md:min-h-[400px] md:h-auto bg-muted/30 flex items-center justify-center shrink-0 p-2 md:p-0"
            onMouseEnter={() => {
              if (canShowHoverImage) setShowHoverImage(true);
            }}
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
                  src={product.image_url}
                  alt={product.product_name}
                  onLoad={() => {
                    setImageLoaded(true);
                    setImageFailed(false);
                  }}
                  onError={() => {
                    setImageFailed(true);
                    setImageLoaded(true);
                    setShowHoverImage(false);
                  }}
                  className={cn(
                    "w-full h-full object-contain transition-opacity duration-300",
                    imageFailed
                      ? "opacity-0"
                      : !imageLoaded
                        ? "opacity-0"
                        : showHoverImage && canShowHoverImage && hoverImageLoaded
                          ? "opacity-0"
                          : "opacity-100"
                  )}
                  style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                />
                {canShowHoverImage && product.hover_image_url && (
                  <img
                    src={product.hover_image_url}
                    alt={`${product.product_name} in context`}
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
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-body text-sm text-muted-foreground">No image</span>
              </div>
            )}

            {/* Description overlay on image */}
            <div className="absolute top-3 right-3 z-20">
              <LightboxDescriptionDropdown description={product.description} />
            </div>

            {/* Mobile: secondary action icons overlaid on image bottom-left */}
            <div className="md:hidden absolute bottom-3 left-3 z-10 flex gap-3.5">
              <button
                onClick={async () => {
                  if (!product) return;
                  const realId = await toggleFavorite(product.id, {
                    product_name: product.product_name,
                    brand_name: product.brand_name,
                    category: product.category,
                    image_url: product.image_url,
                    dimensions: product.dimensions,
                    materials: product.materials,
                  });
                  setLastFavRealId(realId);
                }}
                title={product && isFavorited(product.id) ? "Favorited" : "Favorite"}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md transition-all shadow-md",
                  product && isFavorited(product.id)
                    ? "bg-destructive/80 text-white"
                    : "bg-background/70 text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart size={15} className={cn(product && isFavorited(product.id) && "fill-current")} />
              </button>

              {product && isFavorited(product.id) && (
                <AddToProjectPopover productId={lastFavRealId || product.id} productName={product.product_name}>
                  <button
                    title="Add to Project"
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-background/70 backdrop-blur-md text-muted-foreground hover:text-foreground transition-all shadow-md"
                  >
                    <FolderOpen size={15} />
                  </button>
                </AddToProjectPopover>
              )}

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

              {product.pdf_url && (
                <a
                  href={buildSpecSheetUrl(product.pdf_url, designerDisplay, product.product_name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Spec Sheet"
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-[hsl(var(--pdf-red))] backdrop-blur-md text-white transition-all shadow-md"
                >
                  <FileDown size={15} />
                </a>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="flex-1 p-5 md:p-8 flex flex-col gap-3 md:gap-4 overflow-y-auto">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gold))]">
                {designerDisplay}
              </p>
              <h2 className="font-display text-lg md:text-2xl text-foreground mt-1 leading-tight">
                {product.subtitle
                  ? `${product.product_name} ${product.subtitle}`
                  : product.product_name}
              </h2>
            </div>

            <div className="flex flex-col">
              {axes.hasVariants && axes.isDualAxis ? (
                <>
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={axes.baseOptions.join("\n")}
                    placeholder={getBasePlaceholder(product)}
                    emphasized
                    value={baseIdx}
                    onChange={(idx) => {
                      if (idx < 0) {
                        clearAllDualSelections();
                        return;
                      }
                      const nextBase = axes.baseOptions[idx] ?? null;
                      let nextTop = selectedTop;
                      let nextSize = selectedSize;
                      if (nextBase && nextTop && !variantsList.some((v) => matchesDual(v, nextBase, nextTop, nextSize))) {
                        setTopIdx(null);
                        nextTop = null;
                      }
                      if (nextBase && nextSize && !variantsList.some((v) => matchesDual(v, nextBase, nextTop, nextSize))) {
                        setSizeIdx(null);
                        nextSize = null;
                      }
                      if (nextBase && !nextTop) {
                        const compatTopIdx = axes.topOptions.findIndex((t) => variantsList.some((v) => matchesDual(v, nextBase, t, nextSize)));
                        if (compatTopIdx >= 0 && axes.topOptions.filter((t) => variantsList.some((v) => matchesDual(v, nextBase, t, nextSize))).length === 1) {
                          setTopIdx(compatTopIdx);
                        }
                      }
                      setBaseIdx(idx);
                    }}
                    disabledIndices={disabledBaseIdx}
                  />
                  <ExpandableSpec
                    icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                    text={axes.topOptions.join("\n")}
                    placeholder={getTopPlaceholder(product)}
                    emphasized
                    value={topIdx}
                    onChange={(idx) => {
                      if (idx < 0) {
                        clearAllDualSelections();
                        return;
                      }
                      const nextTop = axes.topOptions[idx] ?? null;
                      let nextBase = selectedBase;
                      let nextSize = selectedSize;
                      if (nextTop && nextBase && !variantsList.some((v) => matchesDual(v, nextBase, nextTop, nextSize))) {
                        setBaseIdx(null);
                        nextBase = null;
                      }
                      if (nextTop && nextSize && !variantsList.some((v) => matchesDual(v, nextBase, nextTop, nextSize))) {
                        setSizeIdx(null);
                        nextSize = null;
                      }
                      if (nextTop && !nextBase) {
                        const compatBaseIdx = axes.baseOptions.findIndex((b) => variantsList.some((v) => matchesDual(v, b, nextTop, nextSize)));
                        if (compatBaseIdx >= 0 && axes.baseOptions.filter((b) => variantsList.some((v) => matchesDual(v, b, nextTop, nextSize))).length === 1) {
                          setBaseIdx(compatBaseIdx);
                        }
                      }
                      setTopIdx(idx);
                    }}
                    disabledIndices={disabledTopIdx}
                  />
                  {hasDualSize && (
                    <ExpandableSpec
                      icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                      text={axes.dualSizeOptions.join("\n")}
                      placeholder="Select your size"
                      emphasized
                      value={sizeIdx}
                      onChange={(idx) => {
                        if (idx < 0) {
                          clearAllDualSelections();
                          return;
                        }
                        const nextSize = axes.dualSizeOptions[idx] ?? null;
                        if (nextSize && selectedBase && !variantsList.some((v) => matchesDual(v, selectedBase, selectedTop, nextSize))) setBaseIdx(null);
                        if (nextSize && selectedTop && !variantsList.some((v) => matchesDual(v, selectedBase, selectedTop, nextSize))) setTopIdx(null);
                        setSizeIdx(idx);
                      }}
                      disabledIndices={disabledDualSizeIdx}
                    />
                  )}
                </>
              ) : axes.hasVariants && axes.isBaseOnly ? (
                <ExpandableSpec
                  icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                  text={axes.baseOptions.join("\n")}
                  placeholder={getBasePlaceholder(product)}
                  emphasized
                  value={baseIdx}
                  onChange={setBaseIdx}
                />
              ) : axes.hasVariants ? (
                <ExpandableSpec
                  icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                  text={(product.size_variants || []).map(v => v.label || "").filter(Boolean).join("\n")}
                  placeholder={getMaterialPlaceholder(product)}
                  emphasized
                  value={sizeIdx}
                  onChange={setSizeIdx}
                />
              ) : (
                <>
                  {product.materials && (
                    <ExpandableSpec
                      icon={<Layers size={14} className="text-[hsl(var(--gold))]" />}
                      text={product.materials}
                      placeholder="Select your material choice"
                      autoSplit
                    />
                  )}
                  {product.dimensions && (
                    <ExpandableSpec
                      icon={<Ruler size={14} className="text-[hsl(var(--gold))]" />}
                      text={formatDimensionsMultiline(product.dimensions)}
                      emphasized
                      placeholder="Select your size"
                    />
                  )}
                </>
              )}
            </div>


            {livePrice && (
              <p className="font-display text-base md:text-lg text-accent font-semibold">
                {livePrice}
              </p>
            )}

            {/* Actions */}
            <div className="mt-auto pt-3 md:pt-4 flex flex-col gap-2">
              {/* Primary CTA */}
              <button
                onClick={() => onAddToQuote(product)}
                disabled={isAdding}
                className={cn(
                  "flex items-center justify-center gap-2 px-5 py-3 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all w-full",
                  isAdded
                    ? "bg-emerald-600 text-white"
                    : "bg-foreground text-background hover:bg-foreground/90",
                  "disabled:opacity-60"
                )}
              >
                {isAdding ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isAdded ? (
                  <Check size={14} />
                ) : (
                  <ShoppingCart size={14} />
                )}
                {isAdded ? "Added to Quote" : "Add to Quote"}
              </button>

              {/* Secondary actions — desktop only (mobile icons are on the image) */}
              <div className="hidden md:flex gap-2">
                {/* Favorite */}
                <button
                  onClick={async () => {
                    if (!product) return;
                    const realId = await toggleFavorite(product.id, {
                      product_name: product.product_name,
                      brand_name: product.brand_name,
                      category: product.category,
                      image_url: product.image_url,
                      dimensions: product.dimensions,
                      materials: product.materials,
                    });
                    setLastFavRealId(realId);
                  }}
                  title={product && isFavorited(product.id) ? "Favorited" : "Favorite"}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                    product && isFavorited(product.id)
                      ? "border-destructive/30 text-destructive bg-destructive/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <Heart size={13} className={cn(product && isFavorited(product.id) && "fill-current")} />
                  {product && isFavorited(product.id) ? "Favorited" : "Favorite"}
                </button>

                {/* Add to Project */}
                {product && isFavorited(product.id) && (
                  <AddToProjectPopover productId={lastFavRealId || product.id} productName={product.product_name}>
                    <button
                      title="Add to Project"
                      className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    >
                      <FolderOpen size={13} />
                      Add to Project
                    </button>
                  </AddToProjectPopover>
                )}

                {/* Pin to Selection */}
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

                {/* Spec Sheet */}
                {product.pdf_url && (
                  <a
                    href={buildSpecSheetUrl(product.pdf_url, designerDisplay, product.product_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Spec Sheet"
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border border-[hsl(var(--pdf-red))]/30 text-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/10 hover:border-[hsl(var(--pdf-red))]"
                  >
                    <FileDown size={13} />
                    Spec Sheet
                  </a>
                )}
              </div>

              {/* More from this brand */}
              {relatedProducts.length > 0 && (
                <div className="pt-4 border-t border-border">
                  <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">
                    More from {designerDisplay}
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                    {relatedProducts.map(rp => (
                      <button
                        key={rp.id}
                        onClick={() => onSelectRelated?.(rp)}
                        className="shrink-0 w-20 group"
                      >
                        <div className="aspect-square rounded-md overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/30 transition-colors">
                          <img
                            src={rp.image_url!}
                            alt={rp.product_name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <p className="font-body text-[9px] text-muted-foreground mt-1 truncate group-hover:text-foreground transition-colors">
                          {rp.product_name}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default TradeProductLightbox;
