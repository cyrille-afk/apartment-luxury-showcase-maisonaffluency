import React, { useEffect, useState } from "react";
import { Loader2, MessageSquare, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollDirection } from "@/hooks/useScrollDirection";

export interface StickyPurchaseBarProps {
  /** Product name, e.g. "Segment Console Table" */
  title: string;
  /** Maker / designer line shown beneath the title */
  designer?: string | null;
  /** Formatted price, e.g. "FROM $57,000" */
  price?: string | null;
  /** Optional currency suffix, e.g. "USD" */
  currencyCode?: string | null;
  /** Primary image URL */
  image?: string | null;
  onRequestQuote: () => void;
  /** Direct Stripe checkout for the current product + selected finish */
  onPlaceOrder?: () => void;
  /** Shows a spinner while the checkout session is being created */
  placingOrder?: boolean;
  /** Element whose bottom edge leaving the viewport reveals the bar */
  triggerId?: string;
  /** Distance from the top of the viewport (clears the fixed site header) */
  topOffset?: string;
  /** Force visibility instead of using the internal scroll observer */
  visible?: boolean;
}

/**
 * Slim, scroll-activated purchase bar (desktop).
 * Slides down once the main product image container leaves the viewport top.
 */
export function StickyPurchaseBar({
  title,
  designer,
  price,
  currencyCode,
  image,
  onRequestQuote,
  onPlaceOrder,
  placingOrder = false,
  triggerId = "main-product-image-container",
  topOffset,
  visible,
}: StickyPurchaseBarProps) {
  const [scrolledPast, setScrolledPast] = useState(false);
  const { direction, scrollY } = useScrollDirection();
  // Mirror the global nav's hide condition so the bar only snaps flush to the
  // top once the nav has actually slid away (otherwise it hides behind it).
  const navHidden = direction === "down" && scrollY > 240;

  useEffect(() => {
    if (visible !== undefined) return;
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setScrolledPast(false);
        return;
      }
      const trigger = document.getElementById(triggerId);
      if (!trigger) {
        setScrolledPast(window.scrollY > 500);
        return;
      }
      const rect = trigger.getBoundingClientRect();
      // The image column is sticky, so fall back to a scroll threshold once the
      // element stops moving with the page.
      setScrolledPast(rect.bottom < 0 || window.scrollY > rect.height * 0.75);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [triggerId, visible]);

  const isVisible = visible ?? scrolledPast;

  return (
    <div
      className={cn(
        "hidden lg:block fixed left-0 right-0 w-full z-40",
        // Smart scroll: flush to the very top while scrolling down (global nav
        // is hidden), tucked under the nav when scrolling back up.
        navHidden ? "top-0" : "top-[64px]",
        "bg-white/95 backdrop-blur-md border-b border-border shadow-sm",
        "transition-all duration-300 ease-in-out transform will-change-transform",
        isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-2 pointer-events-none"
      )}
      style={topOffset ? { top: topOffset } : undefined}
    >
      <div className="max-w-7xl mx-auto w-full px-6 h-16 flex items-center justify-between gap-4">
        {/* Product identity */}
        <div className="flex items-center gap-4 min-w-0">
          {image && (
            <img
              src={image}
              alt={title}
              loading="lazy"
              className="h-12 w-12 object-cover bg-muted rounded-luxury-micro border border-border/60 shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="font-display text-sm leading-tight truncate">{title}</p>
            <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate mt-0.5">
              {designer}
              {designer && price ? " · " : ""}
              {price}
              {price && currencyCode ? (
                <span className="text-muted-foreground/70"> {currencyCode}</span>
              ) : null}
            </p>
          </div>
        </div>

        {/* Actions — primary checkout first, secondary quote second */}
        <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
          {onPlaceOrder && (
            <button
              type="button"
              onClick={onPlaceOrder}
              disabled={placingOrder}
              className={cn(
                "inline-flex items-center gap-2 px-7 py-3 rounded-luxury-micro",
                "bg-foreground text-background font-body text-[10px] uppercase tracking-[0.16em]",
                "shadow-sm hover:bg-foreground/85 transition-colors disabled:opacity-60"
              )}
            >
              {placingOrder ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShoppingBag className="h-3.5 w-3.5" />
              )}
              <span>{placingOrder ? "Opening checkout…" : "Place Order"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRequestQuote}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-3 rounded-luxury-micro",
              "border border-foreground/25 text-foreground font-body text-[10px] uppercase tracking-[0.14em]",
              "hover:border-foreground/60 transition-colors"
            )}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Request a Quote</span>
          </button>
        </div>

      </div>
    </div>
  );
}

export default StickyPurchaseBar;
