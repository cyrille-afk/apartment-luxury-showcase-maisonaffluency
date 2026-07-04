// Structured validation banner + per-row pill.
//
// Renders the JSON verdict returned by `trade-concierge-validate` inside
// the tearsheet card. Overall banner sits above the pick list; each pick
// row is decorated with a small colored pill by matching `per_row[i].pick_id`.

import { X, AlertTriangle, ShieldCheck } from "lucide-react";
import type { ValidationVerdict, ValidationRow } from "@/lib/tearsheetSyncClient";
import { cn } from "@/lib/utils";

interface BannerProps {
  verdict: ValidationVerdict;
  onDismiss: () => void;
}

const OVERALL_STYLES = {
  green: { wrap: "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-900 dark:text-emerald-100", icon: ShieldCheck, label: "Approved" },
  yellow: { wrap: "border-amber-500/50 bg-amber-500/[0.08] text-amber-950 dark:text-amber-100", icon: AlertTriangle, label: "Warnings" },
  red: { wrap: "border-red-500/50 bg-red-500/[0.08] text-red-950 dark:text-red-100", icon: AlertTriangle, label: "Conflicts" },
} as const;

export function ValidationBanner({ verdict, onDismiss }: BannerProps) {
  const s = OVERALL_STYLES[verdict.overall];
  const Icon = s.icon;
  return (
    <div className={cn("rounded-lg border p-2.5 mb-2.5 animate-fade-in", s.wrap)}>
      <div className="flex items-start gap-2">
        <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[10px] uppercase tracking-widest">
              Validator · {s.label}
            </span>
            <button
              onClick={onDismiss}
              className="opacity-60 hover:opacity-100 transition"
              aria-label="Dismiss validation"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
          {verdict.summary && (
            <p className="mt-1 font-body text-xs leading-relaxed">{verdict.summary}</p>
          )}
          {verdict.global_warnings.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {verdict.global_warnings.map((w, i) => (
                <li key={i} className="font-body text-[11px] leading-snug opacity-90">• {w}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

const PILL_STYLES = {
  green: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/30",
  yellow: "bg-amber-500/20 text-amber-900 dark:text-amber-100 border-amber-500/40",
  red: "bg-red-500/20 text-red-900 dark:text-red-100 border-red-500/40",
} as const;

const PILL_LABEL = { green: "✓", yellow: "!", red: "✕" } as const;

export function RowVerdictPill({ row }: { row: ValidationRow }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-body text-[9px] uppercase tracking-wider",
        PILL_STYLES[row.status],
      )}
      title={row.reason}
    >
      <span className="font-mono">{PILL_LABEL[row.status]}</span>
      <span className="truncate max-w-[180px]">{row.reason}</span>
    </span>
  );
}
