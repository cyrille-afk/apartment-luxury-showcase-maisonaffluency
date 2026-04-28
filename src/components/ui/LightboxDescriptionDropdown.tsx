/**
 * Editorial description affordance for image overlays.
 * Frosted pill matching the product-card hover treatment.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
}

const LightboxDescriptionDropdown = ({ description }: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (!description || !description.trim()) return null;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((v) => !v);
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
              "w-[min(34rem,90vw)] rounded-lg bg-white/90 backdrop-blur-md border border-white/60 shadow-md px-5 py-3"
            )}
          >
            <p
              className="font-body text-[12px] text-foreground leading-relaxed whitespace-pre-line max-h-[min(60vh,420px)] overflow-y-auto pr-1"
            >
              {description}
            </p>
            <p className="mt-2.5 pt-2.5 border-t border-foreground/10 font-display italic text-[10.5px] leading-snug text-foreground/65">
              This is an editorial excerpt. Open the product sheet below for full specifications, finishes, dimensions and lead times.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LightboxDescriptionDropdown;
