import { useEffect, useState, useCallback } from "react";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";

const STORAGE_KEY = "trade:show-trade-price";

/** Module-level subscribers so all toggles + price displays stay in sync. */
const listeners = new Set<(v: boolean) => void>();
function readInitial(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw === null ? true : raw === "1";
}
let currentValue = readInitial();

/**
 * Hook: returns whether the user has elected to view trade-discounted prices,
 * along with their tier metadata and a setter that broadcasts to all toggles.
 */
export function useTradePriceMode() {
  const trade = useTradeDiscount();
  const [showTradePrice, setLocal] = useState<boolean>(currentValue);

  useEffect(() => {
    const cb = (v: boolean) => setLocal(v);
    listeners.add(cb);
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const setShowTradePrice = useCallback((v: boolean) => {
    currentValue = v;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    }
    listeners.forEach((l) => l(v));
  }, []);

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
        : `Showing retail price (RRP). Trade tier ${tierLabel}, ${pct} off available.`,
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
        <span
          className={`px-2 py-1 text-xs font-body rounded transition-colors ${
            !showTradePrice
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          RRP
        </span>
        <span
          className={`px-2 py-1 text-xs font-body rounded transition-colors ${
            showTradePrice
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground"
          }`}
        >
          {tierLabel} –{discountLabel}
        </span>
      </button>

      {/* Static description for the switch, read once on focus. */}
      <span id="trade-price-toggle-desc" className="sr-only">
        Toggle between retail price and your {tierLabel} trade price at{" "}
        {discountLabel.replace("%", " percent")} off.
      </span>

      {/* Live region: announces tier + discount on every change. */}
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
