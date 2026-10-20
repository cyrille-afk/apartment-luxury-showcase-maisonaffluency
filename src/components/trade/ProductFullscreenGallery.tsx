import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Box, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  images: string[];
  alt: string;
  /** Renders the live 3D viewer slide (slide 0) when provided. */
  render3d?: (() => ReactNode) | null;
  startIndex?: number;
};

/**
 * Full-screen gallery for product photos + the 3D model.
 * Swipe left/right on photos (mobile), arrows/keys on desktop. On the 3D slide
 * touches drive the model, so navigation uses the arrows or the strip.
 */
export default function ProductFullscreenGallery({ open, onClose, images, alt, render3d, startIndex = 0 }: Props) {
  const has3d = !!render3d;
  const total = images.length + (has3d ? 1 : 0);
  const [idx, setIdx] = useState(startIndex);
  const [dx, setDx] = useState(0);
  const touch = useRef<{ x: number; y: number; t: number } | null>(null);

  useEffect(() => { if (open) setIdx(Math.min(startIndex, Math.max(0, total - 1))); }, [open, startIndex, total]);

  const go = useCallback((d: number) => setIdx((i) => (i + d + total) % total), [total]);
  const is3d = has3d && idx === 0;
  const photo = has3d ? idx - 1 : idx;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, go, onClose]);

  if (!open || total === 0) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    if (is3d || e.touches.length !== 1) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const mx = e.touches[0].clientX - touch.current.x;
    if (Math.abs(mx) > Math.abs(e.touches[0].clientY - touch.current.y)) setDx(mx);
  };
  const onTouchEnd = () => {
    if (touch.current && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touch.current = null;
    setDx(0);
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${alt} — full-screen gallery`} className="fixed inset-0 z-[2147483000] flex flex-col bg-background">
      <div className="flex items-center justify-between px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="font-body text-[11px] uppercase tracking-[0.14em] text-muted-foreground" aria-live="polite">
          {is3d ? "3D model" : `Photo ${photo + 1} / ${images.length}`}
        </span>
        <button type="button" onClick={onClose} aria-label="Close full-screen gallery" className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-foreground">
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onTouchCancel={onTouchEnd}>
        {is3d ? (
          <div className="absolute inset-0 flex items-center justify-center p-2 md:p-6">
            <div className="aspect-square h-full max-h-full max-w-full">{render3d!()}</div>
          </div>
        ) : (
          <img
            key={images[photo]}
            src={images[photo]}
            alt={`${alt} — photo ${photo + 1}`}
            draggable={false}
            className="absolute inset-0 h-full w-full select-none object-contain p-2 md:p-8"
            style={{ transform: `translateX(${dx}px)`, transition: dx ? "none" : "transform 200ms ease-out", touchAction: "pan-y pinch-zoom" }}
          />
        )}
        {total > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous" className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground md:left-6">
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next" className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background/90 text-foreground md:right-6">
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [scrollbar-width:none] md:justify-center" aria-label="Gallery views">
          {has3d && (
            <button type="button" onClick={() => setIdx(0)} aria-label="Show 3D model" aria-pressed={idx === 0} className={cn("flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 border bg-muted font-body text-[9px] uppercase tracking-[0.14em] text-foreground", idx === 0 ? "border-foreground" : "border-border/60")}>
              <Box size={14} className="text-accent" />3D
            </button>
          )}
          {images.map((src, i) => {
            const n = has3d ? i + 1 : i;
            return (
              <button key={src + i} type="button" onClick={() => setIdx(n)} aria-label={`Show photo ${i + 1}`} aria-pressed={idx === n} className={cn("h-14 w-14 shrink-0 overflow-hidden border bg-muted/40", idx === n ? "border-foreground" : "border-border/60")}>
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
