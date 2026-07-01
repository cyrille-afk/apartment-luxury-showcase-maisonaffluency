/**
 * FxAppliedRates
 *
 * Compact, auditable readout of the exact FX rates that were multiplied into
 * the visible converted total. Sits next to the currency toggle / FxSourceBadge
 * so a user can answer "what rate did we use, and from which currency?"
 * without opening devtools or digging through logs.
 *
 * Each pair renders as e.g. `EUR → SGD @ 1.4600` with a subtle tone hint that
 * matches the FxSourceBadge (ECB / fallback / offline). If there are no cross-
 * currency pairs (`identity`), nothing is rendered.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { describeFxSource, type FxSource } from "@/lib/fxRates";

export interface FxAppliedPair {
  src: string;
  tgt: string;
  rate: number;
  source: FxSource;
}

const toneClass: Record<string, string> = {
  live:      "text-emerald-700 dark:text-emerald-300 border-emerald-300/50",
  fallback:  "text-amber-700 dark:text-amber-300 border-amber-300/50",
  hardcoded: "text-orange-800 dark:text-orange-300 border-orange-300/50",
  none:      "text-muted-foreground border-muted-foreground/20",
};

export function FxAppliedRates({
  pairs,
  className = "",
}: {
  pairs: FxAppliedPair[];
  className?: string;
}) {
  if (!pairs.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {pairs.map((p) => {
        const { label, tone, detail } = describeFxSource(p.source);
        // Show enough precision to reconstruct a total: 4dp handles the small
        // rates (JPY, AED) without truncation error on line-item cents.
        const rateStr = p.rate.toLocaleString(undefined, {
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        });
        return (
          <Tooltip key={`${p.src}_${p.tgt}`}>
            <TooltipTrigger asChild>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono leading-none ${toneClass[tone]}`}
                aria-label={`Applied rate: 1 ${p.src} = ${rateStr} ${p.tgt}, source ${label}`}
              >
                {p.src} → {p.tgt} @ {rateStr}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              1 {p.src} = {rateStr} {p.tgt}
              <br />
              Source: {label} — {detail}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

export default FxAppliedRates;
