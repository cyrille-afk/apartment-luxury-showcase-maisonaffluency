/**
 * Editorial description affordance for image overlays.
 * Frosted pill matching the product-card hover treatment.
 *
 * - "Creation" toggles a compact panel anchored to the pill.
 * - The panel scrolls internally if the bio is long — no fullscreen reader
 *   needed since lightboxes/product sheets already provide ample space.
 *
 * Accessibility:
 * - Trigger uses aria-expanded / aria-controls and toggles a labelled region.
 * - Escape closes the panel and returns focus to the trigger.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
}

const LightboxDescriptionDropdown = ({ description }: Props) => {
  const [expanded, setExpanded] = useState(false);

  const reactId = useId();
  const panelId = `lightbox-desc-${reactId.replace(/:/g, "")}`;

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const closeExpanded = useCallback(() => setExpanded(false), []);

  // Escape closes the panel and restores focus to the trigger.
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeExpanded();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded, closeExpanded]);

  // Move focus into the panel on open so Escape + Tab work intuitively.
  useEffect(() => {
    if (expanded && panelRef.current) {
      const id = window.requestAnimationFrame(() => {
        panelRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [expanded]);

  if (!description || !description.trim()) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
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
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-[min(28rem,88vw)] rounded-lg bg-white/95 backdrop-blur-md border border-white/60 shadow-md px-4 py-3",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
            )}
          >
            <p className="font-body text-[12px] text-foreground/90 leading-snug whitespace-pre-line max-h-[min(60vh,420px)] overflow-y-auto pr-1">
              {description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LightboxDescriptionDropdown;
