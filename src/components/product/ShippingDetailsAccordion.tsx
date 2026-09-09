import { useEffect, useRef, useState } from "react";
import { Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { lockBodyScroll, unlockBodyScroll } from "@/lib/bodyScrollLock";

/**
 * Logistics trigger. "inline" sits beneath the price with a sentence of
 * context; "row" presents a clean technical-row button that lives with the
 * spec block, keeping fulfillment separate from pricing.
 */
export default function ShippingDetailsAccordion({
  className,
  variant = "inline",
}: {
  className?: string;
  variant?: "inline" | "row";
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll while the modal is open (shared ref-counted lock so
  // overlapping overlays can't strand or prematurely release the page).
  useEffect(() => {
    if (!open) return;
    lockBodyScroll();
    // On touch devices the backdrop must swallow scroll gestures so the page
    // beneath never moves when the user drags outside the panel.
    const stopTouch = (e: TouchEvent) => {
      const panel = panelRef.current;
      if (panel && panel.contains(e.target as Node)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", stopTouch, { passive: false });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlockBodyScroll();
      document.removeEventListener("touchmove", stopTouch);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="uppercase tracking-wider text-foreground font-medium underline underline-offset-4 decoration-[0.5px] transition-opacity hover:opacity-60"
    >
      View Logistics
    </button>
  );

  return (
    <>
      {variant === "row" ? (
        <div className={cn("border-b border-border/60 pt-3 pb-2.5 md:pb-3 flex items-start gap-5", className)}>
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-gold mt-0.5"
            aria-hidden="true"
          >
            <Globe className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </span>
          <div className="font-body text-sm leading-relaxed text-muted-foreground font-normal">
            {button}
          </div>
        </div>
      ) : (
        <div className={cn("mt-2", className)}>
          <p className="font-body text-xs leading-relaxed text-muted-foreground">
            White-glove delivery &amp; professional installation available worldwide.{" "}
            {button}
          </p>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 md:p-8 overscroll-none touch-none"
          role="dialog"
          aria-modal="true"
          aria-label="Logistics & White-Glove Installation"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          />

          {/* Modal panel */}
          <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-none bg-background text-foreground shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            {/* Close */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 p-1 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.25} />
            </button>

            {/* SECTION 1 — Header */}
            <div className="px-6 md:px-10 pt-8 md:pt-10 pb-6 border-b border-neutral-200">
              <h2 className="font-body text-xs md:text-sm uppercase tracking-[0.28em] font-medium">
                Logistics &amp; White-Glove Installation
              </h2>
            </div>

            {/* SECTION 2 — The Standard */}
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-neutral-200">
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                Museum-Grade Crating
              </p>
              <p className="font-body text-xs leading-relaxed text-muted-foreground">
                Every commission is crated to museum standards and shipped fully insured,
                door to door, via our dedicated fine-furniture logistics partners.
              </p>
            </div>

            {/* SECTION 3 — White-Glove Delivery */}
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-neutral-200">
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                White-Glove Service &amp; Installation
              </p>
              <p className="font-body text-xs leading-relaxed text-muted-foreground">
                Includes two-person placement in the room of your choice, professional
                assembly, full unpacking, inspection, and complete debris removal.
              </p>
            </div>

            {/* SECTION 4 — Duties & Scheduling */}
            <div className="px-6 md:px-10 py-6 md:py-8 border-b border-neutral-200">
              <p className="font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
                Duties &amp; Storage
              </p>
              <p className="font-body text-xs leading-relaxed text-muted-foreground">
                Duties and customs are handled directly for you. Scheduled delivery to
                your site, secure storage, and staged delivery setups are available at
                no additional handling fee.
              </p>
            </div>

            {/* SECTION 5 — Notice Highlight Block */}
            <div className="p-4 md:p-5 bg-neutral-50 border-b border-neutral-200">
              <p className="font-body text-xs leading-relaxed text-neutral-800">
                <span className="font-medium uppercase tracking-widest">Notice — </span>
                Freight, installation, and duties are quoted separately once the
                destination is confirmed. Your dedicated design advisor will present a
                single, all-inclusive landed figure.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
