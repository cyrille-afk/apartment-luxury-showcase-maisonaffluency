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
  const budget = validation.budget ?? null;
  const palette = validation.palette ?? null;

  const summary = ok
    ? "Matches brief"
    : enforcement === "closed"
      ? "Blocked — brief not satisfied"
      : "Does not satisfy brief";

  const Icon = ok ? CheckCircle2 : AlertTriangle;

  const fmtMoney = (cents: number, cur: string) => {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
        cents / 100,
      );
    } catch {
      return `${cur} ${Math.round(cents / 100).toLocaleString("en-US")}`;
    }
  };

  const describeViolation = (v: NonNullable<typeof violations>[number], i: number) => {
    if (v.kind === "budget_over" && typeof v.total_cents === "number" && typeof v.requested_cents === "number") {
      const cur = v.currency || "EUR";
      return (
        <li key={i}>
          <span className="font-medium">Budget over</span>
          <span className="text-muted-foreground">
            {" "}
            — {fmtMoney(v.total_cents, cur)} of {fmtMoney(v.requested_cents, cur)} (
            +{fmtMoney(Math.max(0, v.over_by_cents || 0), cur)})
          </span>
        </li>
      );
    }
    if (v.kind === "budget_currency_mismatch") {
      return (
        <li key={i}>
          <span className="font-medium">Currency mismatch</span>
          <span className="text-muted-foreground">
            {" "}— requested {v.requested}, items priced in {(v.found || []).join(", ")}
          </span>
        </li>
      );
    }
    if (v.kind === "palette_mismatch") {
      const titles = (v.offending_titles || []).slice(0, 4).join(", ");
      const rest = (v.offending_ids?.length || 0) - Math.min(4, v.offending_titles?.length || 0);
      return (
        <li key={i}>
          <span className="font-medium">Off-palette</span>
          <span className="text-muted-foreground">
            {" "}— {titles}
            {rest > 0 ? ` +${rest} more` : ""}
            {v.requested?.length ? ` (palette: ${v.requested.join(" / ")})` : ""}
          </span>
        </li>
      );
    }
    if (v.kind === "brand_mismatch") {
      return (
        <li key={i}>
          <span className="font-medium">Brand mismatch</span>
          <span className="text-muted-foreground">
            {" "}— requested {(v.requested || []).join(", ")}, found {(v.found || []).slice(0, 4).join(", ")}
          </span>
        </li>
      );
    }
    // Slot-based violations (legacy shape from validator uses typology/qty_min/delivered)
    const label = v.slot || v.typology || "slot";
    const req = v.required_qty ?? (v as any).qty_min;
    const del = v.delivered_qty ?? (v as any).delivered;
    return (
      <li key={i}>
        <span className="font-medium">{label}</span>
        {typeof del === "number" && typeof req === "number" ? (
          <span className="text-muted-foreground"> — {del}/{req}</span>
        ) : null}
        {v.reason ? <span className="text-muted-foreground"> — {v.reason}</span> : v.kind ? (
          <span className="text-muted-foreground"> — {v.kind}</span>
        ) : null}
      </li>
    );
  };

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

            {/* Budget summary — always shown when a budget was declared */}
            {budget ? (
              <div className={cn(
                "rounded border px-1.5 py-1",
                budget.ok
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/10",
              )}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Budget</span>
                  <span>
                    {fmtMoney(budget.total_cents, budget.currency)} / {fmtMoney(budget.requested_cents, budget.currency)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {budget.priced_items} priced item{budget.priced_items === 1 ? "" : "s"}
                  {budget.unpriced_items > 0 ? ` · ${budget.unpriced_items} on request` : ""}
                  {!budget.ok ? ` · over by ${fmtMoney(budget.over_by_cents, budget.currency)}` : ""}
                </div>
              </div>
            ) : null}

            {/* Palette summary */}
            {palette ? (
              <div className={cn(
                "rounded border px-1.5 py-1",
                palette.ok
                  ? "border-emerald-500/20 bg-emerald-500/5"
                  : "border-amber-500/30 bg-amber-500/10",
              )}>
                <div className="flex justify-between gap-2">
                  <span className="font-medium">Palette</span>
                  <span>
                    {palette.matched_ids.length}/{palette.matched_ids.length + palette.offending_ids.length} on-palette
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {palette.requested.join(" · ")}
                </div>
              </div>
            ) : null}

            {ok ? (
              <p className="text-muted-foreground">
                Every extracted slot is covered, budget respected, palette on-brief.
                {typeof validation.total_items === "number"
                  ? ` ${validation.total_items} item${validation.total_items === 1 ? "" : "s"} delivered.`
                  : ""}
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-muted-foreground">
                  {enforcement === "closed"
                    ? "The card was blocked because it does not cover the brief:"
                    : "The card was surfaced but does not fully cover the brief:"}
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {violations.slice(0, 6).map((v, i) => describeViolation(v, i))}
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
                  {coverage.slice(0, 6).map((c, i) => {
                    const req = c.required_qty ?? c.qty_min;
                    const del = c.delivered_qty ?? c.delivered;
                    return (
                      <li key={i} className="flex justify-between gap-2">
                        <span className="truncate">
                          {c.slot || c.typology || "slot"}
                          {c.slot && c.typology ? (
                            <span className="text-muted-foreground"> · {c.typology}</span>
                          ) : null}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {del ?? 0}/{req ?? 0}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
