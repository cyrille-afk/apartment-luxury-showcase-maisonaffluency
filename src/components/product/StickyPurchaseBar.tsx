import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useScrollDirection } from "@/hooks/useScrollDirection";
import { setStickyProductBarActive } from "@/lib/stickyProductBar";

export interface StickyPurchaseBarProps {
  /** Product name, e.g. "Portal Dining Table" */
  title: string;
  /** Maker / designer line (unused in the single-line layout, kept for compat) */
  designer?: string | null;
  /** Formatted price, e.g. "$33,000" */
  price?: string | null;
  /** Optional currency suffix, e.g. "USD" */
  currencyCode?: string | null;
  /** Primary image URL (unused in the single-line layout, kept for compat) */
  image?: string | null;
  onRequestQuote: () => void;
  /** Direct Stripe checkout for the current product + selected finish */
  onPlaceOrder?: () => void;
  /** Shows a spinner while the checkout session is being created */
  placingOrder?: boolean;
  /** Element whose bottom edge leaving the viewport arms the bar */
  triggerId?: string;
  /** Distance from the top of the viewport */
  topOffset?: string;
  /** Force visibility instead of using the internal scroll observer */
  visible?: boolean;
}

/**
 * Ultra-minimal single-line (60px) sticky product header.
 * Armed once the main product image leaves the viewport, then revealed
 * whenever the user scrolls up — while the global nav stays hidden.
 */
export function StickyPurchaseBar({
  title,
  price,
  currencyCode,
  onRequestQuote,
  onPlaceOrder,
  placingOrder = false,
  triggerId = "main-product-image-container",
  topOffset,
  visible,
}: StickyPurchaseBarProps) {
  const [armed, setArmed] = useState(false);
  const { direction, scrollY } = useScrollDirection();

  // Reuse the sidebar CTA panel so the mini-cart drawer / Trade Exclusive
  // Access lightbox open exactly as they do from the main panel.
  const fireCommerce = (selector: string, fallback?: () => void) => {
    const target = document.querySelector<HTMLElement>(selector);
    if (target) target.click();
    else fallback?.();
  };
  const handlePlaceOrder = () => fireCommerce("[data-commerce-primary]", onPlaceOrder);
  const handleRequestQuote = () => fireCommerce("[data-commerce-secondary]", onRequestQuote);

  useEffect(() => {
    if (visible !== undefined) return;
    if (typeof window === "undefined") return;

    const handleScroll = () => {
      if (!window.matchMedia("(min-width: 1024px)").matches) {
        setArmed(false);
        return;
      }
      const y = window.scrollY;
      // Disarm only when the user is genuinely back near the top.
      if (y < 200) {
        setArmed(false);
        return;
      }
      const trigger = document.getElementById(triggerId);
      if (!trigger) {
        if (y > 500) setArmed(true);
        return;
      }
      const rect = trigger.getBoundingClientRect();
      // Latch on once the hero image has effectively been passed.
      if (rect.bottom < 0 || y > rect.height * 0.75) setArmed(true);
    };


    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [triggerId, visible]);

  // Stay visible once armed after the hero image leaves the viewport; hide again near the top.
  const isVisible = visible ?? (armed && scrollY > 240);

  useEffect(() => {
    setStickyProductBarActive(isVisible);
    return () => setStickyProductBarActive(false);
  }, [isVisible]);

  return (
    <div
      className={cn(
        "hidden lg:block fixed left-0 right-0 top-0 w-full z-[60]",
        "bg-white/90 backdrop-blur-md border-b border-neutral-100 shadow-sm",
        "transition-all duration-300 ease-in-out transform will-change-transform",
        isVisible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 -translate-y-full pointer-events-none"
      )}
      style={topOffset ? { top: topOffset } : undefined}
    >
      <div className="max-w-7xl mx-auto w-full h-[60px] px-6 flex items-center gap-6">
        {/* Far left — brand */}
        <a
          href="/"
          className="font-brand text-[13px] tracking-[0.28em] text-foreground whitespace-nowrap hover:opacity-70 transition-opacity shrink-0"
        >
          MAISON AFFLUENCY
        </a>

        {/* Center — product title + price */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <p className="font-display text-sm leading-none truncate text-center">
            {title}
            {price ? (
              <span className="text-muted-foreground">
                {" — "}
                {price}
                {currencyCode ? (
                  <span className="text-muted-foreground/70"> {currencyCode}</span>
                ) : null}
              </span>
            ) : null}
          </p>
        </div>

        {/* Far right — primary then secondary, mirroring the sidebar CTA hierarchy */}
        <div className="flex items-center gap-2 shrink-0">
          {onPlaceOrder && (
            <button
              type="button"
              onClick={handlePlaceOrder}
              disabled={placingOrder}
              className={cn(
                "inline-flex items-center h-8 px-4 rounded-none",
                "bg-foreground text-background font-body text-[10px] uppercase tracking-widest",
                "hover:bg-foreground/85 transition-colors disabled:opacity-60"
              )}
            >
              {placingOrder && <Loader2 className="h-3 w-3 animate-spin mr-2" />}
              <span>{placingOrder ? "Opening checkout…" : "Place Order"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRequestQuote}
            className={cn(
              "inline-flex items-center h-8 px-4 rounded-none",
              "border border-foreground bg-background text-foreground font-body text-[10px] uppercase tracking-widest",
              "transition-colors hover:bg-muted/60"
            )}
          >
            Request a Quote or Customisation
          </button>
        </div>

      </div>
    </div>
  );
}

export default StickyPurchaseBar;
