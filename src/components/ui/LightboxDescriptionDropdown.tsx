/**
 * Editorial description affordance for image overlays.
 * Frosted pill matching the product-card hover treatment.
 *
 * - "Creation" toggles a compact panel anchored to the pill.
 * - "Expand bio" promotes that panel into a centered, near-fullscreen
 *   reader so long descriptions are fully visible without scrolling
 *   tiny dropdowns.
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
}

const LightboxDescriptionDropdown = ({ description }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Close fullscreen with Escape for keyboard users.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (!description || !description.trim()) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(true);
  };

  const handleCloseFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFullscreen(false);
  };

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={expanded ? "Hide description" : "Read description"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
          "bg-white/85 backdrop-blur-md border border-white/60 shadow-sm",
          "font-display italic text-[12px] leading-none text-foreground/90 hover:text-foreground transition-colors"
        )}
      >
        <span>{expanded ? "Close" : "Creation"}</span>
        <ChevronDown
          size={11}
          className={cn(
            "transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-[min(46rem,92vw)] rounded-lg bg-white/95 backdrop-blur-md border border-white/60 shadow-md px-5 py-4"
            )}
          >
            <p
              className="font-body text-[13px] text-foreground leading-relaxed whitespace-pre-line max-h-[min(75vh,560px)] overflow-y-auto pr-1"
            >
              {description}
            </p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleExpand}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
                  "border border-foreground/15 bg-white/70 hover:bg-white",
                  "font-display italic text-[11px] text-foreground/80 hover:text-foreground transition-colors"
                )}
                aria-label="Expand bio to fullscreen"
              >
                <Maximize2 size={11} />
                <span>Expand bio</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen reader — portaled so it always escapes the lightbox/product-sheet stacking context */}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {fullscreen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={handleCloseFullscreen}
                className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 backdrop-blur-sm p-4 sm:p-8"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.22 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Product description"
                  className={cn(
                    "relative w-[min(56rem,96vw)] h-[min(86vh,860px)]",
                    "rounded-xl bg-background border border-border shadow-2xl",
                    "flex flex-col overflow-hidden"
                  )}
                >
                  <div className="flex items-center justify-between px-6 py-3 border-b border-border/60">
                    <span className="font-display italic text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
                      Creation
                    </span>
                    <button
                      type="button"
                      onClick={handleCloseFullscreen}
                      aria-label="Close fullscreen description"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6">
                    <p className="font-body text-[15px] sm:text-[16px] text-foreground leading-relaxed whitespace-pre-line max-w-prose mx-auto">
                      {description}
                    </p>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

export default LightboxDescriptionDropdown;
