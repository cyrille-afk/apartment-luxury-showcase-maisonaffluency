import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Heart, ShoppingBag, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PublicLightboxItem } from "@/components/PublicProductLightbox";
import { optimizeImageUrl } from "@/lib/cloudinary-optimize";
import StudioSaveButton from "@/components/product/StudioSaveButton";
import { useAuth } from "@/hooks/useAuth";
import { stripOriginFromMaterials } from "@/lib/designerOrigin";

type Unit = "cm" | "in";

interface ParsedDims {
  w: number | null;
  d: number | null;
  h: number | null;
}

function parseDimensions(text: string | null | undefined): ParsedDims {
  if (!text) return { w: null, d: null, h: null };
  const normalized = text.replace(/\s+/g, " ").toLowerCase();
  const isMm = /\bmm\b/.test(normalized) && !/\bcm\b/.test(normalized);
  const grab = (letter: string): number | null => {
    const re = new RegExp(`${letter.toLowerCase()}\\s*([0-9]+(?:\\.[0-9]+)?)`, "i");
    const m = text.match(re);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    return isMm ? n / 10 : n;
  };
  return { w: grab("W"), d: grab("D"), h: grab("H") };
}

function toInches(cm: number | null): number | null {
  if (cm == null) return null;
  return Math.round(cm * 0.393701 * 10) / 10;
}

function formatDim(value: number | null, unit: Unit): string {
  if (value == null) return "—";
  const display = unit === "cm" ? value : toInches(value);
  if (display == null) return "—";
  return `${display}${unit === "cm" ? " cm" : '"'}`;
}

function ChairDimensionSvg({ dims, unit }: { dims: ParsedDims; unit: Unit }) {
  const hasW = dims.w != null;
  const hasD = dims.d != null;
  const hasH = dims.h != null;

  return (
    <svg viewBox="0 0 240 160" className="w-full h-auto" aria-hidden="true">
      {/* Subtle baseline */}
      <line x1="20" y1="140" x2="220" y2="140" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1" />

      {/* Chair silhouette — side/profile view */}
      <g fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.7">
        {/* Back legs */}
        <path d="M62 140 L62 78 L78 78 L78 140" />
        {/* Front legs */}
        <path d="M148 140 L148 78 L168 78 L168 140" />
        {/* Seat */}
        <path d="M58 78 L172 78 L180 92 L50 92 Z" />
        {/* Backrest */}
        <path d="M58 78 C58 30, 58 30, 58 30 L78 30 C78 30, 78 30, 78 78" />
        {/* Backrest crossbar */}
        <path d="M62 42 L74 42" />
        <path d="M62 54 L74 54" />
      </g>

      {/* Width dimension line (top of seat) */}
      {hasW && (
        <g>
          <line x1="50" y1="24" x2="180" y2="24" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="50" y1="20" x2="50" y2="28" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="180" y1="20" x2="180" y2="28" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <text x="115" y="18" textAnchor="middle" className="text-[8px] fill-current opacity-70" style={{ fontSize: 8 }}>
            W {formatDim(dims.w, unit)}
          </text>
        </g>
      )}

      {/* Depth dimension line (seat side) */}
      {hasD && (
        <g>
          <line x1="190" y1="78" x2="190" y2="92" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="186" y1="78" x2="194" y2="78" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="186" y1="92" x2="194" y2="92" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <text x="204" y="86" textAnchor="start" className="text-[8px] fill-current opacity-70" style={{ fontSize: 8 }}>
            D {formatDim(dims.d, unit)}
          </text>
        </g>
      )}

      {/* Height dimension line (overall) */}
      {hasH && (
        <g>
          <line x1="38" y1="30" x2="38" y2="140" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="34" y1="30" x2="42" y2="30" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <line x1="34" y1="140" x2="42" y2="140" stroke="currentColor" strokeWidth="1" strokeOpacity="0.5" />
          <text x="28" y="86" textAnchor="middle" className="text-[8px] fill-current opacity-70" style={{ fontSize: 8 }} transform="rotate(-90 28 86)">
            H {formatDim(dims.h, unit)}
          </text>
        </g>
      )}
    </svg>
  );
}

interface Props {
  pick: PublicLightboxItem | null;
  price?: string;
  onClose: () => void;
  onViewFull: () => void;
  onShare?: () => void;
}

