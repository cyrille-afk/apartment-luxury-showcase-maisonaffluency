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
        "group flex flex-col items-start rounded-xl border border-foreground/20 bg-background/70 px-3.5 py-2 text-left shadow-sm",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-background hover:shadow-md hover:shadow-foreground/5",
        "active:translate-y-0 active:scale-[0.99]",
        "focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent/30",
        className
      )}
    >
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {description ? (
        <span className="text-xs italic text-muted-foreground leading-snug">
          {description}
        </span>
      ) : null}
    </button>
  );
};
