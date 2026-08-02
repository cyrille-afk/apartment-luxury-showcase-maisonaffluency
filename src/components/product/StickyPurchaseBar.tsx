import { cn } from "@/lib/utils";

/**
 * Slim, scroll-activated purchase bar (desktop).
 * Slides down from the top once the main product image scrolls out of view.
 */
export function StickyPurchaseBar({
  visible,
  image,
  title,
  designer,
  price,
  onRequestQuote,
  topOffset = "5rem",
}: {
  visible: boolean;
  image?: string | null;
  title: string;
  designer?: string | null;
  price?: string | null;
  onRequestQuote: () => void;
  topOffset?: string;
}) {
  return (
    <div
      className={cn(
        "hidden lg:block fixed left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur-md transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "-translate-y-[150%] pointer-events-none"
      )}
      style={{ top: topOffset }}
      aria-hidden={!visible}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5 flex items-center gap-4">
        {image && (
          <img
            src={image}
            alt={title}
            loading="lazy"
            className="h-11 w-11 object-cover rounded-luxury-micro border border-border/60 shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm leading-tight truncate">{title}</p>
          {designer && (
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">
              {designer}
            </p>
          )}
        </div>
        {price && (
          <p className="font-body text-xs tabular-nums text-foreground whitespace-nowrap">
            {price}
          </p>
        )}
        <button
          type="button"
          onClick={onRequestQuote}
          className="shrink-0 inline-flex items-center justify-center px-5 py-2.5 rounded-luxury-micro bg-foreground text-background font-body text-[10px] uppercase tracking-[0.12em] hover:bg-foreground/85 transition-colors"
        >
          Request a Quote
        </button>
      </div>
    </div>
  );
}

export default StickyPurchaseBar;
