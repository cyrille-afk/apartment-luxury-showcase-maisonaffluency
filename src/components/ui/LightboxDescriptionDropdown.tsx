/**
 * Shared image-overlay description dropdown for lightboxes.
 * Compact icon button — expands a panel to the left so it doesn't cover the image.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
}

const LightboxDescriptionDropdown = ({ description }: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (!description || !description.trim()) return null;

  return (
    <div className="absolute top-3 right-3 z-20 pointer-events-auto flex items-start justify-end gap-2">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, x: 8, width: 0 }}
            animate={{ opacity: 1, x: 0, width: "auto" }}
            exit={{ opacity: 0, x: 8, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="w-[min(22rem,70vw)] rounded-lg bg-background/90 backdrop-blur-sm border border-border/30 shadow-lg px-3 py-2.5">
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
        aria-label={expanded ? "Hide information" : "Show information"}
        title="More information"
        className={cn(
          "shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-full shadow-lg transition-all",
          "bg-background/90 backdrop-blur-sm border border-border/30 text-foreground hover:bg-background"
        )}
      >
        {expanded ? <X size={15} /> : <Info size={15} className="opacity-80" />}
      </button>
    </div>
  );
};

export default LightboxDescriptionDropdown;
