import { useEffect, useState } from "react";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { cn } from "@/lib/utils";

/**
 * Unified top-bar control: combines tier badge + RRP ⇄ Trade price toggle
 * into a single segmented selector. The active "Trade" pill is tinted by tier
 * and carries the discount label, removing the prior duplication between the
 * standalone TierBadge and TradePriceToggle.
 */

interface PriceModeSelectorProps {
  className?: string;
}

export default function PriceModeSelector({ className = "" }: PriceModeSelectorProps) {
  const { showTradePrice, setShowTradePrice } = useTradePriceMode();
  const { tierLabel, discountLabel } = useTradeDiscount();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const pct = discountLabel.replace("%", " percent");
    setAnnouncement(
      showTradePrice
        ? `Showing ${tierLabel} trade price, ${pct} off retail.`
        : `Showing retail price (RRP). Trade tier ${tierLabel}, ${pct} off available.`,
    );
  }, [showTradePrice, tierLabel, discountLabel]);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 bg-background",
        className,
      )}
      role="group"
      aria-label={`Price view — ${tierLabel} tier, ${discountLabel} trade discount`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={!showTradePrice}
        onClick={() => setShowTradePrice(false)}
        className={cn(
          "p-0 text-[10px] font-body uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:underline",
          !showTradePrice
            ? "text-foreground underline underline-offset-4"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Client View
      </button>
      <span className="h-3 w-px bg-border" aria-hidden="true" />
      <button
        type="button"
        role="switch"
        aria-checked={showTradePrice}
        onClick={() => setShowTradePrice(true)}
        className={cn(
          "p-0 text-[10px] font-body uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:underline",
          showTradePrice
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Account: Preferred Trade
      </button>

      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
