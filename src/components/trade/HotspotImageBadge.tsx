import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small overlay badge shown on a thumbnail when the image was sourced from
 * `gallery_hotspots` instead of the product's own `image_url` column.
 * Helps the trade team spot products that still need a primary photo.
 */
export function HotspotImageBadge({ className }: { className?: string }) {
  return (
    <span
      title="Image sourced from gallery hotspot — product is missing a primary photo"
      aria-label="Image sourced from gallery hotspot"
      className={cn(
        "absolute top-1 left-1 z-10 inline-flex items-center gap-0.5 rounded-full bg-background/85 backdrop-blur-sm border border-border px-1.5 py-0.5 font-body text-[9px] uppercase tracking-widest text-muted-foreground shadow-sm pointer-events-auto",
        className,
      )}
    >
      <ImageIcon className="h-2.5 w-2.5" aria-hidden="true" />
      <span>Hotspot</span>
    </span>
  );
}
