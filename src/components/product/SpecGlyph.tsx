import { cn } from "@/lib/utils";

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

  if (symbol === "✦") {
    return (
      <span className={cn(baseClass, "text-gold")} aria-hidden="true">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 2.75C13.45 7.55 16.45 10.55 21.25 12C16.45 13.45 13.45 16.45 12 21.25C10.55 16.45 7.55 13.45 2.75 12C7.55 10.55 10.55 7.55 12 2.75Z" />
        </svg>
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