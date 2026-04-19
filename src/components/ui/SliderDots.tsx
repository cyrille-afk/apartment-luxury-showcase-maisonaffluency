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
  const activeColor = variant === "light" ? "bg-white border-white" : "bg-foreground border-foreground";
  const inactiveColor =
    variant === "light"
      ? "bg-transparent border-white/60 hover:border-white"
      : "bg-transparent border-foreground/50 hover:border-foreground/80";

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
