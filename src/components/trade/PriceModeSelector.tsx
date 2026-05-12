import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { Link } from "react-router-dom";
import { useTradeDiscount, type TradeTier } from "@/hooks/useTradeDiscount";
import { useTradePriceMode } from "@/components/trade/TradePriceToggle";
import { cn } from "@/lib/utils";

/**
 * Unified top-bar control: combines tier badge + RRP ⇄ Trade price toggle
 * into a single segmented selector. The active "Trade" pill is tinted by tier
 * and carries the discount label, removing the prior duplication between the
 * standalone TierBadge and TradePriceToggle.
 */

const TIER_ACTIVE: Record<TradeTier, string> = {
  silver: "bg-slate-800 text-slate-50",
  gold: "bg-amber-600 text-amber-50",
  platinum: "bg-zinc-900 text-zinc-50",
};

interface PriceModeSelectorProps {
  className?: string;
}

export default function PriceModeSelector({ className = "" }: PriceModeSelectorProps) {
  const { showTradePrice, setShowTradePrice } = useTradePriceMode();
  const { tier, tierLabel, discountLabel } = useTradeDiscount();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const pct = discountLabel.replace("%", " percent");
    setAnnouncement(
      showTradePrice
        ? `Showing ${tierLabel} trade price, ${pct} off retail.`
        : `Showing retail price (RRP). Trade tier ${tierLabel}, ${pct} off available.`,
    );
  }, [showTradePrice, tierLabel, discountLabel]);

  const tradeActive = TIER_ACTIVE[tier];

  return (
    <div
      className={cn(
        "inline-flex items-center border border-border rounded-md p-0.5 bg-background",
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
          "px-2.5 py-1 text-[11px] font-body uppercase tracking-[0.12em] rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          !showTradePrice
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        RRP
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={showTradePrice}
        onClick={() => setShowTradePrice(true)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-body uppercase tracking-[0.12em] rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          showTradePrice
            ? tradeActive
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Award className="h-3 w-3" />
        <span>{tierLabel}</span>
        <span className={cn("normal-case tracking-normal", showTradePrice ? "opacity-80" : "opacity-60")}>
          −{discountLabel}
        </span>
      </button>

      <Link
        to="/trade/settings"
        title={`${tierLabel} tier — ${discountLabel} trade discount. Manage in Settings.`}
        aria-label="Tier details and settings"
        className="ml-1 mr-0.5 text-muted-foreground hover:text-foreground text-[10px] font-body"
      >
        ⓘ
      </Link>

      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
