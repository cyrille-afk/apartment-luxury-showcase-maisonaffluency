import { useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Canonical "View The Full Portrait" CTA — the sliding-rule arrow treatment
 * used by the New In spotlight. The hairline rule slides out to the right and
 * fades while a second rule slides in from the left, padding shifting with it.
 */
interface PortraitCtaLinkProps {
  label: string;
  onClick: () => void;
  /** Renders the mirrored (leftward) arrow for the "close" state. */
  reversed?: boolean;
  expanded?: boolean;
  /** Renders a single continuous long arrow instead of a hairline + icon. */
  longArrow?: boolean;
  className?: string;
}

export function PortraitCtaLink({
  label,
  onClick,
  reversed = false,
  expanded,
  longArrow = false,
  className,
}: PortraitCtaLinkProps) {
  const [pressed, setPressed] = useState(false);
  const Arrow = reversed ? ArrowLeft : ArrowRight;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={() => {
        setPressed(true);
        window.setTimeout(() => setPressed(false), 700);
        onClick();
      }}
      className={cn(
        "group relative inline-flex items-center font-body text-[11px] lg:text-xs uppercase tracking-[0.25em] text-current hover:text-primary transition-colors duration-300",
        className
      )}
    >
      <span
        className={cn(
          "relative inline-flex items-center whitespace-nowrap transition-[padding] duration-300",
          longArrow
            ? reversed
              ? ["pl-28 pr-0"]
              : ["pl-0 pr-28"]
            : reversed
              ? ["pl-14 pr-0", "group-hover:pl-0 group-hover:pr-20", pressed && "pl-0 pr-20"]
              : ["pl-0 pr-14", "group-hover:pl-20 group-hover:pr-0", pressed && "pl-20 pr-0"]
        )}
      >
        {!longArrow && (
          <>
            {/* incoming rule */}
            <span
              className={cn(
                "pointer-events-none absolute top-1/2 h-px w-12 -translate-y-1/2 bg-current opacity-0 transition-all duration-300",
                reversed
                  ? ["right-0", "-translate-x-2 group-hover:translate-x-0 group-hover:opacity-100", pressed && "translate-x-0 opacity-100"]
                  : ["left-0", "translate-x-2 group-hover:translate-x-0 group-hover:opacity-100", pressed && "translate-x-0 opacity-100"]
              )}
            />
          </>
        )}
        <span className="relative z-10">{label}</span>
        {!longArrow && (
          /* outgoing rule */
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 h-px w-8 -translate-y-1/2 bg-current opacity-100 transition-all duration-300",
              reversed
                ? ["left-5", "translate-x-0 group-hover:-translate-x-6 group-hover:opacity-0", pressed && "-translate-x-6 opacity-0"]
                : ["right-5", "translate-x-0 group-hover:translate-x-6 group-hover:opacity-0", pressed && "translate-x-6 opacity-0"]
            )}
          />
        )}
        {longArrow ? (
          <svg
            viewBox="0 0 120 14"
            preserveAspectRatio="none"
            className={cn(
              "pointer-events-none absolute top-1/2 h-3.5 w-24 -translate-y-1/2 transition-transform duration-300",
              reversed
                ? ["left-0", "group-hover:-translate-x-1.5", pressed && "-translate-x-1.5"]
                : ["right-0", "group-hover:translate-x-1.5", pressed && "translate-x-1.5"]
            )}
            fill="none"
            stroke="currentColor"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          >
            <line x1="0" y1="7" x2="112" y2="7" vectorEffect="non-scaling-stroke" />
            <polyline points="104,1.5 112,7 104,12.5" vectorEffect="non-scaling-stroke" strokeLinecap="square" />
          </svg>
        ) : (
          <Arrow
            className={cn(
              "pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-all duration-300 group-hover:opacity-0",
              reversed
                ? ["left-0", "group-hover:translate-x-1", pressed && "translate-x-1 opacity-0"]
                : ["right-0", "group-hover:-translate-x-1", pressed && "-translate-x-1 opacity-0"]
            )}
            strokeWidth={1.25}
          />
        )}
      </span>
    </button>
  );
}

export default PortraitCtaLink;
