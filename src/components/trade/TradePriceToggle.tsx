import { useEffect, useState, useCallback } from "react";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";
import { useClientSafeMode } from "@/lib/clientSafeMode";

/**
 * Hook: returns whether the user has elected to view trade-discounted prices,
 * along with their tier metadata and a setter that broadcasts to all toggles.
 */
export function useTradePriceMode() {
  const trade = useTradeDiscount();
  const { clientSafe, setClientSafe } = useClientSafeMode();
  // A single external-store snapshot is the source of truth. An effect-based
  // mirror can briefly render the previous trade view after a remount.
  const showTradePrice = !clientSafe;

  const setShowTradePrice = useCallback((v: boolean) => {
    setClientSafe(!v);
  }, [setClientSafe]);

  return {
    showTradePrice,
    setShowTradePrice,
    ...trade,
  };
}

interface TradePriceToggleProps {
  className?: string;
}

/**
 * Accessible RRP ⇄ Trade price toggle.
 *
 * - Implemented as a labelled `role="switch"` button so screen readers announce
 *   both the control purpose and its checked state.
 * - A visually-hidden `aria-live="polite"` region announces the active tier and
 *   discount percentage whenever the user flips the switch (or when their tier
 *   changes server-side), e.g. "Showing Silver trade price, 12 percent off".
 */
export default function TradePriceToggle({ className = "" }: TradePriceToggleProps) {
  const { showTradePrice, setShowTradePrice, tierLabel, discountLabel } =
    useTradePriceMode();
  const [announcement, setAnnouncement] = useState("");

  // Announce on mount + whenever state/tier changes.
  useEffect(() => {
    const pct = discountLabel.replace("%", " percent");
    setAnnouncement(
      showTradePrice
        ? `Showing ${tierLabel} trade price, ${pct} off retail.`
        : "Showing client prices.",
    );
  }, [showTradePrice, tierLabel, discountLabel]);

  const labelId = "trade-price-toggle-label";

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <span id={labelId} className="text-xs font-body text-muted-foreground">
        Price view
      </span>

      <button
        type="button"
        role="switch"
        aria-checked={showTradePrice}
        aria-labelledby={labelId}
        aria-describedby="trade-price-toggle-desc"
        onClick={() => setShowTradePrice(!showTradePrice)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setShowTradePrice(!showTradePrice);
          }
        }}
        className="inline-flex items-center border border-border rounded-md p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span data-trade-sensitive
          className={`px-2 py-1 text-xs font-body rounded transition-colors ${
            !showTradePrice
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
           Client
        </span>
        <span
          className={`px-2 py-1 text-xs font-body rounded transition-colors ${
            showTradePrice
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          {showTradePrice ? `${tierLabel} –${discountLabel}` : "Trade"}
        </span>
      </button>

      {/* Static description for the switch, read once on focus. */}
      <span id="trade-price-toggle-desc" className="sr-only">
         Toggle between client and trade prices.
      </span>

      {/* Live region: announces tier + discount on every change. */}
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
