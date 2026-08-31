import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CornerTooltipProps {
  label: string;
  /** Where the tooltip appears relative to the icon. Bottom-corner icons use "top" so they stay inside the image frame (it clips overflow). */
  side?: "bottom" | "top";
  align?: "start" | "center" | "end";
  className?: string;
  children: React.ReactNode;
}

const sideClasses = {
  bottom: "top-full mt-2 translate-y-1 group-hover/tip:translate-y-0",
  top: "bottom-full mb-2 -translate-y-1 group-hover/tip:translate-y-0",
} as const;

const alignClasses = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
} as const;

/**
 * Desktop-only hover tooltip for the corner action icons on the main
 * product image. Purely CSS (group-hover) — no JS state, so touch taps
 * on mobile are completely unaffected and the tooltip never renders there.
 *
 * Timing: 150ms micro-delay on hover-in (via group-hover/tip:delay-150),
 * instant fade on mouse-leave (base state has no transition-delay).
 */
export default function CornerTooltip({
  label,
  side = "bottom",
  align = "center",
  className,
  children,
}: CornerTooltipProps) {
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden md:inline-flex max-w-[200px] items-center justify-center whitespace-nowrap px-2.5 py-1.5",
          "bg-background/95 backdrop-blur-md border border-border/60 shadow-[0_2px_12px_rgba(0,0,0,0.08)]",
          "font-body text-[10px] uppercase tracking-[0.18em] text-foreground/90",
          "opacity-0 transition-all duration-200 ease-out group-hover/tip:opacity-100 group-hover/tip:delay-150",
          sideClasses[side],
          alignClasses[align],
          className,
        )}
      >
        {label}
      </span>
    </span>
  );
}
