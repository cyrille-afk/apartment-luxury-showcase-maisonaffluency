import { Award } from "lucide-react";
import { Link } from "react-router-dom";
import { useTradeDiscount, type TradeTier } from "@/hooks/useTradeDiscount";
import { cn } from "@/lib/utils";

const TIER_STYLES: Record<TradeTier, { wrap: string; dot: string }> = {
  silver: {
    wrap: "bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200/70",
    dot: "text-slate-600",
  },
  gold: {
    wrap: "bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200/70",
    dot: "text-amber-700",
  },
  platinum: {
    wrap:
      "bg-gradient-to-r from-zinc-200 via-white to-zinc-200 text-zinc-900 border-zinc-300 hover:brightness-95",
    dot: "text-zinc-700",
  },
};

interface TierBadgeProps {
  className?: string;
  asLink?: boolean;
  showDiscount?: boolean;
}

export const TierBadge = ({
  className,
  asLink = true,
  showDiscount = false,
}: TierBadgeProps) => {
  const { tier, tierLabel, discountLabel } = useTradeDiscount();
  const styles = TIER_STYLES[tier];

  const content = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors",
        styles.wrap,
        className
      )}
      aria-label={`${tierLabel} trade tier — ${discountLabel} discount`}
    >
      <Award className={cn("h-3.5 w-3.5", styles.dot)} />
      <span>{tierLabel}</span>
      {showDiscount && (
        <span className="opacity-70 normal-case tracking-normal">· {discountLabel}</span>
      )}
    </span>
  );

  if (!asLink) return content;
  return (
    <Link to="/trade/settings" title={`${tierLabel} tier · ${discountLabel} trade discount`}>
      {content}
    </Link>
  );
};

export default TierBadge;
