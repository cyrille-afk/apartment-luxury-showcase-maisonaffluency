/**
 * FxSourceBadge
 *
 * Small visible indicator next to a currency toggle that tells the user which
 * FX source the displayed conversion used: live ECB rates, a live fallback
 * provider, or the bundled offline reference table. Prevents the "did the
 * conversion actually happen?" ambiguity that hit quote pricing before.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Wifi, WifiOff, CircleDashed, Database } from "lucide-react";
import { type FxSource, describeFxSource } from "@/lib/fxRates";

const toneClasses: Record<string, string> = {
  live:      "border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  fallback:  "border-amber-300/60 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  hardcoded: "border-orange-300/60 bg-orange-50 text-orange-900 dark:bg-orange-950/40 dark:text-orange-200",
  none:      "border-muted-foreground/20 bg-muted text-muted-foreground",
};

export function FxSourceBadge({ source, className = "" }: { source: FxSource; className?: string }) {
  const { label, tone, detail } = describeFxSource(source);
  const Icon = tone === "live" ? Wifi : tone === "fallback" ? WifiOff : tone === "hardcoded" ? Database : CircleDashed;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`FX source: ${label}. ${detail}`}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none tracking-wide uppercase ${toneClasses[tone]} ${className}`}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs text-xs">
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}

export default FxSourceBadge;
