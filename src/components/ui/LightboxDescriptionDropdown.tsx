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
            onClick={(e) => {
              e.stopPropagation();
              if (!showFull) setShowFull(true);
            }}
            className={cn(
              "w-[min(34rem,90vw)] rounded-lg bg-white/85 backdrop-blur-md border border-white/60 shadow-md px-5 py-2.5",
              !showFull && "cursor-pointer hover:bg-white/95 transition-colors"
            )}
          >
            <p
              className="font-body text-[12px] text-foreground leading-relaxed overflow-hidden"
              style={
                showFull
                  ? undefined
                  : {
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                    }
              }
            >
              {description}
            </p>
            {!showFull && (
              <span className="mt-1 inline-block font-display italic text-[10px] text-foreground/60">
                Read more
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LightboxDescriptionDropdown;
