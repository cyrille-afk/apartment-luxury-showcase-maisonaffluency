/**
 * Editorial description affordance for image overlays.
 * Frosted pill matching the product-card hover treatment.
 *
 * - "Creation" toggles a compact panel anchored to the pill.
 * - "Expand bio" promotes that panel into a centered, near-fullscreen
 *   reader so long descriptions are fully visible without scrolling
 *   tiny dropdowns.
 *
 * Accessibility:
 * - Trigger uses aria-expanded / aria-controls and toggles a labelled region.
 * - Escape closes the inline dropdown and the fullscreen reader.
 * - Focus moves into the dropdown on open and into the dialog's close button
 *   on fullscreen open; previously-focused element is restored on close.
 * - Fullscreen dialog uses role="dialog" + aria-modal with a basic Tab focus
 *   trap so keyboard users stay inside until they dismiss it.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
}

const FOCUSABLE_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

const LightboxDescriptionDropdown = ({ description }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const reactId = useId();
  const panelId = `lightbox-desc-${reactId.replace(/:/g, "")}`;
  const dialogTitleId = `${panelId}-dialog-title`;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);
  // Element to restore focus to when the fullscreen dialog closes.
  const lastFocusedBeforeDialog = useRef<HTMLElement | null>(null);

  const closeFullscreen = useCallback(() => setFullscreen(false), []);
  const closeExpanded = useCallback(() => setExpanded(false), []);

  // Escape closes inline dropdown (when fullscreen isn't on top of it).
  useEffect(() => {
    if (!expanded || fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeExpanded();
        // Return focus to the trigger so keyboard users keep their place.
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, fullscreen, closeExpanded]);

  // Move focus into the inline panel when it opens (so Escape + Tab work intuitively).
  useEffect(() => {
    if (expanded && panelRef.current) {
      // Defer to next frame so Framer Motion has mounted the node.
      const id = window.requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [expanded]);

  // Fullscreen dialog: Escape to close + Tab focus trap.
  useEffect(() => {
    if (!fullscreen) return;

    lastFocusedBeforeDialog.current =
      (document.activeElement as HTMLElement) ?? null;

    // Defer focus so the close button is mounted.
    const focusId = window.requestAnimationFrame(() => {
      dialogCloseRef.current?.focus();
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeFullscreen();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter(
        (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);

    // Lock background scroll while the reader is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.cancelAnimationFrame(focusId);
      document.body.style.overflow = prevOverflow;
      // Restore focus to whatever opened the dialog.
      lastFocusedBeforeDialog.current?.focus?.();
    };
  }, [fullscreen, closeFullscreen]);

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
    closeFullscreen();
  };

  return (
    <div className="pointer-events-auto flex flex-col items-end gap-1.5">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={expanded ? "Hide product description" : "Read product description"}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5",
          "bg-white/85 backdrop-blur-md border border-white/60 shadow-sm",
          "font-display italic text-[12px] leading-none text-foreground/90 hover:text-foreground transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-1"
        )}
      >
        <span aria-hidden="true">{expanded ? "Close" : "Creation"}</span>
        <ChevronDown
          aria-hidden="true"
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
            id={panelId}
            ref={panelRef}
            role="region"
            aria-label="Product description"
            tabIndex={-1}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-[min(46rem,92vw)] rounded-lg bg-white/95 backdrop-blur-md border border-white/60 shadow-md px-5 py-4",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            )}
          >
            <p className="font-body text-[13px] text-foreground leading-relaxed whitespace-pre-line max-h-[min(75vh,560px)] overflow-y-auto pr-1">
              {description}
            </p>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={handleExpand}
                aria-label="Expand product description to fullscreen reader"
                aria-haspopup="dialog"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1",
                  "border border-foreground/15 bg-white/70 hover:bg-white",
                  "font-display italic text-[11px] text-foreground/80 hover:text-foreground transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                )}
              >
                <Maximize2 aria-hidden="true" size={11} />
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
                  ref={dialogRef}
                  initial={{ opacity: 0, scale: 0.97, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 8 }}
                  transition={{ duration: 0.22 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={dialogTitleId}
                  className={cn(
                    "relative w-[min(56rem,96vw)] h-[min(86vh,860px)]",
                    "rounded-xl bg-background border border-border shadow-2xl",
                    "flex flex-col overflow-hidden"
                  )}
                >
                  <div className="flex items-center justify-between px-6 py-3 border-b border-border/60">
                    <span
                      id={dialogTitleId}
                      className="font-display italic text-[12px] uppercase tracking-[0.18em] text-muted-foreground"
                    >
                      Creation
                    </span>
                    <button
                      ref={dialogCloseRef}
                      type="button"
                      onClick={handleCloseFullscreen}
                      aria-label="Close product description"
                      className={cn(
                        "inline-flex h-8 w-8 items-center justify-center rounded-full",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40"
                      )}
                    >
                      <X aria-hidden="true" size={16} />
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
