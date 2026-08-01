import React, { useState, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2, Expand, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import SliderDots from "@/components/ui/SliderDots";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useLightboxSwipe } from "@/hooks/useLightboxSwipe";
import PresentationMode from "@/components/product/PresentationMode";


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
  /** Optional caption displayed below the active image. */
  caption?: string | null;
  /** When true, shrinks the mobile main image height (used while user scrolls past the gallery). */
  compact?: boolean;
  /** Extra items appended to the mobile "more" menu (e.g. Share). */
  mobileMenuItems?: React.ReactNode;
}


/**
 * Main-image renderer with a smooth cross-dissolve between sources.
 * Selecting a new finish/size swaps the hero photo by fading the incoming
 * frame over the outgoing one (never a hard jump), mirroring native
 * iOS/Android transition feel. The incoming image is decoded before the
 * fade starts so the dissolve never flashes an empty frame.
 */
const CrossfadeImage: React.FC<{ src: string; alt: string; pointerEventsNone?: boolean }> = ({
  src,
  alt,
  pointerEventsNone,
}) => {
  // The outgoing frame stays fully opaque underneath; only the incoming frame
  // fades in on top. Cross-dissolving *both* layers made the dark backdrop
  // show through mid-transition, which read as a flicker on each swipe.
  const [current, setCurrent] = useState(src);
  const [incoming, setIncoming] = useState<string | null>(null);
  const [fading, setFading] = useState(false);
  const settleRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (src === current) {
      setIncoming(null);
      setFading(false);
      return;
    }
    // A new source arriving mid-fade: commit the in-flight frame first so we
    // never stack three layers or snap back to a stale photo.
    settleRef.current();
    let cancelled = false;
    setIncoming(src);
    setFading(false);
    const start = () => {
      if (cancelled) return;
      requestAnimationFrame(() => !cancelled && setFading(true));
    };
    const preload = new Image();
    preload.src = src;
    if (preload.decode) preload.decode().then(start).catch(start);
    else {
      preload.onload = start;
      preload.onerror = start;
    }
    // Safety net if neither decode nor load resolves promptly.
    const t = window.setTimeout(start, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const settle = useCallback(() => {
    setIncoming((inc) => {
      if (!inc) return null;
      setCurrent(inc);
      setFading(false);
      return null;
    });
  }, []);
  settleRef.current = settle;

  // `transitionend` never fires for a hidden container (the desktop layer on a
  // phone, and vice-versa), so also settle on a timer matching the fade.
  useEffect(() => {
    if (!incoming || !fading) return;
    const t = window.setTimeout(settle, 400);
    return () => window.clearTimeout(t);
  }, [incoming, fading, settle]);


  const base = cn(
    "max-w-full max-h-full object-contain rounded-luxury-sharp",
    pointerEventsNone && "pointer-events-none"
  );

  return (
    <span className="absolute inset-0 flex items-center justify-center">
      <img
        src={current}
        alt={alt}
        draggable={false}
        className={cn(base, "opacity-100")}
      />
      {incoming && (
        <img
          src={incoming}
          alt=""
          aria-hidden="true"
          draggable={false}
          onTransitionEnd={settle}
          className={cn(
            base,
            "absolute transition-opacity duration-300 ease-out",
            fading ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </span>
  );
};



const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({ images, alt, overlay, firstImageBadge, activeIndex: controlledIndex, activeIndexNonce, onIndexChange, caption, compact, mobileMenuItems }) => {

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
  const [presentOpen, setPresentOpen] = useState(false);

  const thumbsRef = useRef<HTMLDivElement>(null);

  // Swipe support — wired to both the inline main image and the fullscreen lightbox.
  const inlineSwipeRef = useRef<HTMLDivElement>(null);
  const lightboxSwipeRef = useRef<HTMLDivElement>(null);
  const noZoomRef = useRef(false); // gallery doesn't pinch-zoom; required by hook signature.

  // When the active index changes because the user clicked/hovered a thumbnail
  // in the vertical strip, we must NOT scrollIntoView — doing so slides a
  // different thumb under the cursor and triggers a hover feedback loop that
  // keeps snapping the strip back to the top. Only auto-scroll for index
  // changes coming from arrows, swipes, dots, or the parent (finish sync).
  const suppressThumbAutoScrollRef = useRef(false);

  const goTo = useCallback((i: number, opts?: { fromThumbStrip?: boolean }) => {
    const next = Math.max(0, Math.min(i, images.length - 1));
    if (opts?.fromThumbStrip) suppressThumbAutoScrollRef.current = true;
    setActiveIndex(next);
    onIndexChange?.(next);
  }, [images.length, onIndexChange]);

  useLightboxSwipe({
    containerRef: inlineSwipeRef,
    enabled: images.length > 1 && !zoomOpen,
    imageZoomedRef: noZoomRef,
    onSwipeLeft: () => goTo(activeIndex + 1),
    onSwipeRight: () => goTo(activeIndex - 1),
  });

  useLightboxSwipe({
    containerRef: lightboxSwipeRef,
    enabled: images.length > 1 && zoomOpen,
    imageZoomedRef: noZoomRef,
    onSwipeLeft: () => goTo(activeIndex + 1),
    onSwipeRight: () => goTo(activeIndex - 1),
  });

  // Keep active thumbnail in view when navigating with arrows/swipes/dots.
  // Skip when the change originated from clicking/hovering a thumbnail — the
  // user is already looking at that thumb, and scrolling it would create a
  // hover feedback loop that snaps the strip back to the top.
  useEffect(() => {
    if (suppressThumbAutoScrollRef.current) {
      suppressThumbAutoScrollRef.current = false;
      return;
    }
    const el = thumbsRef.current;
    if (!el) return;
    const child = el.children[activeIndex] as HTMLElement | undefined;
    child?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  // ---- Hover-triggered micro-scrolling on the vertical thumbnail column ----
  const hoverScrollRafRef = useRef<number | null>(null);
  const hoverScrollDirRef = useRef(0); // -1 up, 1 down, 0 idle

  const stopHoverScroll = useCallback(() => {
    hoverScrollDirRef.current = 0;
    if (hoverScrollRafRef.current != null) {
      cancelAnimationFrame(hoverScrollRafRef.current);
      hoverScrollRafRef.current = null;
    }
  }, []);

  const runHoverScroll = useCallback(() => {
    const el = thumbsRef.current;
    const dir = hoverScrollDirRef.current;
    if (!el || dir === 0) {
      hoverScrollRafRef.current = null;
      return;
    }
    el.scrollTop += dir * 1.6; // slow, fluid drift
    hoverScrollRafRef.current = requestAnimationFrame(runHoverScroll);
  }, []);

  const handleThumbHoverMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = thumbsRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.height === 0) return;
      const y = e.clientY - rect.top;
      const zone = rect.height * 0.2;
      let dir = 0;
      if (y <= zone && el.scrollTop > 0) dir = -1;
      else if (y >= rect.height - zone && el.scrollTop < el.scrollHeight - el.clientHeight) dir = 1;

      if (dir === 0) {
        stopHoverScroll();
        return;
      }
      hoverScrollDirRef.current = dir;
      if (hoverScrollRafRef.current == null) {
        hoverScrollRafRef.current = requestAnimationFrame(runHoverScroll);
      }
    },
    [runHoverScroll, stopHoverScroll]
  );

  useEffect(() => stopHoverScroll, [stopHoverScroll]);

  if (images.length === 0) return null;

  return (
    <div className="flex gap-4 items-stretch">
      {/* Vertical thumbnails — height-matched to the main image frame */}
      {images.length > 1 && (
        <div className="hidden md:block w-24 shrink-0 self-stretch relative">

          <div
            ref={thumbsRef}
            onMouseMove={handleThumbHoverMove}
            onMouseLeave={stopHoverScroll}
            className={cn(
              "absolute inset-0 overflow-y-scroll overscroll-contain flex flex-col scrollbar-hide [&::-webkit-scrollbar]:hidden",
              images.length > 4 ? "justify-start gap-3" : "justify-between gap-2"
            )}
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
              WebkitOverflowScrolling: "touch",
              // Luxury fade-out on the bottom-most visible thumbnail
              ...(images.length > 4
                ? {
                    WebkitMaskImage:
                      "linear-gradient(to bottom, #000 0%, #000 78%, rgba(0,0,0,0.25) 93%, transparent 100%)",
                    maskImage:
                      "linear-gradient(to bottom, #000 0%, #000 78%, rgba(0,0,0,0.25) 93%, transparent 100%)",
                  }
                : {}),
            }}
          >


            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => goTo(i, { fromThumbStrip: true })}
                onMouseEnter={() => goTo(i, { fromThumbStrip: true })}
                className={cn(
                  "aspect-square w-full max-h-24 rounded-luxury-sharp overflow-hidden border-2 transition-all shrink-0 grow-0",
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
        </div>

      )}

      {/* Main image + (mobile) thumb strip below */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
      <div className="relative group" ref={inlineSwipeRef}>
        <div className={cn("product-image-frame md:aspect-square md:h-auto bg-foreground/95 rounded-luxury-sharp overflow-hidden relative touch-pan-y transition-[height,aspect-ratio] duration-300 ease-out", compact && "product-image-frame--compact")}>
          {/* Desktop: whole image is a zoom trigger. Mobile: plain image so
              stray taps near the chevrons don't accidentally open the lightbox. */}
          <button
            type="button"
            onClick={() => setZoomOpen(true)}
            aria-label="Expand image"
            className="hidden md:flex absolute inset-0 items-center justify-center overflow-hidden rounded-[inherit] p-0 cursor-zoom-in"
          >
            <CrossfadeImage src={images[activeIndex]} alt={alt} />
          </button>
          {/* Mobile: no tap-to-zoom handler, but the image itself keeps pointer
              events so a tap-and-hold offers "Save to Photos" (designers treat
              their camera roll as an extension of the studio library). */}
          <div className="md:hidden absolute inset-0 flex items-center justify-center overflow-hidden rounded-[inherit]">
            <CrossfadeImage src={images[activeIndex]} alt={alt} />
          </div>

          {/* Mobile secondary actions live behind a single discreet "more" menu:
              presentation mode, expand and share — no competing circular chips. */}
          <div className="md:hidden absolute top-4 left-4 z-30">
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="More actions"
                className="w-9 h-9 rounded-full bg-background/25 backdrop-blur-md border border-border/25 flex items-center justify-center touch-manipulation"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal size={20} strokeWidth={1.5} className="text-foreground/80" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[190px]">
                <DropdownMenuItem onSelect={() => setPresentOpen(true)} className="gap-2.5 font-body text-[11px] uppercase tracking-[0.16em]">
                  <Expand size={16} strokeWidth={1.5} /> Presentation
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setZoomOpen(true)} className="gap-2.5 font-body text-[11px] uppercase tracking-[0.16em]">
                  <Maximize2 size={16} strokeWidth={1.5} /> Expand image
                </DropdownMenuItem>
                {mobileMenuItems}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>


          {/* Hover-to-navigate now lives on the vertical thumbnail strip (see above). */}

          {/* Expand affordance — desktop hover chip + discreet always-on mobile icon. */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:block">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setZoomOpen(true); }}
              aria-label="Expand image"
              className="w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center transition-opacity opacity-0 group-hover:opacity-100 touch-manipulation"
            >
              <Maximize2 size={14} strokeWidth={1.5} className="text-foreground" />
            </button>
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomOpen(true); }}
            aria-label="Expand image"
            className="md:hidden absolute bottom-3 right-3 z-30 w-8 h-8 rounded-full bg-background/25 backdrop-blur-md border border-border/25 flex items-center justify-center touch-manipulation"
          >
            <Maximize2 size={16} strokeWidth={1.5} className="text-foreground/80" />
          </button>
          {/* Fractional gallery counter — bottom-centre on mobile, bottom-right on desktop. */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:bottom-3 md:right-3 z-20 pointer-events-none">
              <span className="inline-block px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-luxury-micro bg-background/40 md:bg-background/60 backdrop-blur-md font-body text-[8px] md:text-[11px] font-light uppercase tracking-[0.12em] md:tracking-[0.18em] text-foreground/60 md:text-foreground/70 tabular-nums">
                {String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
              </span>
            </div>
          )}

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
        </div>

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

        {/* Prev / Next arrows — desktop only, revealed on hover */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => goTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              aria-label="Previous image"
              className={cn(
                "hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 items-center justify-center transition-opacity",
                activeIndex === 0 ? "opacity-0 pointer-events-none" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
              )}
            >
              <ChevronLeft size={20} className="text-foreground" />
            </button>
            <button
              onClick={() => goTo(activeIndex + 1)}
              disabled={activeIndex === images.length - 1}
              aria-label="Next image"
              className={cn(
                "hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 items-center justify-center transition-opacity",
                activeIndex === images.length - 1 ? "opacity-0 pointer-events-none" : "opacity-100 md:opacity-0 md:group-hover:opacity-100"
              )}
            >
              <ChevronRight size={20} className="text-foreground" />
            </button>
          </>
        )}

        </div>

        {/* Mobile/PWA horizontal progress line — rendered BELOW the image so it
            doesn't overlap the photo or the favorite/share icons. */}
        {images.length > 1 && (
          <div className="md:hidden mt-2 flex items-center gap-2 px-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`View image ${i + 1} of ${images.length}`}
                className={cn(
                  "flex-1 rounded-full transition-all duration-200",
                  i === activeIndex
                    ? "h-[3px] bg-foreground"
                    : "h-px bg-foreground/25"
                )}
              />
            ))}
          </div>
        )}

        {/* Caption */}
        {caption && (
          <p className="font-body text-xs text-muted-foreground text-center px-2 -mt-1">
            {caption}
          </p>
        )}

        {/* Mobile thumb strip removed — arrows on the main image + swipe handle navigation. */}
      </div>

      {/* Fullscreen lightbox */}
      <Dialog open={zoomOpen} onOpenChange={setZoomOpen}>
        <DialogContent
          hideClose
          className="max-w-[100vw] w-screen h-screen p-0 bg-background/95 backdrop-blur-sm border-0 rounded-luxury-sharp flex items-center justify-center sm:rounded-luxury-sharp touch-pan-y"
        >
          <div ref={lightboxSwipeRef} onClick={() => setZoomOpen(false)} className="absolute inset-0 cursor-zoom-out" aria-hidden="true" />
          <VisuallyHidden>
            <DialogTitle>{alt}</DialogTitle>
          </VisuallyHidden>
          <button
            type="button"
            onClick={() => setZoomOpen(false)}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); setZoomOpen(false); }}
            aria-label="Close"
            style={{ top: 'max(1rem, env(safe-area-inset-top))', right: 'max(1rem, env(safe-area-inset-right))' }}
            className="absolute z-[100] w-12 h-12 rounded-full bg-background/90 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors touch-manipulation"
          >
            <X size={20} className="text-foreground" />
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

      <PresentationMode
        open={presentOpen}
        images={images}
        alt={alt}
        index={activeIndex}
        onIndexChange={goTo}
        onClose={() => setPresentOpen(false)}
      />

    </div>
  );
};

export default ProductImageGallery;
