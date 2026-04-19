/**
 * In-card description overlay — renders inside the image box on hover.
 * Shows as a floating cream/white box below the top icon row.
 *
 * NOTE: Hidden entirely on touch devices (mobile/tablet) — descriptions on
 * mobile live inside the product lightbox only, to keep the grid clean and
 * editorial (matches competitor layouts like Invisible Collection).
 */
import { cn } from "@/lib/utils";

interface Props {
  description: string | null | undefined;
  className?: string;
}

const ProductCardDescriptionOverlay = ({ description, className }: Props) => {
  if (!description || !description.trim()) return null;

  return (
    <div
      className={cn(
        // hidden by default; only revealed on devices that truly support hover
        "hidden [@media(hover:hover)]:block",
        "absolute left-3 right-3 top-12 z-10 pointer-events-none",
        "opacity-0 group-hover:opacity-100 transition-opacity duration-300",
        className
      )}
    >
      <div className="bg-background/90 backdrop-blur-sm rounded-lg shadow-lg px-3.5 py-2.5 border border-border/30">
        <p className="font-body text-xs text-foreground leading-relaxed line-clamp-3">
          {description}
        </p>
      </div>
    </div>
  );
};

export default ProductCardDescriptionOverlay;
