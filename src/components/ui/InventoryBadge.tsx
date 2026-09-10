import { cn } from "@/lib/utils";

interface InventoryBadgeProps {
  label: string;
  className?: string;
}

/**
 * Small, sharp inventory badge for product thumbnails.
 * Used in catalog grids to flag availability / exclusivity in the lower-left
 * corner of a card image, matching an elite art-gallery label aesthetic.
 */
export function InventoryBadge({ label, className }: InventoryBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-zinc-200 bg-white/90 px-2 py-1 font-body text-[9px] uppercase tracking-widest text-zinc-800 backdrop-blur-sm",
        className
      )}
    >
      {label}
    </span>
  );
}

interface InventoryBadgeStackProps {
  badges: string[];
  className?: string;
}

export function InventoryBadgeStack({ badges, className }: InventoryBadgeStackProps) {
  if (!badges.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {badges.map((b) => (
        <InventoryBadge key={b} label={b} />
      ))}
    </div>
  );
}
