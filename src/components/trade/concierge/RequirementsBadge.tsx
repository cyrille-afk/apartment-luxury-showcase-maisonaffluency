import { CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RequirementsValidation } from "@/lib/tradeConciergeStream";

/**
 * Small pill rendered on every card-producing proposal (tearsheet, quote,
 * FF&E, viz brief) showing whether the assembled pick_ids satisfy the
 * `extract_requirements` payload from the same turn.
 *
 *   ok → "Matches brief"
 *   !ok → "Does not satisfy brief" + tooltip listing per-slot shortfalls
 *
 * Silently renders nothing when the server did not attach a validation
 * result (e.g. discovery turn with no requirements captured).
 */
export function RequirementsBadge({ validation }: { validation?: RequirementsValidation | null }) {
  if (!validation) return null;
  const ok = validation.ok === true;
  const violations = validation.violations ?? [];
  const coverage = validation.coverage ?? [];
  const enforcement = validation.enforcement ?? "open";

  const summary = ok
    ? "Matches brief"
    : enforcement === "closed"
      ? "Blocked — brief not satisfied"
      : "Does not satisfy brief";

  const Icon = ok ? CheckCircle2 : AlertTriangle;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={summary}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none",
              ok
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            <span className="truncate">{summary}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" align="start" className="max-w-xs">
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-3 w-3" />
              Requirements validation
            </div>
            {ok ? (
              <p className="text-muted-foreground">
                Every extracted slot is covered by the assembled pieces.
                {typeof validation.total_items === "number" ? ` ${validation.total_items} item${validation.total_items === 1 ? "" : "s"} delivered.` : ""}
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-muted-foreground">
                  {enforcement === "closed"
                    ? "The card was blocked because it does not cover the brief:"
                    : "The card was surfaced but does not fully cover the brief:"}
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {violations.slice(0, 6).map((v, i) => (
                    <li key={i}>
                      {v.slot ? <span className="font-medium">{v.slot}</span> : null}
                      {v.typology ? <span className="text-muted-foreground"> · {v.typology}</span> : null}
                      {typeof v.required_qty === "number" && typeof v.delivered_qty === "number" ? (
                        <span className="text-muted-foreground"> · {v.delivered_qty}/{v.required_qty}</span>
                      ) : null}
                      {v.reason ? <span className="text-muted-foreground"> — {v.reason}</span> : null}
                    </li>
                  ))}
                  {violations.length > 6 ? (
                    <li className="text-muted-foreground">…{violations.length - 6} more</li>
                  ) : null}
                </ul>
              </div>
            )}
            {coverage.length > 0 && !ok ? (
              <div className="pt-1 border-t border-border/50">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Coverage</div>
                <ul className="space-y-0.5">
                  {coverage.slice(0, 6).map((c, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span className="truncate">
                        {c.slot}
                        {c.typology ? <span className="text-muted-foreground"> · {c.typology}</span> : null}
                      </span>
                      <span className="text-muted-foreground shrink-0">
                        {c.delivered_qty ?? 0}/{c.required_qty ?? 0}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
