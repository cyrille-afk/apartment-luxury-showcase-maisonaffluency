// TearsheetInsightsSidebar
//
// Docked right-hand column that surfaces the Validate/Sync verdict and the
// cascading re-alignment delta OUTSIDE the concierge panel so the pick list
// keeps its full width. Card→row navigation only (per user scope choice):
// clicking an item in the sidebar scrolls the corresponding row into view
// inside the card and flashes a highlight ring.
//
// Positioned via portal to `document.body` so it can sit alongside the
// floating concierge panel. Hidden on viewports narrower than `lg` — the
// card falls back to its own inline banner/diff rendering on small screens.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, ShieldCheck, AlertTriangle, Info, Sparkles, ArrowRight, Plus, Trash2, Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationVerdict, RealignmentDelta, RealignPreview } from "@/lib/tearsheetSyncClient";
import type { PickPreview } from "@/lib/tradeConciergeStream";
import type { AppliedRealignment } from "@/components/trade/concierge/RealignmentDiffPanel";

interface Props {
  verdictLoading: boolean;
  verdict: ValidationVerdict | null;
  deltaLoading: boolean;
  delta: RealignmentDelta | null;
  lockedItems: PickPreview[];
  keptUnlockedItems: PickPreview[];
  previewById: Map<string, PickPreview>;
  onDismissVerdict: () => void;
  onDismissDelta: () => void;
  onApplyRealignment: (applied: AppliedRealignment) => void;
  onFocusRow: (pickId: string) => void;
}

const SEVERITY = {
  red:    { dot: "bg-red-500",    ring: "ring-red-500/30",    text: "text-red-700 dark:text-red-200",    label: "Critical" },
  yellow: { dot: "bg-amber-500",  ring: "ring-amber-500/30",  text: "text-amber-800 dark:text-amber-100", label: "Warning"  },
  green:  { dot: "bg-emerald-500",ring: "ring-emerald-500/30",text: "text-emerald-700 dark:text-emerald-200", label: "OK"    },
} as const;

const SEV_ORDER: Record<"red" | "yellow" | "green", number> = { red: 0, yellow: 1, green: 2 };

