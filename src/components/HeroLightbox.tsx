import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

const HERO_BASE = "https://res.cloudinary.com/dif1oamtj/image/upload";
const HERO_ID = "v1781920000/AffluencySG_194-22.jpg_macpwj";

// Full-resolution frame for the fullscreen room viewer — uncropped, letterboxed
// to the viewport so the whole room (ceiling to coffee table) stays visible.
const HERO_FULL_SRC = `${HERO_BASE}/c_scale,w_1920,q_auto:good,f_auto/${HERO_ID}`;

interface HeroLightboxProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Fullscreen view of the homepage hero photograph. Portal-mounted above every
 * header/dropdown layer (matches the z-[10000] dialog tier used site-wide).
 * Clicking anywhere, pressing Escape, or the close control dismisses it.
 */
export const HeroLightbox = ({ open, onClose }: HeroLightboxProps) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Full room view"
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/95 backdrop-blur-sm"
    >
      <img
        src={HERO_FULL_SRC}
        alt="Luxury living room with Asian-inspired murals and designer furniture, full room view"
        className="max-h-full max-w-full object-contain"
        draggable={false}
      />
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        aria-label="Close full room view"
        className="absolute right-5 top-5 flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 border border-white/25 bg-black/40 px-4 py-2.5 font-body text-[10px] font-semibold uppercase tracking-[0.25em] text-white backdrop-blur-sm transition-opacity duration-300 hover:opacity-70 focus:outline-hidden focus-visible:ring-1 focus-visible:ring-white/70"
      >
        Close
        <span aria-hidden="true" className="text-sm leading-none">✕</span>
      </button>
    </div>,
    document.body
  );
};

export default HeroLightbox;
