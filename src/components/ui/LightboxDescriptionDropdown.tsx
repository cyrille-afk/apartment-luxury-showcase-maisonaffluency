/**
 * Shared image-overlay description dropdown for lightboxes.
 * Mirrors the Trade lightbox pattern: collapsed pill → expandable panel.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Info, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
}

const LightboxDescriptionDropdown = ({ description }: Props) => {
  const [expanded, setExpanded] = useState(false);

  if (!description || !description.trim()) return null;

  return (
    <div className="relative max-w-full pointer-events-auto">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className={cn(
          "flex items-start gap-2 px-3 py-2.5 rounded-lg shadow-lg transition-all text-left w-full max-w-md",
          "bg-background/90 backdrop-blur-sm border border-border/30 text-foreground",
          expanded ? "rounded-b-none border-b-0" : ""
        )}
      >
        <Info size={14} className="shrink-0 mt-0.5 opacity-70" />
        <span
          className={cn(
            "font-body text-xs leading-relaxed flex-1 min-w-0",
            !expanded && "line-clamp-2"
          )}
        >
          {expanded
            ? ""
            : description.slice(0, 80) +
              (description.length > 80 ? "…" : "")}
        </span>
        {description.length > 80 &&
          (expanded ? (
            <ChevronUp size={14} className="shrink-0 mt-0.5 ml-auto" />
          ) : (
            <ChevronDown size={14} className="shrink-0 mt-0.5 ml-auto" />
          ))}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden rounded-b-lg bg-background/90 backdrop-blur-sm border border-border/30 border-t-0 shadow-lg"
          >
            <p className="font-body text-xs text-foreground leading-relaxed px-3 pb-3 pt-0">
              {description}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LightboxDescriptionDropdown;