export function TearsheetInsightsSidebar({
  verdictLoading, verdict, deltaLoading, delta,
  lockedItems, keptUnlockedItems, previewById,
  onDismissVerdict, onDismissDelta, onApplyRealignment, onFocusRow,
}: Props) {
  const [showApproved, setShowApproved] = useState(false);
  const [replDecisions, setReplDecisions] = useState<Record<string, "pending" | "accepted" | "rejected">>({});
  const [addDecisions, setAddDecisions] = useState<Record<string, "pending" | "accepted" | "rejected">>({});
  const [remDecisions, setRemDecisions] = useState<Record<string, "pending" | "accepted" | "rejected">>({});

  // Re-seed decisions whenever a new delta arrives.
  useEffect(() => {
    if (!delta) return;
    setReplDecisions(Object.fromEntries(delta.replacements.map((r) => [r.old_pick_id, "pending"])));
    setAddDecisions(Object.fromEntries(delta.additions.map((a) => [a.new_pick_id, "pending"])));
    setRemDecisions(Object.fromEntries(delta.removals.map((r) => [r.pick_id, "pending"])));
  }, [delta]);

  const rowsSorted = useMemo(() => {
    if (!verdict) return [];
    const rows = [...verdict.per_row].sort((a, b) => SEV_ORDER[a.status] - SEV_ORDER[b.status]);
    return showApproved ? rows : rows.filter((r) => r.status !== "green");
  }, [verdict, showApproved]);

  const greenCount = verdict?.per_row.filter((r) => r.status === "green").length ?? 0;
  const yellowCount = verdict?.per_row.filter((r) => r.status === "yellow").length ?? 0;
  const redCount = verdict?.per_row.filter((r) => r.status === "red").length ?? 0;

  const newPreviewById = useMemo(() => {
    if (!delta) return new Map<string, RealignPreview>();
    return new Map(delta.new_previews.map((p) => [p.id, p]));
  }, [delta]);
  const keptById = useMemo(() => new Map(keptUnlockedItems.map((k) => [k.id, k])), [keptUnlockedItems]);

  const acceptAll = () => {
    if (!delta) return;
    setReplDecisions(Object.fromEntries(delta.replacements.map((r) => [r.old_pick_id, "accepted"])));
    setAddDecisions(Object.fromEntries(delta.additions.map((a) => [a.new_pick_id, "accepted"])));
    setRemDecisions(Object.fromEntries(delta.removals.map((r) => [r.pick_id, "accepted"])));
  };

  const applyAll = () => {
    if (!delta) return;
    const toAdd: RealignPreview[] = [];
    const toRemove: string[] = [];
    const replaceMap = new Map<string, RealignPreview>();
    for (const r of delta.replacements) {
      if (replDecisions[r.old_pick_id] !== "accepted") continue;
      const preview = newPreviewById.get(r.new_pick_id);
      if (preview) replaceMap.set(r.old_pick_id, preview);
    }
    for (const a of delta.additions) {
      if (addDecisions[a.new_pick_id] !== "accepted") continue;
      const preview = newPreviewById.get(a.new_pick_id);
      if (preview) toAdd.push(preview);
    }
    for (const r of delta.removals) {
      if (remDecisions[r.pick_id] !== "accepted") continue;
      toRemove.push(r.pick_id);
    }
    onApplyRealignment({ toAdd, toRemove, replaceMap });
  };

  const acceptedCount =
    Object.values(replDecisions).filter((v) => v === "accepted").length +
    Object.values(addDecisions).filter((v) => v === "accepted").length +
    Object.values(remDecisions).filter((v) => v === "accepted").length;

  // Nothing to show → don't mount.
  const hasAnything = verdictLoading || verdict || deltaLoading || delta;
  if (!hasAnything) return null;

  const content = (
    <aside
      className={cn(
        "hidden lg:flex fixed z-[10001] bottom-6 right-[calc(1rem+560px+12px)] w-[340px]",
        "max-h-[calc(100vh-4rem)] flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden animate-fade-in",
      )}
      aria-label="AI Insights"
      style={{ height: 600 }}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5 bg-muted/40">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-display text-[11px] uppercase tracking-widest text-foreground">AI Insights</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* ── Loading states ── */}
        {(verdictLoading || deltaLoading) && (
          <div className="space-y-1.5">
            {verdictLoading && (
              <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="font-body text-[11px] text-muted-foreground">Validator reviewing edits…</span>
              </div>
            )}
            {deltaLoading && (
              <div className="flex items-center gap-2 rounded-md border border-accent/40 bg-accent/[0.04] px-2 py-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                <span className="font-body text-[11px] text-accent">Re-aligner considering alternatives…</span>
              </div>
            )}
          </div>
        )}

        {/* ── Section B: Validation Log ── */}
        {verdict && !verdictLoading && (
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <h5 className="font-display text-[10px] uppercase tracking-widest text-foreground">Validation Log</h5>
              <button
                onClick={onDismissVerdict}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label="Dismiss validation log"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {verdict.summary && (
              <p className="font-body text-[11px] leading-relaxed text-muted-foreground italic mb-2">{verdict.summary}</p>
            )}

            <div className="flex items-center gap-1.5 mb-2 text-[10px] font-body">
              {redCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-1.5 py-0.5 text-red-700 dark:text-red-200"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />{redCount} critical</span>
              )}
              {yellowCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-amber-800 dark:text-amber-100"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />{yellowCount} warning</span>
              )}
              {greenCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-200"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{greenCount} ok</span>
              )}
            </div>

            {/* Global warnings — informational */}
            {verdict.global_warnings.length > 0 && (
              <div className="mb-2 rounded-md border border-sky-500/40 bg-sky-500/[0.06] px-2 py-1.5">
                <div className="flex items-start gap-1.5">
                  <Info className="h-3 w-3 mt-0.5 text-sky-700 dark:text-sky-300 shrink-0" />
                  <ul className="space-y-0.5 font-body text-[10.5px] leading-snug text-sky-900 dark:text-sky-100">
                    {verdict.global_warnings.map((w, i) => (<li key={i}>{w}</li>))}
                  </ul>
                </div>
              </div>
            )}

            {/* Per-row cards */}
            {rowsSorted.length === 0 ? (
              <p className="font-body text-[11px] text-muted-foreground italic">No issues flagged.</p>
            ) : (
              <ul className="space-y-1.5">
                {rowsSorted.map((row) => {
                  const sev = SEVERITY[row.status];
                  const pick = previewById.get(row.pick_id);
                  return (
                    <li key={row.pick_id}>
                      <button
                        type="button"
                        onClick={() => onFocusRow(row.pick_id)}
                        className={cn(
                          "w-full text-left rounded-md border bg-background px-2 py-1.5 transition-colors hover:bg-muted/40",
                          row.status === "red" && "border-red-500/40",
                          row.status === "yellow" && "border-amber-500/40",
                          row.status === "green" && "border-emerald-500/30 opacity-80",
                        )}
                        aria-label={`Scroll to ${pick?.title || "pick"}: ${row.reason}`}
                      >
                        <div className="flex items-start gap-1.5">
                          <span className={cn("mt-1 h-1.5 w-1.5 rounded-full shrink-0", sev.dot)} />
                          <div className="flex-1 min-w-0">
                            {pick && (
                              <div className="font-body text-[11px] text-foreground truncate">
                                {pick.title}
                                {pick.designer_name && <span className="text-muted-foreground"> · {pick.designer_name}</span>}
                              </div>
                            )}
                            <div className={cn("font-body text-[10.5px] leading-snug mt-0.5", sev.text)}>
                              {row.reason}
                            </div>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {greenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowApproved((v) => !v)}
                className="mt-2 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
              >
                {showApproved ? "Hide approved" : `Show ${greenCount} approved`}
              </button>
            )}
          </section>
        )}

        {/* ── Section C: Realignment ── */}
        {delta && !deltaLoading && (
          <section>
            <div className="flex items-center justify-between mb-1.5">
              <h5 className="font-display text-[10px] uppercase tracking-widest text-foreground">Realignment</h5>
              <button
                onClick={onDismissDelta}
                className="text-muted-foreground hover:text-foreground transition"
                aria-label="Dismiss realignment"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {delta.summary && (
              <p className="font-body text-[11px] leading-relaxed text-muted-foreground italic mb-2">{delta.summary}</p>
            )}

            {lockedItems.length > 0 && (
              <div className="mb-2 rounded-md border border-accent/30 bg-accent/[0.04] px-2 py-1.5">
                <div className="flex items-center gap-1.5 font-body text-[10px] uppercase tracking-widest text-accent">
                  <Lock className="h-2.5 w-2.5" />
                  {lockedItems.length} locked · never changed
                </div>
              </div>
            )}

            {delta.replacements.length === 0 && delta.additions.length === 0 && delta.removals.length === 0 ? (
              <p className="font-body text-[11px] text-muted-foreground italic">Nothing to re-align.</p>
            ) : (
              <ul className="space-y-1.5">
                {delta.replacements.map((r) => {
                  const from = previewById.get(r.old_pick_id);
                  const to = newPreviewById.get(r.new_pick_id);
                  const state = replDecisions[r.old_pick_id] || "pending";
                  return (
                    <li key={`repl-${r.old_pick_id}`}
                      className={cn(
                        "rounded-md border px-2 py-1.5 bg-background transition-colors",
                        state === "accepted" ? "border-sky-500/50 bg-sky-500/[0.05]" : state === "rejected" ? "border-border opacity-50" : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-sky-700 dark:text-sky-300 mb-1">
                        <ArrowRight className="h-2.5 w-2.5" /> Replace
                      </div>
                      <button
                        type="button"
                        onClick={() => from && onFocusRow(from.id)}
                        className="w-full text-left font-body text-[11px] text-foreground truncate hover:underline"
                      >
                        {from?.title || r.old_pick_id}
                      </button>
                      <div className="font-body text-[11px] text-foreground truncate mt-0.5">
                        → {to?.title || r.new_pick_id}{to?.designer_name && <span className="text-muted-foreground"> · {to.designer_name}</span>}
                      </div>
                      <p className="font-body text-[10.5px] text-muted-foreground italic leading-snug mt-1">{r.reason}</p>
                      <DecisionButtons
                        state={state}
                        onAccept={() => setReplDecisions((prev) => ({ ...prev, [r.old_pick_id]: "accepted" }))}
                        onReject={() => setReplDecisions((prev) => ({ ...prev, [r.old_pick_id]: "rejected" }))}
                      />
                    </li>
                  );
                })}
                {delta.additions.map((a) => {
                  const to = newPreviewById.get(a.new_pick_id);
                  const state = addDecisions[a.new_pick_id] || "pending";
                  return (
                    <li key={`add-${a.new_pick_id}`}
                      className={cn(
                        "rounded-md border px-2 py-1.5 bg-background transition-colors",
                        state === "accepted" ? "border-sky-500/50 bg-sky-500/[0.05]" : state === "rejected" ? "border-border opacity-50" : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-sky-700 dark:text-sky-300 mb-1">
                        <Plus className="h-2.5 w-2.5" /> Add
                      </div>
                      <div className="font-body text-[11px] text-foreground truncate">
                        {to?.title || a.new_pick_id}{to?.designer_name && <span className="text-muted-foreground"> · {to.designer_name}</span>}
                      </div>
                      <p className="font-body text-[10.5px] text-muted-foreground italic leading-snug mt-1">{a.reason}</p>
                      <DecisionButtons
                        state={state}
                        onAccept={() => setAddDecisions((prev) => ({ ...prev, [a.new_pick_id]: "accepted" }))}
                        onReject={() => setAddDecisions((prev) => ({ ...prev, [a.new_pick_id]: "rejected" }))}
                      />
                    </li>
                  );
                })}
                {delta.removals.map((r) => {
                  const from = previewById.get(r.pick_id) || keptById.get(r.pick_id);
                  const state = remDecisions[r.pick_id] || "pending";
                  return (
                    <li key={`rem-${r.pick_id}`}
                      className={cn(
                        "rounded-md border px-2 py-1.5 bg-background transition-colors",
                        state === "accepted" ? "border-sky-500/50 bg-sky-500/[0.05]" : state === "rejected" ? "border-border opacity-50" : "border-border",
                      )}
                    >
                      <div className="flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-sky-700 dark:text-sky-300 mb-1">
                        <Trash2 className="h-2.5 w-2.5" /> Remove
                      </div>
                      <button
                        type="button"
                        onClick={() => from && onFocusRow(from.id)}
                        className="w-full text-left font-body text-[11px] text-foreground truncate hover:underline"
                      >
                        {from?.title || r.pick_id}
                      </button>
                      <p className="font-body text-[10.5px] text-muted-foreground italic leading-snug mt-1">{r.reason}</p>
                      <DecisionButtons
                        state={state}
                        onAccept={() => setRemDecisions((prev) => ({ ...prev, [r.pick_id]: "accepted" }))}
                        onReject={() => setRemDecisions((prev) => ({ ...prev, [r.pick_id]: "rejected" }))}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* Footer — apply controls only when a delta exists */}
      {delta && !deltaLoading && (delta.replacements.length + delta.additions.length + delta.removals.length) > 0 && (
        <footer className="border-t border-border/60 px-3 py-2 flex items-center justify-between gap-2 bg-muted/30">
          <button
            type="button"
            onClick={acceptAll}
            className="font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition"
          >
            Accept all
          </button>
          <button
            type="button"
            onClick={applyAll}
            disabled={acceptedCount === 0}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-body text-[10px] uppercase tracking-widest transition-colors",
              acceptedCount === 0
                ? "border border-border text-muted-foreground cursor-not-allowed"
                : "bg-foreground text-background hover:bg-foreground/90",
            )}
          >
            <Check className="h-2.5 w-2.5" />
            Apply {acceptedCount > 0 ? `(${acceptedCount})` : ""}
          </button>
        </footer>
      )}
    </aside>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

function DecisionButtons({
  state, onAccept, onReject,
}: {
  state: "pending" | "accepted" | "rejected";
  onAccept: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex items-center gap-1 mt-1.5">
      <button
        type="button"
        onClick={onAccept}
        className={cn(
          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-body text-[9px] uppercase tracking-wider transition-colors",
          state === "accepted"
            ? "border-sky-500/60 bg-sky-500/15 text-sky-800 dark:text-sky-200"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        <Check className="h-2.5 w-2.5" /> Accept
      </button>
      <button
        type="button"
        onClick={onReject}
        className={cn(
          "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-body text-[9px] uppercase tracking-wider transition-colors",
          state === "rejected"
            ? "border-border bg-muted text-muted-foreground"
            : "border-border text-muted-foreground hover:text-foreground",
        )}
      >
        <X className="h-2.5 w-2.5" /> Reject
      </button>
    </div>
  );
}
