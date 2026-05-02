import React, { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import SliderDots from "@/components/ui/SliderDots";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useLightboxSwipe } from "@/hooks/useLightboxSwipe";

interface ProductImageGalleryProps {
  images: string[];
  alt: string;
  overlay?: React.ReactNode;
  /** Badge rendered top-left of the main image, only when the first photo is active. */
  firstImageBadge?: React.ReactNode;
  /** Optional controlled active index. When provided, the gallery jumps to it whenever it changes. */
  activeIndex?: number;
  /**
   * Optional bump counter. Incrementing this forces the gallery to re-sync to
   * `activeIndex` even when the numeric value is identical to the previous one
   * (e.g. user re-selects the same finish after manually scrolling away).
   */
  activeIndexNonce?: number;
  /** Notifies the parent whenever the active index changes (thumbnail click, arrow nav, dot, etc.) so parent state stays in sync. */
  onIndexChange?: (index: number) => void;
}

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({ images, alt, overlay, firstImageBadge, activeIndex: controlledIndex, activeIndexNonce, onIndexChange }) => {
  const [activeIndex, setActiveIndex] = useState(controlledIndex ?? 0);

  // Sync with external controlled index. Re-runs whenever the index *or* the
  // nonce changes, so parent-initiated re-selections always force a jump even
  // if the numeric index hasn't moved.
  useEffect(() => {
    if (controlledIndex != null) {
      setActiveIndex(Math.max(0, Math.min(controlledIndex, images.length - 1)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controlledIndex, activeIndexNonce]);

  const [zoomOpen, setZoomOpen] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const goTo = useCallback((i: number) => {
    const next = Math.max(0, Math.min(i, images.length - 1));
    setActiveIndex(next);
    onIndexChange?.(next);
  }, [images.length, onIndexChange]);

  const updateScrollState = useCallback(() => {
    const el = thumbsRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 2);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = thumbsRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, images.length]);

  // Keep active thumbnail in view when navigating with arrows
  useEffect(() => {
    const el = thumbsRef.current;
    if (!el) return;
    const child = el.children[activeIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  const scrollThumbs = (dir: "up" | "down") => {
    const el = thumbsRef.current;
    if (!el) return;
    const delta = (el.clientHeight * 0.8) * (dir === "up" ? -1 : 1);
    el.scrollBy({ top: delta, behavior: "smooth" });
  };

  if (images.length === 0) return null;

  return (
    <div className="flex gap-4">
      {/* Vertical thumbnails — scrollable carousel (cap at 5 visible) */}
      {images.length > 1 && (
        <div className="hidden md:flex flex-col w-20 shrink-0 relative">

          {/* Up arrow */}
          <button
            type="button"
            onClick={() => scrollThumbs("up")}
            disabled={!canScrollUp}
            aria-label="Scroll thumbnails up"
            className={cn(
              "h-7 w-full flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm border border-border/50 mb-1 transition-opacity",
              canScrollUp ? "opacity-100 hover:bg-background" : "opacity-0 pointer-events-none"
            )}
          >
            <ChevronUp size={16} className="text-foreground" />
          </button>

          <div
            ref={thumbsRef}
            className="overflow-y-auto flex flex-col gap-2 scrollbar-hide scroll-smooth"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              // Exactly 5 thumbnails (5rem each) + 4 gaps (0.5rem each) = 27rem
              maxHeight: "27rem",
            }}
          >
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={cn(
                  "aspect-square rounded-md overflow-hidden border-2 transition-all shrink-0",
                  i === activeIndex
                    ? "border-foreground"
                    : "border-border hover:border-foreground/30"
                )}
              >
                <img
                  src={img}
                  alt=""
                  className="w-full h-full object-cover"
                  loading={i < 5 || Math.abs(i - activeIndex) <= 2 ? "eager" : "lazy"}
                  fetchPriority={
                    i === activeIndex
                      ? "high"
                      : Math.abs(i - activeIndex) <= 2
                        ? "high"
                        : "auto"
                  }
                  decoding="async"
                />
              </button>
            ))}
          </div>

          {/* Down arrow */}
          <button
            type="button"
            onClick={() => scrollThumbs("down")}
            disabled={!canScrollDown}
            aria-label="Scroll thumbnails down"
            className={cn(
              "h-7 w-full flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm border border-border/50 mt-1 transition-opacity",
              canScrollDown ? "opacity-100 hover:bg-background" : "opacity-0 pointer-events-none"
            )}
          >
            <ChevronDown size={16} className="text-foreground" />
          </button>
        </div>
      )}

      {/* Main image with arrows */}
      <div className="flex-1 relative group">
        <div className="aspect-square bg-muted/10 rounded-2xl overflow-hidden relative">
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Expand image"
            className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit] p-0 cursor-zoom-in"
          >
            <img
              src={images[activeIndex]}
              alt={alt}
              className="max-w-full max-h-full object-contain rounded-2xl"
              style={{ filter: "brightness(1.05) contrast(1.08) saturate(1.05)" }}
            />
          </button>
          {/* Expand affordance */}
          <div className="absolute bottom-3 right-3 z-10 pointer-events-none">
            <div className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Maximize2 size={14} className="text-foreground" />
            </div>
          </div>
        </div>
          {overlay && (
            <div className="absolute top-3 right-3 z-20 pointer-events-none">
              <div className="pointer-events-auto">{overlay}</div>
            </div>
          )}
          {firstImageBadge && activeIndex === 0 && (
            <div className="absolute top-3 left-3 z-20 pointer-events-none">
              <div className="pointer-events-auto">{firstImageBadge}</div>
            </div>
          )}

          {/* Preload neighboring main images so navigation feels instant */}
          <div aria-hidden="true" className="hidden">
            {[1, 2].map((offset) => {
              const next = images[activeIndex + offset];
              const prev = images[activeIndex - offset];
              return (
                <React.Fragment key={offset}>
                  {next && (
                    <img
                      src={next}
                      alt=""
                      loading="eager"
                      fetchPriority="high"
                      decoding="async"
                    />
                  )}
                  {prev && (
                    <img
                      src={prev}
                      alt=""
                      loading="eager"
                      fetchPriority={offset === 1 ? "high" : "auto"}
                      decoding="async"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className={cn(
                "absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center transition-opacity",
                activeIndex === 0 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <ChevronLeft size={18} className="text-foreground" />
            </button>
            <button
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === images.length - 1}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center transition-opacity",
                activeIndex === images.length - 1 ? "opacity-0 pointer-events-none" : "opacity-0 group-hover:opacity-100"
              )}
            >
              <ChevronRight size={18} className="text-foreground" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        <SliderDots
          count={images.length}
          activeIndex={activeIndex}
          onSelect={goTo}
          variant="light"
          ariaPrefix="View image"
          className="absolute bottom-3 left-1/2 -translate-x-1/2"
        />
      </div>

      {/* Fullscreen lightbox */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent
          hideClose
          className="max-w-[100vw] w-screen h-screen p-0 bg-background/95 backdrop-blur-sm border-0 rounded-none flex items-center justify-center sm:rounded-none"
        >
          <VisuallyHidden>
            <DialogTitle>{alt}</DialogTitle>
          </VisuallyHidden>
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors"
          >
            <X size={18} className="text-foreground" />
          </button>
          <img
            src={images[activeIndex]}
            alt={alt}
            className="max-w-[95vw] max-h-[92vh] object-contain"
          />
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goTo(activeIndex - 1); }}
                disabled={activeIndex === 0}
                aria-label="Previous image"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft size={20} className="text-foreground" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); goTo(activeIndex + 1); }}
                disabled={activeIndex === images.length - 1}
                aria-label="Next image"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background disabled:opacity-30 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight size={20} className="text-foreground" />
              </button>
              <SliderDots
                count={images.length}
                activeIndex={activeIndex}
                onSelect={goTo}
                variant="dark"
                ariaPrefix="View image"
                className="absolute bottom-6 left-1/2 -translate-x-1/2"
              />
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductImageGallery;
