// Cascading re-alignment diff UI.
//
// Split view:
//   LEFT  — "Your Edits" (locked anchors + kept unlocked pieces)
//   RIGHT — "AI Suggested Re-alignments" (replacements/additions/removals)
//
// Per-line Accept/Reject plus an Accept All shortcut. When accepted, the
// panel calls `onApply({ toAdd, toRemove, replaceMap })` and the parent card
// mutates its local excluded/preview state accordingly. Locked rows never
// appear as targets in the delta (guaranteed server-side).

import { useState } from "react";
import { Check, X, ArrowRight, Plus, Trash2, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RealignmentDelta, RealignPreview } from "@/lib/tearsheetSyncClient";
import type { PickPreview } from "@/lib/tradeConciergeStream";

export type AppliedRealignment = {
  toAdd: RealignPreview[];               // new picks to append
  toRemove: string[];                    // pick_ids to exclude
  replaceMap: Map<string, RealignPreview>; // old_id -> new preview (swap in-place)
};

interface Props {
  delta: RealignmentDelta;
  lockedItems: PickPreview[];
  keptUnlockedItems: PickPreview[];
  onApply: (applied: AppliedRealignment) => void;
  onDismiss: () => void;
}

type Decision = "pending" | "accepted" | "rejected";

export function RealignmentDiffPanel({
  delta, lockedItems, keptUnlockedItems, onApply, onDismiss,
}: Props) {
  const [replDecisions, setReplDecisions] = useState<Record<string, Decision>>(
    Object.fromEntries(delta.replacements.map((r) => [r.old_pick_id, "pending"])),
  );
  const [addDecisions, setAddDecisions] = useState<Record<string, Decision>>(
    Object.fromEntries(delta.additions.map((a) => [a.new_pick_id, "pending"])),
  );
  const [remDecisions, setRemDecisions] = useState<Record<string, Decision>>(
    Object.fromEntries(delta.removals.map((r) => [r.pick_id, "pending"])),
  );

  const totalDeltas = delta.replacements.length + delta.additions.length + delta.removals.length;
  const previewById = new Map(delta.new_previews.map((p) => [p.id, p]));
  const keptById = new Map(keptUnlockedItems.map((k) => [k.id, k]));

  const acceptAll = () => {
    setReplDecisions(Object.fromEntries(delta.replacements.map((r) => [r.old_pick_id, "accepted"])));
    setAddDecisions(Object.fromEntries(delta.additions.map((a) => [a.new_pick_id, "accepted"])));
    setRemDecisions(Object.fromEntries(delta.removals.map((r) => [r.pick_id, "accepted"])));
  };

  const applyAll = () => {
    const toAdd: RealignPreview[] = [];
    const toRemove: string[] = [];
    const replaceMap = new Map<string, RealignPreview>();

    for (const r of delta.replacements) {
      if (replDecisions[r.old_pick_id] === "accepted") {
        const p = previewById.get(r.new_pick_id);
        if (p) replaceMap.set(r.old_pick_id, p);
      }
    }
    for (const a of delta.additions) {
      if (addDecisions[a.new_pick_id] === "accepted") {
        const p = previewById.get(a.new_pick_id);
        if (p) toAdd.push(p);
      }
    }
    for (const r of delta.removals) {
      if (remDecisions[r.pick_id] === "accepted") toRemove.push(r.pick_id);
    }

    onApply({ toAdd, toRemove, replaceMap });
  };

  const acceptedCount =
    Object.values(replDecisions).filter((d) => d === "accepted").length +
    Object.values(addDecisions).filter((d) => d === "accepted").length +
    Object.values(remDecisions).filter((d) => d === "accepted").length;

  if (totalDeltas === 0) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-3 my-2.5 animate-fade-in">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            <Sparkles className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              {delta.summary || "No changes proposed — the current set already holds together."}
            </p>
          </div>
          <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/[0.03] p-3 my-2.5 animate-fade-in">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-display text-[10px] uppercase tracking-widest text-accent">
            Re-alignment · {totalDeltas} suggestion{totalDeltas === 1 ? "" : "s"}
          </span>
        </div>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {delta.summary && (
        <p className="font-body text-xs italic text-muted-foreground mb-2.5">"{delta.summary}"</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* LEFT — Your Edits */}
        <div>
          <div className="font-display text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
            Your Edits
          </div>
          <ul className="space-y-1.5">
            {lockedItems.map((p) => (
              <li key={`lock-${p.id}`} className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1.5">
                <Lock className="h-3 w-3 text-amber-600 shrink-0" />
                <span className="flex-1 min-w-0 font-body text-[11px] truncate">{p.title}</span>
                <span className="font-body text-[9px] uppercase tracking-wider text-muted-foreground">Locked</span>
              </li>
            ))}
            {keptUnlockedItems.map((p) => (
              <li key={`keep-${p.id}`} className="flex items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 shrink-0" />
                <span className="flex-1 min-w-0 font-body text-[11px] truncate text-muted-foreground">{p.title}</span>
              </li>
            ))}
            {lockedItems.length === 0 && keptUnlockedItems.length === 0 && (
              <li className="font-body text-[11px] text-muted-foreground italic">(nothing kept)</li>
            )}
          </ul>
        </div>

        {/* RIGHT — AI Suggested */}
        <div>
          <div className="font-display text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
            AI Suggested Re-alignments
          </div>
          <ul className="space-y-1.5">
            {delta.replacements.map((r) => {
              const oldItem = keptById.get(r.old_pick_id);
              const newPreview = previewById.get(r.new_pick_id);
              const decision = replDecisions[r.old_pick_id];
              return (
                <DeltaRow
                  key={`repl-${r.old_pick_id}`}
                  decision={decision}
                  onAccept={() => setReplDecisions((d) => ({ ...d, [r.old_pick_id]: "accepted" }))}
                  onReject={() => setReplDecisions((d) => ({ ...d, [r.old_pick_id]: "rejected" }))}
                  icon={<ArrowRight className="h-3 w-3 text-blue-600" />}
                  headline={
                    <span className="truncate">
                      <span className="line-through opacity-60">{oldItem?.title || r.old_pick_id.slice(0, 8)}</span>
                      {" → "}
                      <span className="font-medium">{newPreview?.title || r.new_pick_id.slice(0, 8)}</span>
                    </span>
                  }
                  reason={r.reason}
                />
              );
            })}
            {delta.additions.map((a) => {
              const p = previewById.get(a.new_pick_id);
              return (
                <DeltaRow
                  key={`add-${a.new_pick_id}`}
                  decision={addDecisions[a.new_pick_id]}
                  onAccept={() => setAddDecisions((d) => ({ ...d, [a.new_pick_id]: "accepted" }))}
                  onReject={() => setAddDecisions((d) => ({ ...d, [a.new_pick_id]: "rejected" }))}
                  icon={<Plus className="h-3 w-3 text-emerald-600" />}
                  headline={<span className="truncate font-medium">Add: {p?.title || a.new_pick_id.slice(0, 8)}</span>}
                  reason={a.reason}
                />
              );
            })}
            {delta.removals.map((r) => {
              const oldItem = keptById.get(r.pick_id);
              return (
                <DeltaRow
                  key={`rem-${r.pick_id}`}
                  decision={remDecisions[r.pick_id]}
                  onAccept={() => setRemDecisions((d) => ({ ...d, [r.pick_id]: "accepted" }))}
                  onReject={() => setRemDecisions((d) => ({ ...d, [r.pick_id]: "rejected" }))}
                  icon={<Trash2 className="h-3 w-3 text-red-600" />}
                  headline={<span className="truncate">Remove: <span className="line-through opacity-70">{oldItem?.title || r.pick_id.slice(0, 8)}</span></span>}
                  reason={r.reason}
                />
              );
            })}
          </ul>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2.5">
        <span className="font-body text-[10px] uppercase tracking-wider text-muted-foreground">
          {acceptedCount} of {totalDeltas} accepted
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={acceptAll}
            className="rounded-md border border-border px-2.5 py-1 font-body text-[10px] uppercase tracking-wider text-foreground hover:bg-muted transition"
          >
            Accept all
          </button>
          <button
            onClick={applyAll}
            disabled={acceptedCount === 0}
            className={cn(
              "rounded-md px-3 py-1 font-body text-[10px] uppercase tracking-wider transition",
              acceptedCount === 0
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-foreground text-background hover:opacity-90",
            )}
          >
            Apply {acceptedCount || ""}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeltaRow({
  decision, onAccept, onReject, icon, headline, reason,
}: {
  decision: Decision;
  onAccept: () => void;
  onReject: () => void;
  icon: React.ReactNode;
  headline: React.ReactNode;
  reason: string;
}) {
  return (
    <li
      className={cn(
        "rounded-md border px-2 py-1.5 transition",
        decision === "accepted" && "border-emerald-500/50 bg-emerald-500/[0.06]",
        decision === "rejected" && "border-border/30 bg-muted/10 opacity-50",
        decision === "pending" && "border-border/60 bg-background",
      )}
    >
      <div className="flex items-start gap-1.5">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="font-body text-[11px] leading-tight">{headline}</div>
          {reason && (
            <p className="mt-0.5 font-body text-[10px] text-muted-foreground leading-snug">{reason}</p>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onAccept}
            className={cn(
              "rounded-full p-1 transition",
              decision === "accepted"
                ? "bg-emerald-500/20 text-emerald-700"
                : "text-muted-foreground hover:bg-emerald-500/10 hover:text-emerald-700",
            )}
            aria-label="Accept"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={onReject}
            className={cn(
              "rounded-full p-1 transition",
              decision === "rejected"
                ? "bg-red-500/20 text-red-700"
                : "text-muted-foreground hover:bg-red-500/10 hover:text-red-700",
            )}
            aria-label="Reject"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    </li>
  );
}
