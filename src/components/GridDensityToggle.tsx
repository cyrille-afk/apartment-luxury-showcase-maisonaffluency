import { Grid3X3, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pill-style 3/4-column grid density toggle — the same control used on the
 * room category pages (ProductGrid). Desktop only; the active icon renders
 * as a filled dark chip, the inactive one as a light outline.
 */
export default function GridDensityToggle({
  value,
  onChange,
  className,
  disabled = false,
}: {
  /** Currently active desktop column count (3 or 4). */
  value: 3 | 4;
  onChange: (next: 3 | 4) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-1 rounded-full border border-border bg-background/80 p-1 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {([3, 4] as const).map((cols) => {
        const active = value === cols;
        const Icon = cols === 4 ? LayoutGrid : Grid3X3;
        return (
          <button
            key={cols}
            type="button"
            disabled={disabled}
            onClick={() => onChange(cols)}
            aria-label={`Display ${cols} columns`}
            aria-pressed={active}
            title={`Display ${cols} columns`}
            className={cn(
              "rounded-full p-2 transition-all disabled:opacity-40",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon size={15} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}
