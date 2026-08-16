import { useEffect, useRef, useState } from "react";
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
  /** Renders a single trailing/leading hairline instead of an arrow. */
  longArrow?: boolean;
  className?: string;
}

export function PortraitCtaLink({
  label,
  onClick,
  reversed = false,
  expanded,
  longArrow = true,
  className,
}: PortraitCtaLinkProps) {
  const [pressed, setPressed] = useState(false);
  const actionTimer = useRef<number>();
  const Arrow = reversed ? ArrowLeft : ArrowRight;

  useEffect(() => {
    return () => {
      if (actionTimer.current) window.clearTimeout(actionTimer.current);
    };
  }, []);

  const handleClick = () => {
    if (actionTimer.current) return;
    setPressed(true);
    actionTimer.current = window.setTimeout(() => {
      actionTimer.current = undefined;
      onClick();
    }, 700);
  };

  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={handleClick}
      className={cn(
        "group/portrait-cta relative inline-flex items-center font-body text-[11px] lg:text-xs uppercase tracking-[0.25em] text-current hover:text-primary transition-colors duration-300",
        className
      )}
    >
      {longArrow ? (
        <span
          className={cn(
            "relative inline-flex items-center whitespace-nowrap transition-[padding] duration-700 ease-out",
            reversed
              ? ["pl-20 pr-0", "group-hover/portrait-cta:pl-0 group-hover/portrait-cta:pr-8 group-focus-visible/portrait-cta:pl-0 group-focus-visible/portrait-cta:pr-8 group-active/portrait-cta:pl-0 group-active/portrait-cta:pr-8", pressed && "pl-0 pr-8"]
              : ["pl-0 pr-20", "group-hover/portrait-cta:pl-8 group-hover/portrait-cta:pr-0 group-focus-visible/portrait-cta:pl-8 group-focus-visible/portrait-cta:pr-0 group-active/portrait-cta:pl-8 group-active/portrait-cta:pr-0", pressed && "pl-8 pr-0"]
          )}
        >
          <span className="relative z-10">{label}</span>

          {/* Long resting hairline exits as the label moves. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 h-2 w-16 -translate-y-1/2 opacity-100 transition-all duration-300",
              reversed
                ? ["left-0 group-hover/portrait-cta:-translate-x-3 group-hover/portrait-cta:opacity-0 group-focus-visible/portrait-cta:-translate-x-3 group-focus-visible/portrait-cta:opacity-0", pressed && "-translate-x-3 opacity-0"]
                : ["right-0 group-hover/portrait-cta:translate-x-3 group-hover/portrait-cta:opacity-0 group-focus-visible/portrait-cta:translate-x-3 group-focus-visible/portrait-cta:opacity-0", pressed && "translate-x-3 opacity-0"]
            )}
          >
            <span className={cn("absolute top-1/2 h-px w-14 -translate-y-1/2 bg-current", reversed ? "right-0" : "left-0")} />
            <span className={cn("absolute top-1/2 h-2 w-2 -translate-y-1/2 rotate-45 border-current", reversed ? "left-0 border-b border-l" : "right-0 border-r border-t")} />
          </span>

          {/* Only a short, fine hairline is revealed in the space created by the moving label. */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute top-1/2 h-2 w-6 -translate-y-1/2 opacity-0 transition-all duration-500 delay-100",
              reversed
                ? ["right-0 translate-x-3 group-hover/portrait-cta:translate-x-0 group-hover/portrait-cta:opacity-100 group-focus-visible/portrait-cta:translate-x-0 group-focus-visible/portrait-cta:opacity-100", pressed && "translate-x-0 opacity-100"]
                : ["left-0 -translate-x-3 group-hover/portrait-cta:translate-x-0 group-hover/portrait-cta:opacity-100 group-focus-visible/portrait-cta:translate-x-0 group-focus-visible/portrait-cta:opacity-100", pressed && "translate-x-0 opacity-100"]
            )}
          >
            <span className={cn("absolute top-1/2 h-px w-4 -translate-y-1/2 bg-current", reversed ? "right-0" : "left-0")} />
          </span>
        </span>
      ) : (
      <span
        className={cn(
          "relative inline-flex items-center whitespace-nowrap duration-300",
          reversed
            ? ["pl-14 pr-0", "group-hover/portrait-cta:pl-0 group-hover/portrait-cta:pr-20", pressed && "pl-0 pr-20"]
            : ["pl-0 pr-14", "group-hover/portrait-cta:pl-20 group-hover/portrait-cta:pr-0", pressed && "pl-20 pr-0"]
        )}
      >
        {/* incoming rule */}
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 h-px w-12 -translate-y-1/2 bg-current opacity-0 transition-all duration-300",
            reversed
              ? ["right-0", "-translate-x-2 group-hover/portrait-cta:translate-x-0 group-hover/portrait-cta:opacity-100", pressed && "translate-x-0 opacity-100"]
              : ["left-0", "translate-x-2 group-hover/portrait-cta:translate-x-0 group-hover/portrait-cta:opacity-100", pressed && "translate-x-0 opacity-100"]
          )}
        />
        <span className="relative z-10">{label}</span>
        {/* outgoing rule */}
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 h-px w-8 -translate-y-1/2 bg-current opacity-100 transition-all duration-300",
            reversed
              ? ["left-5", "translate-x-0 group-hover/portrait-cta:-translate-x-6 group-hover/portrait-cta:opacity-0", pressed && "-translate-x-6 opacity-0"]
              : ["right-5", "translate-x-0 group-hover/portrait-cta:translate-x-6 group-hover/portrait-cta:opacity-0", pressed && "translate-x-6 opacity-0"]
          )}
        />
        <Arrow
          className={cn(
            "pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-all duration-300 group-hover/portrait-cta:opacity-0",
            reversed
              ? ["left-0", "group-hover/portrait-cta:translate-x-1", pressed && "translate-x-1 opacity-0"]
              : ["right-0", "group-hover/portrait-cta:-translate-x-1", pressed && "-translate-x-1 opacity-0"]
          )}
          strokeWidth={1.25}
        />
      </span>
      )}

    </button>
  );
}

export default PortraitCtaLink;
