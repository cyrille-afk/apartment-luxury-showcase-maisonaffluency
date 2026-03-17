import { motion, AnimatePresence } from "framer-motion";
import { X, Scale, ShoppingCart, Check, FileDown, Layers, Ruler, Loader2 } from "lucide-react";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

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
}

const TradeProductLightbox = ({ product, onClose, onAddToQuote, isAdding, isAdded }: TradeProductLightboxProps) => {
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const [showHoverImage, setShowHoverImage] = useState(false);

  useEffect(() => {
    setShowHoverImage(false);
  }, [product?.id]);

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
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
          className="relative max-w-4xl w-full max-h-[90vh] flex flex-col md:flex-row bg-background/85 backdrop-blur-xl rounded-lg overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
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
            className="relative w-full md:w-1/2 aspect-square md:aspect-auto bg-muted/30 flex items-center justify-center shrink-0"
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
                    "max-w-[90%] max-h-[90%] object-contain transition-opacity duration-300",
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
          <div className="flex-1 p-6 md:p-8 flex flex-col gap-4 overflow-y-auto">
            <div>
              <p className="font-body text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--gold))]">
                {designerDisplay}
              </p>
              <h2 className="font-display text-xl md:text-2xl text-foreground mt-1 leading-tight">
                {product.subtitle
                  ? `${product.product_name} ${product.subtitle}`
                  : product.product_name}
              </h2>
            </div>

            {product.materials && (
              <div className="flex gap-2 items-start">
                <Layers size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                <p className="font-body text-xs text-muted-foreground leading-relaxed">
                  {product.materials}
                </p>
              </div>
            )}

            {product.dimensions && (
              <div className="flex gap-2 items-start">
                <Ruler size={14} className="text-[hsl(var(--gold))] mt-0.5 shrink-0" />
                <p className="font-body text-sm text-foreground font-medium">
                  {product.dimensions}
                </p>
              </div>
            )}

            {product.category && (
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-body bg-muted text-muted-foreground rounded-full border border-border">
                  {product.category}
                </span>
                {product.subcategory && product.subcategory !== product.category && (
                  <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-body bg-muted text-muted-foreground rounded-full border border-border">
                    {product.subcategory}
                  </span>
                )}
              </div>
            )}

            {product.price && (
              <p className="font-display text-lg text-accent font-semibold">
                {product.price}
              </p>
            )}

            {/* Actions */}
            <div className="mt-auto pt-4 flex flex-col gap-2">
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

              <div className="flex gap-2">
                <button
                  onClick={() => togglePin(compareItem)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                    pinned
                      ? "bg-[hsl(var(--gold))]/10 border-[hsl(var(--gold))] text-[hsl(var(--gold))]"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    compareItems.length >= 3 && !pinned && "opacity-40 pointer-events-none"
                  )}
                >
                  <Scale size={14} />
                  {pinned ? "Pinned" : "Pin to Selection"}
                </button>

                {product.pdf_url && (
                  <a
                    href={product.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                  >
                    <FileDown size={14} />
                    Spec Sheet
                  </a>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default TradeProductLightbox;
