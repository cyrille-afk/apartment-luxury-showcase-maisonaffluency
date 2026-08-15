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
  /** Renders a single trailing/leading hairline instead of an arrow. */
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
      {longArrow ? (
        <span className="relative inline-flex items-center gap-5 whitespace-nowrap">
          {reversed && <LongArrow reversed pressed={pressed} />}
          <span className="relative z-10">{label}</span>
          {!reversed && <LongArrow pressed={pressed} />}
        </span>
      ) : (
      <span
        className={cn(
          "relative inline-flex items-center whitespace-nowrap duration-300",
          reversed
            ? ["pl-14 pr-0", "group-hover:pl-0 group-hover:pr-20", pressed && "pl-0 pr-20"]
            : ["pl-0 pr-14", "group-hover:pl-20 group-hover:pr-0", pressed && "pl-20 pr-0"]
        )}
      >
        {/* incoming rule */}
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 h-px w-12 -translate-y-1/2 bg-current opacity-0 transition-all duration-300",
            reversed
              ? ["right-0", "-translate-x-2 group-hover:translate-x-0 group-hover:opacity-100", pressed && "translate-x-0 opacity-100"]
              : ["left-0", "translate-x-2 group-hover:translate-x-0 group-hover:opacity-100", pressed && "translate-x-0 opacity-100"]
          )}
        />
        <span className="relative z-10">{label}</span>
        {/* outgoing rule */}
        <span
          className={cn(
            "pointer-events-none absolute top-1/2 h-px w-8 -translate-y-1/2 bg-current opacity-100 transition-all duration-300",
            reversed
              ? ["left-5", "translate-x-0 group-hover:-translate-x-6 group-hover:opacity-0", pressed && "-translate-x-6 opacity-0"]
              : ["right-5", "translate-x-0 group-hover:translate-x-6 group-hover:opacity-0", pressed && "translate-x-6 opacity-0"]
          )}
        />
        <Arrow
          className={cn(
            "pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-all duration-300 group-hover:opacity-0",
            reversed
              ? ["left-0", "group-hover:translate-x-1", pressed && "translate-x-1 opacity-0"]
              : ["right-0", "group-hover:-translate-x-1", pressed && "-translate-x-1 opacity-0"]
          )}
          strokeWidth={1.25}
        />
      </span>
      )}

    </button>
  );
}

export default PortraitCtaLink;
