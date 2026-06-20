import { cn } from "@/lib/utils";
import { Hexagon, Layers, Mountain, Ruler, Sparkles, TreeDeciduous } from "lucide-react";

type SpecGlyphProps = {
  symbol: string;
  className?: string;
};

export default function SpecGlyph({ symbol, className }: SpecGlyphProps) {
  const baseClass = cn("inline-flex h-5 w-5 shrink-0 items-center justify-center", className);

  if (symbol === "📐") {
    return (
      <span className={cn(baseClass, "text-[hsl(var(--spec-dimension-icon))]")} aria-hidden="true">
        <Ruler className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
    );
  }

  if (symbol === "✦" || symbol === "fabric") {
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <Layers className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
    );
  }

  if (symbol === "wood") {
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <TreeDeciduous className="h-[18px] w-[18px]" strokeWidth={1.75} />
      </span>
    );
  }

  if (symbol === "metal") {
    // Hexagon — industrial / forged metal hardware
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <Hexagon className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </span>
    );
  }

  if (symbol === "stone") {
    // Mountain — natural quarried rock / marble / alabaster / onyx
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <Mountain className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </span>
    );
  }

  if (symbol === "glass") {
    // Rounded panel with diagonal reflections — reads as glass / crystal / mirror
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />
          <path d="M15 6l-6 12" opacity="0.45" />
          <path d="M18 9l-3 6" opacity="0.25" />
        </svg>
      </span>
    );
  }

  if (symbol === "finish") {
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <Sparkles className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </span>
    );
  }


  return (
    <span className={cn(baseClass, "text-gold")} aria-hidden="true">
      <svg viewBox="0 0 20 20" className="h-[15px] w-[15px]" fill="none">
        <path d="M10 2.75L15.5 10L10 17.25L4.5 10L10 2.75Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      </svg>
    </span>
  );
}