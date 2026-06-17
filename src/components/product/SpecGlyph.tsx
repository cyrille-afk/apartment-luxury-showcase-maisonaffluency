import { cn } from "@/lib/utils";
import { Hexagon, Layers, Mountain, Sparkles, TreeDeciduous } from "lucide-react";

type SpecGlyphProps = {
  symbol: string;
  className?: string;
};

export default function SpecGlyph({ symbol, className }: SpecGlyphProps) {
  const baseClass = cn("inline-flex h-5 w-5 shrink-0 items-center justify-center", className);

  if (symbol === "📐") {
    return (
      <span className={cn(baseClass, "text-[hsl(var(--spec-dimension-icon))]")} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
          <path d="M5 18.5V7.25L16.25 18.5H5Z" fill="currentColor" opacity="0.14" />
          <path d="M5 18.5V7.25L16.25 18.5H5Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
          <path d="M8.25 15.35V18.5M11.3 18.5V17.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" />
        </svg>
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
    // BrickWall — masonry / stone slab / marble / alabaster / onyx
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <BrickWall className="h-[17px] w-[17px]" strokeWidth={1.75} />
      </span>
    );
  }

  if (symbol === "glass") {
    // Custom rounded-flask/diffuser silhouette — reads as a glass diffuser
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 3h6" />
          <path d="M10 3v4.5" />
          <path d="M14 3v4.5" />
          <path d="M7 14a5 5 0 0 0 10 0c0-2.5-3-4-3-6.5h-4C10 10 7 11.5 7 14Z" />
          <path d="M11 12.5c0 1 .8 1.8 1.8 1.8" opacity="0.6" />
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