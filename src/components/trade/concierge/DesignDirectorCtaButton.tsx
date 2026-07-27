import React from "react";
import { cn } from "@/lib/utils";

export interface DesignDirectorCtaButtonProps {
  label: string;
  description?: string;
  onClick: () => void;
  className?: string;
}

export const DesignDirectorCtaButton: React.FC<DesignDirectorCtaButtonProps> = ({
  label,
  description,
  onClick,
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-start overflow-hidden rounded-xl border border-foreground/20 bg-background/70 px-3.5 py-2 text-left shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-background hover:shadow-md hover:shadow-foreground/5",
        "active:translate-y-0 active:scale-[0.99]",
        "focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/30",
        className
      )}
    >
      {/* Luxury shimmer sweep — disabled when reduced motion is requested */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -translate-x-full skew-x-[-18deg]",
          "bg-gradient-to-r from-transparent via-foreground/8 to-transparent",
          "motion-safe:group-hover:animate-cta-shimmer"
        )}
      />
      <span className="text-sm font-semibold text-foreground link-underline-grow">
        {label}
      </span>
      {description ? (
        <span className="text-xs italic text-muted-foreground leading-snug">
          {description}
        </span>
      ) : null}
    </button>
  );
};
