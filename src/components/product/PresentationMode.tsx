import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel from "embla-carousel-react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/bodyScrollLock";
import ActiveSwatchCaption from "./ActiveSwatchCaption";

interface PresentationModeProps {
  open: boolean;
  images: string[];
  alt: string;
  title?: string;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: (activeIndex: number) => void;
  pickId?: string | null;
  isMobileOrPwa?: boolean;
}

/**
 * Presentation Mode — the platform disappears.
 *
 * Full-bleed, chrome-free gallery for handing the phone to a client: no
 * pricing, no dimensions, no headers, no navigation. Swipe (or tap the
 * edges) to move between frames. Metadata and exit controls remain anchored
 * and fully visible throughout every swipe.
 *
 * Images stay long-pressable so a designer can save straight to the camera
 * roll (their studio library).
 */
const PresentationMode: React.FC<PresentationModeProps> = ({
  open,
  images,
  alt,
  title,
  index,
  onIndexChange,
  onClose,
  pickId,
  isMobileOrPwa,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: images.length > 1,
    align: "start",
    containScroll: false,
    slidesToScroll: 1,
    dragFree: false,
    duration: 24,
  });
  const indexRef = useRef(index);
  const onIndexChangeRef = useRef(onIndexChange);
  const onCloseRef = useRef(onClose);
  indexRef.current = index;
  onIndexChangeRef.current = onIndexChange;
  onCloseRef.current = onClose;

  const closeAtCurrentIndex = useCallback(() => {
    const selectedIndex = emblaApi?.selectedScrollSnap() ?? indexRef.current;
    indexRef.current = selectedIndex;
    onIndexChangeRef.current(selectedIndex);
    onCloseRef.current(selectedIndex);
  }, [emblaApi]);

  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAtCurrentIndex();
      const len = images.length;
      const wrap = (i: number) => ((i % len) + len) % len;
      if (e.key === "ArrowRight") onIndexChangeRef.current(wrap(indexRef.current + 1));
      if (e.key === "ArrowLeft") onIndexChangeRef.current(wrap(indexRef.current - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      window.removeEventListener("keydown", onKey);
    };
  }, [open, images.length, closeAtCurrentIndex]);

  useEffect(() => {
    if (!emblaApi || !open) return;
    const syncFromCarousel = () => {
      const next = emblaApi.selectedScrollSnap();
      if (next !== indexRef.current) onIndexChangeRef.current(next);
    };
    const finishSwipe = () => {
      syncFromCarousel();
    };
    emblaApi.scrollTo(indexRef.current, true);
    emblaApi.on("select", syncFromCarousel);
    emblaApi.on("reInit", syncFromCarousel);
    emblaApi.on("settle", finishSwipe);
    return () => {
      emblaApi.off("select", syncFromCarousel);
      emblaApi.off("reInit", syncFromCarousel);
      emblaApi.off("settle", finishSwipe);
    };
  }, [emblaApi, open]);

  useEffect(() => {
    if (!emblaApi || !open || emblaApi.selectedScrollSnap() === index) return;
    emblaApi.scrollTo(index);
  }, [emblaApi, index, open]);

  if (!open || typeof document === "undefined" || images.length === 0) return null;

  const go = (i: number) => {
    const len = images.length;
    const next = ((i % len) + len) % len;
    onIndexChange(next);
    emblaApi?.scrollTo(next);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex h-[100dvh] flex-col overflow-hidden overscroll-none bg-foreground isolate"
      role="dialog"
      aria-modal="true"
      aria-label={`${title || alt} — presentation`}
      data-editorial-gallery
    >
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))",
        }}
      >
        <div ref={emblaRef} className="absolute inset-0 overflow-hidden" style={{ touchAction: "pan-y pinch-zoom" }}>
          <div className="flex h-full touch-pan-y">
            {images.map((src, i) => (
              <div key={`${src}-${i}`} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center">
                <img
                  src={src}
                  alt={i === index ? alt : ""}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  className="max-h-full max-w-full select-none object-contain [-webkit-touch-callout:none]"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: persistent close control, top-right — never fades */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); closeAtCurrentIndex(); }}
          aria-label="Exit presentation mode"
          className="hidden md:flex absolute z-20 w-10 h-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white/85 transition-colors duration-300 hover:bg-white/20"
          style={{ top: "max(1.5rem, calc(env(safe-area-inset-top) + 1rem))", right: "1.5rem" }}
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        {/* Desktop edge arrows — never fade (mirrors the persistent close + pagination) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(index - 1); }}
              aria-label="Previous"
              className="hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white/80 transition-colors duration-300 hover:bg-white/20"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); go(index + 1); }}
              aria-label="Next"
              className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white/80 transition-colors duration-300 hover:bg-white/20"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Mobile/PWA: active finish caption — moved here from below the inline image */}
      {isMobileOrPwa && pickId && (
        <div
          className="absolute left-0 right-0 z-10 px-5 opacity-100"
          style={{ bottom: "max(4.5rem, calc(env(safe-area-inset-bottom) + 3.25rem))" }}
        >
          <ActiveSwatchCaption pickId={pickId} activeIndex={index} variant="light" />
        </div>
      )}

      {/* Progress, counter, and close remain fully visible throughout the gallery. */}
      <div
        className="absolute left-0 right-0 z-10 flex items-center gap-4 px-5 opacity-100"
        style={{ bottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
      >
        {images.length > 1 && (
          <div className="flex-1 flex items-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`View image ${i + 1} of ${images.length}`}
                onClick={(e) => { e.stopPropagation(); go(i); }}
                className={cn(
                  "flex-1 rounded-full transition-all duration-200",
                  i === index ? "h-[3px] bg-white/85" : "h-px bg-white/30"
                )}
              />
            ))}
          </div>
        )}
        {images.length > 1 && (
          <span className="font-body text-[10px] font-light uppercase tracking-[0.18em] text-white/60 tabular-nums shrink-0">
            {String(index + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
          </span>
        )}
        {/* Mobile/PWA close — Desktop uses the persistent top-right X instead */}
        {isMobileOrPwa && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); closeAtCurrentIndex(); }}
            aria-label="Exit presentation mode"
            className="shrink-0 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/85 touch-manipulation ml-auto"
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default PresentationMode;