export default function MobileQuickViewDrawer({ pick, price, onClose, onViewFull, onShare }: Props) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const x = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dimUnit, setDimUnit] = useState<Unit>("cm");

  const images = useMemo(() => {
    if (!pick) return [];
    const list: string[] = [];
    if (pick.image_url) list.push(pick.image_url);
    if (pick.hover_image_url && pick.hover_image_url !== pick.image_url) list.push(pick.hover_image_url);
    if (pick.gallery_images) {
      for (const url of pick.gallery_images) {
        if (url && !list.includes(url)) list.push(url);
      }
    }
    return list.length ? list : [pick.image_url];
  }, [pick]);

  const parsedDims = useMemo(() => parseDimensions(pick?.dimensions), [pick?.dimensions]);

  useEffect(() => {
    setIndex(0);
  }, [pick?.id]);

  useEffect(() => {
    if (!pick) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [pick]);

  useEffect(() => {
    const update = () => {
      if (trackRef.current) setTrackWidth(trackRef.current.offsetWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [pick]);

  const slideWidth = trackWidth || 0;
  const maxDrag = -(slideWidth * (images.length - 1));

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    if (!slideWidth) return;
    const currentX = x.get();
    const velocity = info.velocity.x;
    const offset = info.offset.x;
    let next = Math.round(-currentX / slideWidth);

    if (Math.abs(velocity) > 500) {
      next = velocity > 0 ? Math.floor(-currentX / slideWidth) : Math.ceil(-currentX / slideWidth);
    } else if (Math.abs(offset) > slideWidth * 0.25) {
      next = offset > 0 ? Math.floor(-currentX / slideWidth) : Math.ceil(-currentX / slideWidth);
    }

    next = Math.max(0, Math.min(images.length - 1, next));
    setIndex(next);
  };

  useEffect(() => {
    if (!isDragging && slideWidth) {
      x.set(-index * slideWidth);
    }
  }, [index, slideWidth, isDragging, x]);

  const handlePrev = () => setIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setIndex((i) => Math.min(images.length - 1, i + 1));

  const dotProgress = useTransform(x, [maxDrag, 0], [1, 0]);

  if (!pick) return null;

  const displayPrice = price || "Price upon request";

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-[60]"
      />
      <motion.div
        key="sheet"
        ref={containerRef}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.15}
        onDragEnd={(_, info) => {
          if (info.offset.y > 140 || (info.velocity.y > 600 && info.offset.y > 40)) {
            onClose();
          }
        }}
        className="fixed bottom-0 left-0 right-0 z-[70] bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] font-sans"
      >
        {/* Drag handle */}
        <div className="w-full pt-3 pb-1 flex justify-center shrink-0" onClick={onClose}>
          <div className="w-12 h-1 bg-muted-foreground/25 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-border/40 shrink-0">
          <div>
            <span className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
              Quick View
            </span>
            <h3 className="text-base font-display tracking-wide text-foreground mt-0.5 line-clamp-1">
              {pick.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-full bg-muted hover:bg-muted/70 text-muted-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto no-scrollbar flex-1">
          {/* Image carousel */}
          <div ref={trackRef} className="relative w-full aspect-[4/3] overflow-hidden bg-muted">
            <motion.div
              className="flex h-full"
              style={{ x, cursor: isDragging ? "grabbing" : "grab" }}
              drag="x"
              dragConstraints={{ left: maxDrag, right: 0 }}
              dragElastic={0.05}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={handleDragEnd}
            >
              {images.map((url, i) => (
                <div key={`${url}-${i}`} className="relative w-full h-full shrink-0 select-none">
                  <img
                    src={optimizeImageUrl(url)}
                    alt={`${pick.title} view ${i + 1}`}
                    className="w-full h-full object-cover pointer-events-none"
                    draggable={false}
                  />
                </div>
              ))}
            </motion.div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={index === 0}
                  aria-label="Previous image"
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 text-foreground shadow-sm disabled:opacity-30 transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={index === images.length - 1}
                  aria-label="Next image"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 text-foreground shadow-sm disabled:opacity-30 transition-opacity"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Paginated progress dots */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/20 backdrop-blur-md px-2.5 py-1.5 rounded-full">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={`Go to image ${i + 1}`}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-200",
                        index === i ? "w-4 bg-white" : "w-1.5 bg-white/50"
                      )}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Product details */}
          <div className="px-5 py-5 flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xl font-display tracking-tight text-foreground">{displayPrice}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-600 px-2 py-0.5 bg-emerald-50 rounded-sm">
                In Stock
              </span>
            </div>

            {pick.brand_name && (
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {pick.brand_name}
              </p>
            )}

            {pick.description && (
              <div>
                <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                  Product History
                </h4>
                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">
                  {pick.description}
                </p>
              </div>
            )}

            {pick.dimensions && (
              <div className="bg-muted/40 p-3 rounded-sm">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                    Dimensions
                  </h4>
                  <div
                    role="group"
                    aria-label="Switch dimension unit"
                    className="inline-flex border border-border rounded-sm overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setDimUnit("cm")}
                      aria-pressed={dimUnit === "cm"}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-medium transition-colors",
                        dimUnit === "cm" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      cm
                    </button>
                    <button
                      type="button"
                      onClick={() => setDimUnit("in")}
                      aria-pressed={dimUnit === "in"}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-medium transition-colors",
                        dimUnit === "in" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      in
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm font-medium text-foreground/90 mb-3">
                  {parsedDims.w != null && (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">W</span>
                      <span>{formatDim(parsedDims.w, dimUnit)}</span>
                    </div>
                  )}
                  {parsedDims.d != null && (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">D</span>
                      <span>{formatDim(parsedDims.d, dimUnit)}</span>
                    </div>
                  )}
                  {parsedDims.h != null && (
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">H</span>
                      <span>{formatDim(parsedDims.h, dimUnit)}</span>
                    </div>
                  )}
                </div>

                <div className="text-muted-foreground">
                  <ChairDimensionSvg dims={parsedDims} unit={dimUnit} />
                </div>
              </div>
            )}

            {pick.materials && (
              <div>
                <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">
                  Materials
                </h4>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  {pick.materials}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky action footer */}
        <div className="shrink-0 border-t border-border/40 px-4 py-3 bg-background">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onViewFull}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-foreground text-background px-4 py-3 text-[11px] uppercase tracking-[0.14em] font-medium active:scale-[0.98] transition-transform"
            >
              <ShoppingBag className="w-4 h-4" strokeWidth={1.5} />
              View Full Details
            </button>

            {user ? (
              <StudioSaveButton pickId={pick.id} productTitle={pick.title} className="w-11 h-11" />
            ) : (
              <button
                type="button"
                aria-label="Save to favorites"
                className="flex items-center justify-center w-11 h-11 border border-border text-foreground active:scale-95 transition-transform"
              >
                <Heart className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}

            <button
              type="button"
              onClick={onShare}
              aria-label="Share product"
              className="flex items-center justify-center w-11 h-11 border border-border text-foreground active:scale-95 transition-transform"
            >
              <Share2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
