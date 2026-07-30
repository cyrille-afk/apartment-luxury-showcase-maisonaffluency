import { cn } from "@/lib/utils";

/**
 * CuratedGridSkeleton
 *
 * Premium loading state for the discovery grid produced by
 * "[ Source Similar Pieces ]". Instead of flashing grey boxes, it sketches the
 * gallery canvas: warm-bone blocks with a single, slow (2.2s, ease-in-out)
 * translucent light sweep. Structure mirrors <CuratedInventoryGrid /> so the
 * real cards land in place with no layout shift.
 */

type Props = {
  /** How many placeholder cards to sketch (capped at the 4-card grid cap). */
  count?: number;
  className?: string;
};

/** Warm bone block with a gentle left→right light sweep. */
function Block({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-[hsl(45_11%_95%)] dark:bg-muted/25",
        className,
      )}
    >
      <div
        className="absolute inset-y-0 -left-1/2 w-1/2 animate-curator-sweep bg-gradient-to-r from-transparent via-background/70 to-transparent"
        style={{ animationDelay: `${delay}ms` }}
      />
    </div>
  );
}

export function CuratedGridSkeleton({ count = 4, className }: Props) {
  const cards = Array.from({ length: Math.min(Math.max(count, 3), 4) });
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Curating pieces"
      className={cn("w-full max-w-[92%] self-start animate-fade-in", className)}
    >
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <div className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Curating inventory · sketching your edit
        </div>
        <Block className="h-2 w-16 rounded-sm" delay={200} />
      </div>

      <div className="grid grid-cols-1 gap-x-6 gap-y-8 md:grid-cols-2">
        {cards.map((_, i) => (
          <div key={i} className="flex flex-col">
            {/* Image plate — asymmetrical heights keep the canvas hand-sketched. */}
            <Block
              className={cn("w-full rounded-md", i % 2 === 0 ? "aspect-[4/3]" : "aspect-[5/4]")}
              delay={i * 160}
            />
            <div className="pt-3">
              <Block className="h-[8px] w-[35%] rounded-sm" delay={i * 160 + 80} />
              <Block className="mt-2.5 h-[12px] w-[60%] rounded-sm" delay={i * 160 + 140} />
              <Block className="mt-2 h-[10px] w-[40%] rounded-sm" delay={i * 160 + 200} />
            </div>
          </div>
        ))}
      </div>

      <span className="sr-only">The concierge is composing your curated edit.</span>
    </div>
  );
}

export default CuratedGridSkeleton;
