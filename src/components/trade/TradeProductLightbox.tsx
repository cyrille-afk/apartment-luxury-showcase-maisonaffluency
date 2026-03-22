import { motion, AnimatePresence } from "framer-motion";
import { X, Scale, ShoppingCart, Check, FileDown, Layers, Ruler, Loader2, Package, Heart, FolderOpen } from "lucide-react";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useFavorites } from "@/hooks/useFavorites";
import AddToProjectPopover from "@/components/trade/AddToProjectPopover";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getAllTradeProducts } from "@/lib/tradeProducts";

export interface TradeProductLightboxItem {
  id: string;
  product_name: string;
  subtitle?: string;
  image_url: string | null;
  hover_image_url?: string;
  brand_name: string;
  materials?: string | null;
  dimensions?: string | null;
  category?: string;
  subcategory?: string;
  pdf_url?: string | null;
  price?: string | null;
}

interface TradeProductLightboxProps {
  product: TradeProductLightboxItem | null;
  onClose: () => void;
  onAddToQuote: (product: TradeProductLightboxItem) => void;
  isAdding?: boolean;
  isAdded?: boolean;
  onSelectRelated?: (product: TradeProductLightboxItem) => void;
}

const TradeProductLightbox = ({ product, onClose, onAddToQuote, isAdding, isAdded, onSelectRelated }: TradeProductLightboxProps) => {
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();
  const [showHoverImage, setShowHoverImage] = useState(false);
  const [lastFavRealId, setLastFavRealId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Related products from same brand
  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const all = getAllTradeProducts();
    return all
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
  }, [product?.id, product?.brand_name]);

  if (!product) return null;

  const pinned = isPinned(product.product_name, product.id);
  const designerDisplay = product.brand_name.includes(" - ")
    ? product.brand_name.split(" - ")[0].trim()
    : product.brand_name;

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
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center md:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
          className="relative max-w-4xl w-full max-h-[92vh] md:max-h-[90vh] flex flex-col md:flex-row bg-background/85 backdrop-blur-xl md:rounded-lg rounded-t-2xl overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile drag indicator */}
          <div className="md:hidden flex justify-center pt-2 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
          </div>
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 p-2 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-all"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {/* Image */}
          <div
            className="relative w-full md:w-1/2 aspect-[3/2] md:aspect-auto bg-muted/30 flex items-center justify-center shrink-0 p-2 md:p-0"
            onMouseEnter={() => {
              if (product.hover_image_url) setShowHoverImage(true);
            }}
            onMouseLeave={() => setShowHoverImage(false)}
          >
            {product.image_url ? (
              <>
                <img
                  src={product.image_url}
                  alt={product.product_name}
                  className={cn(
                    "max-w-[96%] max-h-[96%] md:max-w-[90%] md:max-h-[90%] object-contain transition-opacity duration-300",
                    showHoverImage && product.hover_image_url ? "opacity-0" : "opacity-100"
                  )}
                  style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                />
                {product.hover_image_url && (
                  <img
                    src={product.hover_image_url}
                    alt={`${product.product_name} in context`}
                    className={cn(
                      "absolute inset-0 m-auto max-w-[90%] max-h-[90%] object-contain pointer-events-none transition-opacity duration-300",
                      showHoverImage ? "opacity-100" : "opacity-0"
                    )}
                  />
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="font-body text-sm text-muted-foreground">No image</span>
              </div>
            )}
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

            {/* Materials & Dimensions — compact row on mobile */}
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {product.materials && (
                <div className="flex gap-1.5 items-start">
                  <Layers size={12} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                  <p className="font-body text-[11px] md:text-xs text-muted-foreground leading-relaxed">
                    {product.materials}
                  </p>
                </div>
              )}
              {product.dimensions && (
                <div className="flex gap-1.5 items-start">
                  <Ruler size={12} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                  <p className="font-body text-[11px] md:text-sm text-foreground font-medium">
                    {product.dimensions}
                  </p>
                </div>
              )}
            </div>

            {product.price && (
              <p className="font-display text-base md:text-lg text-accent font-semibold">
                {product.price}
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

              {/* Secondary actions — icon buttons on mobile, text buttons on desktop */}
              <div className="flex gap-1.5 md:gap-2">
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
                    "flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md font-body text-[10px] md:text-xs uppercase tracking-[0.12em] transition-all border",
                    product && isFavorited(product.id)
                      ? "border-destructive/30 text-destructive bg-destructive/10"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  )}
                >
                  <Heart size={13} className={cn(product && isFavorited(product.id) && "fill-current")} />
                  <span className="hidden md:inline">{product && isFavorited(product.id) ? "Favorited" : "Favorite"}</span>
                </button>

                {/* Add to Project */}
                {product && isFavorited(product.id) && (
                  <AddToProjectPopover productId={lastFavRealId || product.id} productName={product.product_name}>
                    <button
                      title="Add to Project"
                      className="flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md font-body text-[10px] md:text-xs uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                    >
                      <FolderOpen size={13} />
                      <span className="hidden md:inline">Add to Project</span>
                    </button>
                  </AddToProjectPopover>
                )}

                {/* Pin to Selection */}
                <button
                  onClick={() => togglePin(compareItem)}
                  title={pinned ? "Pinned" : "Pin to Selection"}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md font-body text-[10px] md:text-xs uppercase tracking-[0.12em] transition-all border",
                    pinned
                      ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                  )}
                >
                  <Scale size={13} />
                  <span className="hidden md:inline">{pinned ? "Pinned" : "Pin to Selection"}</span>
                </button>

                {/* Spec Sheet */}
                {product.pdf_url && (
                  <a
                    href={buildSpecSheetUrl(product.pdf_url, designerDisplay, product.product_name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Spec Sheet"
                    className="flex items-center justify-center gap-1.5 px-3 py-2 md:px-4 md:py-2.5 rounded-md font-body text-[10px] md:text-xs uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  >
                    <FileDown size={13} />
                    <span className="hidden md:inline">Spec Sheet</span>
                  </a>
                )}
              </div>

              {/* Request Sample */}
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("product", product.product_name);
                  if (product.brand_name) params.set("brand", product.brand_name);
                  if (product.image_url) params.set("image", product.image_url);
                  if (product.pdf_url) params.set("tearsheet", product.pdf_url);
                  onClose();
                  navigate(`/trade/samples?${params.toString()}`);
                }}
                className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md font-body text-[10px] md:text-xs uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              >
                <Package size={13} />
                Request Sample
              </button>

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
