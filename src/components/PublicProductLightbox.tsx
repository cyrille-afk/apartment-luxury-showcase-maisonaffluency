import { motion, AnimatePresence } from "framer-motion";
import { X, Layers, Ruler, FileDown, Heart, Scale, FolderOpen } from "lucide-react";
import { buildSpecSheetUrl } from "@/lib/specSheetUrl";
import { useCompare, type CompareItem } from "@/contexts/CompareContext";
import { useFavorites } from "@/hooks/useFavorites";
import AddToProjectPopover from "@/components/trade/AddToProjectPopover";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";
import { useState, useEffect, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

export interface PublicLightboxItem {
  id: string;
  title: string;
  subtitle?: string | null;
  image_url: string;
  hover_image_url?: string | null;
  brand_name: string;
  materials?: string | null;
  dimensions?: string | null;
  category?: string | null;
  subcategory?: string | null;
  pdf_url?: string | null;
}

interface Props {
  product: PublicLightboxItem | null;
  allPicks?: PublicLightboxItem[];
  onClose: () => void;
  onSelectRelated?: (item: PublicLightboxItem) => void;
}

const PublicProductLightbox = ({ product, allPicks = [], onClose, onSelectRelated }: Props) => {
  const isMobile = useIsMobile();
  const { isPinned, togglePin, items: compareItems } = useCompare();
  const { isFavorited, toggleFavorite } = useFavorites();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [showHoverImage, setShowHoverImage] = useState(false);
  const [hoverImageLoaded, setHoverImageLoaded] = useState(false);
  const [lastFavRealId, setLastFavRealId] = useState<string | null>(null);

  useEffect(() => {
    setImageLoaded(false);
    setImageFailed(false);
    setHoverImageLoaded(false);
    setShowHoverImage(false);
    setLastFavRealId(null);
  }, [product?.id]);

  useEffect(() => {
    if (!product) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [product]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return allPicks.filter((p) => p.id !== product.id && p.image_url).slice(0, 4);
  }, [product?.id, allPicks]);

  if (!product) return null;

  const canShowHoverImage = Boolean(product.hover_image_url) && !isMobile;
  const designerDisplay = product.brand_name.includes(" - ")
    ? product.brand_name.split(" - ")[0].trim()
    : product.brand_name;

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
          className="relative max-w-4xl w-full h-[100dvh] md:h-auto md:max-h-[90vh] flex flex-col md:flex-row bg-background/85 backdrop-blur-xl md:rounded-lg rounded-none shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile header */}
          <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 pt-3 pb-2 bg-background/90 backdrop-blur-sm border-b border-border/60">
            <div className="w-8" />
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            <button onClick={onClose} className="p-2 rounded-full bg-foreground/15 text-foreground hover:bg-foreground/25 transition-all" aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Desktop close */}
          <button onClick={onClose} className="hidden md:flex absolute top-3 right-3 z-20 p-2 rounded-full bg-foreground/10 text-foreground hover:bg-foreground/20 transition-all" aria-label="Close">
            <X size={18} />
          </button>

          {/* Image */}
          <div
            className="relative w-full md:w-1/2 flex-1 md:flex-none md:min-h-[400px] md:h-auto bg-muted/30 flex items-center justify-center shrink-0 p-2 md:p-0"
            onMouseEnter={() => { if (canShowHoverImage) setShowHoverImage(true); }}
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
                  alt={product.title}
                  onLoad={() => { setImageLoaded(true); setImageFailed(false); }}
                  onError={() => { setImageFailed(true); setImageLoaded(true); }}
                  className={cn(
                    "w-full h-full object-contain transition-opacity duration-300",
                    imageFailed ? "opacity-0"
                      : !imageLoaded ? "opacity-0"
                        : showHoverImage && canShowHoverImage && hoverImageLoaded ? "opacity-0"
                          : "opacity-100"
                  )}
                  style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
                />
                {canShowHoverImage && product.hover_image_url && (
                  <img
                    src={product.hover_image_url}
                    alt={`${product.title} in context`}
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
              <span className="font-body text-sm text-muted-foreground">No image</span>
            )}

            {/* Mobile: secondary action icons overlaid on image bottom-left */}
            <div className="md:hidden absolute bottom-3 left-3 z-10 flex gap-3.5">
              <button
                onClick={async () => {
                  const realId = await toggleFavorite(product.id, {
                    product_name: product.title,
                    brand_name: product.brand_name,
                    category: product.category || undefined,
                    image_url: product.image_url,
                    dimensions: product.dimensions,
                    materials: product.materials,
                  });
                  setLastFavRealId(realId);
                }}
                title={isFavorited(product.id) ? "Favorited" : "Favorite"}
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full backdrop-blur-md transition-all shadow-md",
                  isFavorited(product.id)
                    ? "bg-destructive/80 text-white"
                    : "bg-background/70 text-muted-foreground hover:text-foreground"
                )}
              >
                <Heart size={15} className={cn(isFavorited(product.id) && "fill-current")} />
              </button>

              {isFavorited(product.id) && (
                <AddToProjectPopover productId={lastFavRealId || product.id} productName={product.title}>
                  <button title="Add to Project" className="flex items-center justify-center w-9 h-9 rounded-full bg-background/70 backdrop-blur-md text-muted-foreground hover:text-foreground transition-all shadow-md">
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
                  href={buildSpecSheetUrl(product.pdf_url, designerDisplay, product.title)}
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
                  ? `${product.title} ${product.subtitle}`
                  : product.title}
              </h2>
            </div>

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

            <p className="font-display text-sm text-foreground mt-2">
              Price on request
            </p>

            {/* Desktop secondary actions */}
            <div className="hidden md:flex gap-2 flex-wrap">
              <button
                onClick={async () => {
                  const realId = await toggleFavorite(product.id, {
                    product_name: product.title,
                    brand_name: product.brand_name,
                    category: product.category || undefined,
                    image_url: product.image_url,
                    dimensions: product.dimensions,
                    materials: product.materials,
                  });
                  setLastFavRealId(realId);
                }}
                title={isFavorited(product.id) ? "Favorited" : "Favorite"}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border",
                  isFavorited(product.id)
                    ? "border-destructive/30 text-destructive bg-destructive/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                )}
              >
                <Heart size={13} className={cn(isFavorited(product.id) && "fill-current")} />
                {isFavorited(product.id) ? "Favorited" : "Favorite"}
              </button>

              {isFavorited(product.id) && (
                <AddToProjectPopover productId={lastFavRealId || product.id} productName={product.title}>
                  <button title="Add to Project" className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30">
                    <FolderOpen size={13} />
                    Add to Project
                  </button>
                </AddToProjectPopover>
              )}

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

              {product.pdf_url && (
                <a
                  href={buildSpecSheetUrl(product.pdf_url, designerDisplay, product.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-md font-body text-xs uppercase tracking-[0.12em] transition-all border border-[hsl(var(--pdf-red))]/30 text-[hsl(var(--pdf-red))] hover:bg-[hsl(var(--pdf-red))]/10 hover:border-[hsl(var(--pdf-red))]"
                >
                  <FileDown size={13} />
                  Spec Sheet
                </a>
              )}
            </div>

            {/* More from this designer */}
            {relatedProducts.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">
                  More from {designerDisplay}
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                  {relatedProducts.map((rp) => (
                    <button
                      key={rp.id}
                      onClick={() => onSelectRelated?.(rp)}
                      className="shrink-0 w-20 group"
                    >
                      <div className="aspect-square rounded-md overflow-hidden bg-muted/30 border border-border group-hover:border-foreground/30 transition-colors">
                        <img
                          src={rp.image_url}
                          alt={rp.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      <p className="font-body text-[9px] text-muted-foreground mt-1 truncate group-hover:text-foreground transition-colors">
                        {rp.title}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-4 border-t border-border">
              <p className="font-body text-[11px] text-muted-foreground">
                For pricing and availability, please{" "}
                <a href="/trade/program" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  join our Trade Program
                </a>.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
};

export default PublicProductLightbox;
