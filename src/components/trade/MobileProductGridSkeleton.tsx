import { cn } from "@/lib/utils";

interface MobileProductCardSkeletonProps {
  className?: string;
  /** Must mirror the real card's aspect ratio exactly to avoid layout shift. */
  aspectClassName?: string;
}

/** Premium skeleton card that mirrors the mobile 2-column product card. */
export const MobileProductCardSkeleton = ({
  className,
  aspectClassName = "aspect-square",
}: MobileProductCardSkeletonProps) => (
  <div
    className={cn(
      "relative overflow-hidden rounded-lg border border-border/40 bg-background",
      className
    )}
  >
    {/* Image placeholder — same aspect ratio as the loaded card image */}
    <div
      className={cn("w-full animate-pulse bg-neutral-100", aspectClassName)}
      style={{ willChange: "opacity" }}
    />

    {/* Staggered text placeholders: designer, product name, price status */}
    <div className="flex flex-col items-center gap-2 px-3 py-3">
      <div
        className="h-3 w-4/5 rounded-sm bg-neutral-200 animate-pulse"
        style={{ animationDelay: "0ms", willChange: "opacity" }}
      />
      <div
        className="h-3 w-3/5 rounded-sm bg-neutral-200 animate-pulse"
        style={{ animationDelay: "150ms", willChange: "opacity" }}
      />
      <div
        className="h-2.5 w-2/5 rounded-sm bg-neutral-200 animate-pulse"
        style={{ animationDelay: "300ms", willChange: "opacity" }}
      />
    </div>
  </div>
);

interface MobileProductGridSkeletonProps {
  count?: number;
  className?: string;
}

/** Full-screen mobile grid skeleton for the trade showroom. */
export const MobileProductGridSkeleton = ({
  count = 8,
  className,
}: MobileProductGridSkeletonProps) => (
  <div className={cn("grid grid-cols-2 gap-4", className)}>
    {Array.from({ length: count }).map((_, i) => (
      <MobileProductCardSkeleton key={i} />
    ))}
  </div>
);
