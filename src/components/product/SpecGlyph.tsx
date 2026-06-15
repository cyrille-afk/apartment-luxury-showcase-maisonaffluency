import { cn } from "@/lib/utils";
import { Layers, TreeDeciduous } from "lucide-react";

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


  return (
    <span className={cn(baseClass, "text-gold")} aria-hidden="true">
      <svg viewBox="0 0 20 20" className="h-[15px] w-[15px]" fill="none">
        <path d="M10 2.75L15.5 10L10 17.25L4.5 10L10 2.75Z" stroke="currentColor" strokeWidth="2.1" strokeLinejoin="miter" />
      </svg>
    </span>
  );
}