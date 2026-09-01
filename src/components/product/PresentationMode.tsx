import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import ActiveSwatchCaption from "./ActiveSwatchCaption";

interface PresentationModeProps {
  open: boolean;
  images: string[];
  alt: string;
  title?: string;
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  pickId?: string | null;
  isMobileOrPwa?: boolean;
}

/**
 * Presentation Mode — the platform disappears.
 *
 * Full-bleed, chrome-free gallery for handing the phone to a client: no
 * pricing, no dimensions, no headers, no navigation. Swipe (or tap the
 * edges) to move between frames; tap the centre to reveal the discreet exit
 * control, which auto-hides again after a few seconds.
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
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setChromeVisible(false), 2600);
  }, []);

  useEffect(() => {
    if (!open) return;
    setChromeVisible(true);
    scheduleHide();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      const len = images.length;
      const wrap = (i: number) => ((i % len) + len) % len;
      if (e.key === "ArrowRight") onIndexChange(wrap(index + 1));
      if (e.key === "ArrowLeft") onIndexChange(wrap(index - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [open, index, images.length, onClose, onIndexChange, scheduleHide]);

  if (!open || typeof document === "undefined" || images.length === 0) return null;

  const go = (i: number) => {
    const len = images.length;
    onIndexChange(((i % len) + len) % len);
  };

  const revealChrome = () => {
    setChromeVisible(true);
    scheduleHide();
  };

  return createPortal(
    <div
      className="fixed inset-0 h-[100dvh] z-[9999] bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={`${title || alt} — presentation`}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
      }}
      onTouchEnd={(e) => {
        const sx = touchStartX.current;
        const sy = touchStartY.current;
        touchStartX.current = null;
        touchStartY.current = null;
        if (sx == null || sy == null) return;
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
          go(dx < 0 ? index + 1 : index - 1);
        } else if (Math.abs(dx) < 12 && Math.abs(dy) < 12) {
          revealChrome();
        }
      }}
      onClick={revealChrome}
    >
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden"
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))",
        }}
      >
        {images.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt={i === index ? alt : ""}
            draggable
            className={cn(
              "absolute max-w-full max-h-full object-contain transition-opacity duration-500 ease-out",
              i === index ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
          />
        ))}

        {/* Desktop: persistent close control, top-right — never fades */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Exit presentation mode"
          className="hidden md:flex absolute z-20 w-10 h-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white/85 transition-colors duration-300 hover:bg-white/20"
          style={{ top: "max(1.5rem, calc(env(safe-area-inset-top) + 1rem))", right: "1.5rem" }}
        >
          <X size={18} strokeWidth={1.5} />
        </button>

        {/* Desktop edge arrows — fade with the chrome */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); revealChrome(); go(index - 1); }}
              aria-label="Previous"
              className={cn(
                "hidden md:flex absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white/80 transition-opacity duration-300",
                chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); revealChrome(); go(index + 1); }}
              aria-label="Next"
              className={cn(
                "hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm text-white/80 transition-opacity duration-300",
                chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"
              )}
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>

      {/* Mobile/PWA: active finish caption — moved here from below the inline image */}
      {isMobileOrPwa && pickId && (
        <div
          className={cn(
            "absolute left-0 right-0 z-10 px-5 transition-opacity duration-300",
            chromeVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          style={{ bottom: "max(4.5rem, calc(env(safe-area-inset-bottom) + 3.25rem))" }}
        >
          <ActiveSwatchCaption pickId={pickId} activeIndex={index} variant="light" />
        </div>
      )}

      {/* Bottom control rail: progress markers + counter + close (mirrors the expanded image view).
          Desktop: never hides — pagination and counter stay permanently visible.
          Mobile/PWA: keeps the tap-to-reveal + auto-hide behaviour. */}
      <div
        className={cn(
          "absolute left-0 right-0 z-10 flex items-center gap-4 px-5 transition-opacity duration-300",
          isMobileOrPwa && !chromeVisible ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        style={{ bottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
      >
        {images.length > 1 && (
          <div className="flex-1 flex items-center gap-2">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`View image ${i + 1} of ${images.length}`}
                onClick={(e) => { e.stopPropagation(); revealChrome(); go(i); }}
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
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
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
