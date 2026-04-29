import React from "react";
import { cn } from "@/lib/utils";

interface SliderDotsProps {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
  /** Color theme — light works on dark backgrounds, dark on light backgrounds */
  variant?: "dark" | "light";
  className?: string;
  ariaPrefix?: string;
  size?: "sm" | "md";
}

/**
 * Unified dot indicator: solid filled circle for active, outlined ring
 * (transparent center) for inactive. Used across all carousels site-wide.
 */
const SliderDots: React.FC<SliderDotsProps> = ({
  count,
  activeIndex,
  onSelect,
  variant = "dark",
  className,
  ariaPrefix = "Go to slide",
  size = "md",
}) => {
  if (count <= 1) return null;

  const dim = size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5";
  // Always visible regardless of underlying image: filled dots with contrasting ring + drop shadow.
  const activeColor =
    variant === "light"
      ? "bg-white border-black/40"
      : "bg-foreground border-white/70";
  const inactiveColor =
    variant === "light"
      ? "bg-white/50 border-black/30 hover:bg-white/80"
      : "bg-foreground/40 border-white/60 hover:bg-foreground/70";

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`${ariaPrefix} ${i + 1}`}
          className={cn(
            "rounded-full border transition-all duration-300",
            dim,
            i === activeIndex ? activeColor : inactiveColor
          )}
        />
      ))}
    </div>
  );
};

export default SliderDots;
