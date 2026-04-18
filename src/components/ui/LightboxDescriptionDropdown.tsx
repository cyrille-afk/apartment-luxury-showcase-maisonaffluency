/**
 * Editorial "Read more" affordance that reveals the product description.
 * Minimal text link — expands a soft panel to the left.
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

  return (
    <div className="pointer-events-auto flex items-start justify-end gap-2">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, x: 8, width: 0 }}
            animate={{ opacity: 1, x: 0, width: "auto" }}
            exit={{ opacity: 0, x: 8, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="w-[min(22rem,70vw)] rounded-md bg-background/85 backdrop-blur-sm border border-border/30 shadow-md px-3.5 py-3">
              <p className="font-body text-xs text-foreground leading-relaxed">
                {description}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        aria-label={expanded ? "Hide description" : "Read description"}
        style={{ mixBlendMode: "difference" }}
        className={cn(
          "shrink-0 inline-flex items-center gap-1 group",
          "font-display italic text-[13px] leading-none text-white"
        )}
      >
        <span className="border-b border-white/60 group-hover:border-white pb-0.5 transition-colors">
          {expanded ? "Close" : "Read more"}
        </span>
        <ChevronDown
          size={12}
          className={cn(
            "transition-transform duration-200 mt-0.5",
            expanded && "rotate-180"
          )}
        />
      </button>
    </div>
  );
};

export default LightboxDescriptionDropdown;
