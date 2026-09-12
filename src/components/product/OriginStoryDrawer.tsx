import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface OriginStoryDrawerProps {
  /** The rendered origin line, e.g. "Handcrafted in the US". */
  label: string;
  /** Maker / atelier name used in the copy. */
  maker?: string;
}

/**
 * Turns the origin line into a quiet text link that opens a short drawer on
 * the artisanal manufacturing process behind the piece — context that helps
 * justify the price on mobile, where there is no room for long copy.
 */
export default function OriginStoryDrawer({ label, maker }: OriginStoryDrawerProps) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const house = maker?.trim() || "the atelier";

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="text-left underline underline-offset-4 decoration-border transition-colors hover:text-foreground"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {label}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div role="presentation">
          <div
            className="fixed inset-0 z-[60] bg-foreground/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed bottom-0 left-0 z-[70] max-h-[85vh] w-full overflow-y-auto rounded-t-2xl bg-card pb-24 shadow-2xl transition-transform duration-300 ease-out"
          >
            <div className="sticky top-0 z-10 bg-card px-5 pb-2 pt-3">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-muted" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-3 top-3"
                aria-label="Close details"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
              <h2 id={titleId} className="pr-10 font-display text-lg font-normal">
                {label}
              </h2>
            </div>
            <div className="space-y-4 px-5 pt-2 font-body text-sm leading-relaxed text-muted-foreground">
              <p>
                Every piece is made to order by {house}, assembled by hand in a
                small studio rather than on a production line.
              </p>
              <p>
                Metalwork is cut, brazed and hand-finished in-house; glass and
                shades are individually blown or formed, so subtle variation
                between pieces is inherent to the process rather than a defect.
              </p>
              <p>
                Components are hand-polished and plated in small batches, then
                wired, tested and inspected piece by piece before crating for
                white-glove delivery.
              </p>
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
                Made to order · Lead times reflect handwork, not stock
              </p>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
