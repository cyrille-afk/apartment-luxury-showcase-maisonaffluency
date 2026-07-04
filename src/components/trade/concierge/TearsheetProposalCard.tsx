import { useEffect, useMemo, useRef, useState } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { Loader2, Check, X, Pencil, ExternalLink, Plus, ChevronDown, Copy, Repeat, Lock, Unlock, RefreshCw, PlusCircle, MessageSquare, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { commitProposal, type TearsheetProposal, type PickPreview } from "@/lib/tradeConciergeStream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BoardPicker } from "@/components/trade/concierge/BoardPicker";
import { ProjectAssignInline } from "@/components/trade/concierge/ProjectAssignInline";
import { HotspotImageBadge } from "@/components/trade/HotspotImageBadge";
import { buildSwapPrompt, buildSuggestOneMorePrompt, buildCritiqueEditsPrompt, sendConciergePrefill, type SwapPromptItem } from "@/lib/conciergePrefill";
import { RequirementsBadge } from "@/components/trade/concierge/RequirementsBadge";
import { validateTearsheetEdits, realignUnlocked, type ValidationVerdict, type RealignmentDelta } from "@/lib/tearsheetSyncClient";
import { ValidationBanner, RowVerdictPill } from "@/components/trade/concierge/ValidationSummary";
import { RealignmentDiffPanel, type AppliedRealignment } from "@/components/trade/concierge/RealignmentDiffPanel";
import { TearsheetInsightsSidebar } from "@/components/trade/concierge/TearsheetInsightsSidebar";


type Status = "pending" | "committing" | "approved" | "discarded";
type Mode = "create" | "append";

interface Props {
  proposal: TearsheetProposal;
  onResolved?: (outcome: "approved" | "discarded", info?: { boardId: string; url: string; added: number; duplicates: number; mode: Mode; deferNavigation?: boolean }) => void;
  /** Lifted exclusion state so the parent can inject "kept vs removed" into the next chat turn. */
  excluded?: Set<string>;
  onExcludedChange?: (excluded: Set<string>) => void;
  /** Lifted locked state — items the architect has frozen so re-generation preserves them verbatim. */
  locked?: Set<string>;
  onLockedChange?: (locked: Set<string>) => void;
  /** IDs that are NEW vs the previous proposal — rationale will be shown for these. */
  newPickIds?: string[];
}

export function TearsheetProposalCard({ proposal, onResolved, excluded: excludedProp, onExcludedChange, locked: lockedProp, onLockedChange, newPickIds }: Props) {
  const initialMode: Mode = proposal.tool === "add_to_tearsheet" ? "append" : "create";
  const [mode, setMode] = useState<Mode>(initialMode);

  // Title is only used in create mode. Default to AI's title (or a derived fallback for append→create switch).
  const initialTitle =
    proposal.tool === "propose_tearsheet"
      ? proposal.args.title
      : proposal.args.board_title || "New tearsheet";
  const [title, setTitle] = useState(initialTitle);
  const [editingTitle, setEditingTitle] = useState(false);

  // Selected board for append mode (controlled — user can override the AI's pick).
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(
    proposal.tool === "add_to_tearsheet" ? proposal.args.board_id : null,
  );

  const [excludedLocal, setExcludedLocal] = useState<Set<string>>(excludedProp ?? new Set());
  const excluded = excludedProp ?? excludedLocal;
  const [lockedLocal, setLockedLocal] = useState<Set<string>>(lockedProp ?? new Set());
  const locked = lockedProp ?? lockedLocal;

  // Cascading re-alignment state — locally-applied swaps and additions.
  // `swaps` maps old_pick_id → replacement preview (renders in-place, keeps order).
  // `extraPicks` are new items appended after the original preview list.
  const [swaps, setSwaps] = useState<Map<string, PickPreview>>(new Map());
  const [extraPicks, setExtraPicks] = useState<PickPreview[]>([]);

  // Structured Validate/Sync verdict — set by handleValidate, cleared by dismiss.
  const [verdict, setVerdict] = useState<ValidationVerdict | null>(null);
  const [verdictLoading, setVerdictLoading] = useState(false);
  // Cascading re-alignment delta from realignUnlocked. Rendered as a diff panel.
  const [delta, setDelta] = useState<RealignmentDelta | null>(null);
  const [deltaLoading, setDeltaLoading] = useState(false);

  // Persist "Why this pick" expanded state per proposal in sessionStorage so
  // that switching views (panel collapse, route change, page refresh within
  // the same tab) preserves the reading context the user was building.
  const expandedStorageKey = `concierge:expanded:${proposal.tool_call_id}`;
  const [expandedDetail, setExpandedDetail] = useState<Set<string>>(() => {
    try {
      const raw = sessionStorage.getItem(expandedStorageKey);
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? new Set(arr.filter((x) => typeof x === "string")) : new Set();
    } catch {
      return new Set();
    }
  });
  // Mirror to sessionStorage on every change.
  const persistExpanded = (next: Set<string>) => {
    try {
      if (next.size === 0) sessionStorage.removeItem(expandedStorageKey);
      else sessionStorage.setItem(expandedStorageKey, JSON.stringify(Array.from(next)));
    } catch {
      /* quota or disabled — ignore */
    }
  };
  const [status, setStatus] = useState<Status>("pending");
  const [result, setResult] = useState<{ boardId: string; url: string; added: number; duplicates: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // After commit, holds the board's existing project_id (null = no project assigned yet).
  const [existingProjectId, setExistingProjectId] = useState<string | null>(null);
  const [projectStepDone, setProjectStepDone] = useState(false);
  const navigate = useNavigate();

  const isAppend = mode === "append";
  // Dedupe by id (the AI occasionally repeats an id) to avoid duplicate React keys.
  // Then apply local swaps (in-place replacement) and append extraPicks
  // from any accepted cascading re-alignment.
  const uniquePreview = useMemo(() => {
    const seen = new Set<string>();
    const base = proposal.preview.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
    const swapped = base.map((p) => swaps.get(p.id) ?? p);
    const swappedIds = new Set(swapped.map((p) => p.id));
    const extras = extraPicks.filter((p) => !swappedIds.has(p.id));
    return [...swapped, ...extras];
  }, [proposal.preview, swaps, extraPicks]);

  const visiblePicks = uniquePreview.filter((p) => !excluded.has(p.id));

  // Lookup for the insights sidebar so it can render a pick's title/designer
  // next to each validation row and delta entry.
  const previewById = useMemo(() => new Map(uniquePreview.map((p) => [p.id, p])), [uniquePreview]);

  // ── Insights sidebar coordination ──────────────────────────────────────
  // Row refs for card→row scroll+flash triggered from the sidebar. Scroll
  // uses `scrollIntoView({ block: "nearest" })` inside the card's own
  // scroll container so the concierge chat viewport is not moved.
  const rowRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  const focusRow = (pickId: string) => {
    const node = rowRefs.current.get(pickId);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
    setHighlightedRowId(pickId);
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = window.setTimeout(() => setHighlightedRowId(null), 1600);
  };

  useEffect(() => () => {
    if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
  }, []);

  // Ask AIConcierge to widen its panel while insights are showing (so the
  // sidebar and the pick list are visible together on desktop). Fires an
  // idempotent open/close event; AIConcierge listens and toggles `expanded`.
  const insightsOpen = verdictLoading || !!verdict || deltaLoading || !!delta;
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("maf:concierge:insights", { detail: { open: insightsOpen } }));
    // On unmount, always signal closed so a stale value never lingers.
    return () => {
      window.dispatchEvent(new CustomEvent("maf:concierge:insights", { detail: { open: false } }));
    };
  }, [insightsOpen]);


  const togglePick = (id: string) => {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExcludedLocal(next);
    onExcludedChange?.(next);
    // Skipping a locked item makes no sense — auto-unlock it.
    if (locked.has(id)) {
      const nextLocked = new Set(locked);
      nextLocked.delete(id);
      setLockedLocal(nextLocked);
      onLockedChange?.(nextLocked);
    }
  };

  const toggleLock = (id: string) => {
    const next = new Set(locked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setLockedLocal(next);
    onLockedChange?.(next);
  };

  const lockedVisible = visiblePicks.filter((p) => locked.has(p.id));
  const unlockedVisibleCount = visiblePicks.length - lockedVisible.length;

  // Cascading re-align (#1 — server-backed). Fetches a structured DELTA and
  // renders a diff panel; user accepts per-line. Locked/excluded ids are
  // guaranteed untouched (enforced server-side + verified client-side).
  const handleRegenerateUnlocked = async () => {
    if (lockedVisible.length === 0) {
      toast.error("Lock at least one piece before re-aligning the rest.");
      return;
    }
    if (unlockedVisibleCount === 0) {
      toast.error("Every included piece is locked — unlock at least one to re-align.");
      return;
    }
    setDeltaLoading(true);
    setDelta(null);
    try {
      const skippedItems = uniquePreview.filter((p) => excluded.has(p.id));
      const lockedItems = uniquePreview.filter((p) => locked.has(p.id) && !excluded.has(p.id));
      const unlockedKept = uniquePreview.filter((p) => !excluded.has(p.id) && !locked.has(p.id));
      const d = await realignUnlocked({
        title: title.trim() || initialTitle,
        locked: lockedItems.map(asItem),
        excluded: skippedItems.map(asItem),
        unlocked: unlockedKept.map(asItem),
      });
      setDelta(d);
      if (
        d.replacements.length === 0 &&
        d.additions.length === 0 &&
        d.removals.length === 0
      ) {
        toast(d.summary || "No changes proposed.");
      }
    } catch (e) {
      toast.error(`Re-align failed: ${(e as Error)?.message || "unknown"}`);
    } finally {
      setDeltaLoading(false);
    }
  };

  const asItem = (p: (typeof visiblePicks)[number]): SwapPromptItem => ({
    pick_id: p.id,
    title: p.title,
    designer_name: p.designer_name,
    materials: p.materials,
    category: (p as any).category ?? null,
  });

  // Apply an accepted re-alignment to the local card state.
  // Locked ids are never touched (server drops them + we assert here again).
  const handleApplyRealignment = (applied: AppliedRealignment) => {
    // Belt-and-braces: strip any accidental locked-id targets before mutating.
    const nextSwaps = new Map(swaps);
    for (const [oldId, newP] of applied.replaceMap) {
      if (locked.has(oldId)) continue; // never overwrite a locked anchor
      nextSwaps.set(oldId, newP);
    }
    setSwaps(nextSwaps);

    if (applied.toAdd.length > 0) {
      const existingIds = new Set([
        ...uniquePreview.map((p) => p.id),
        ...extraPicks.map((p) => p.id),
      ]);
      const fresh = applied.toAdd.filter((p) => !existingIds.has(p.id));
      if (fresh.length) setExtraPicks((prev) => [...prev, ...fresh]);
    }

    if (applied.toRemove.length > 0) {
      const nextExcluded = new Set(excluded);
      for (const id of applied.toRemove) {
        if (!locked.has(id)) nextExcluded.add(id); // locked stays untouched
      }
      setExcludedLocal(nextExcluded);
      onExcludedChange?.(nextExcluded);
    }

    const total =
      applied.replaceMap.size + applied.toAdd.length + applied.toRemove.length;
    toast.success(`Applied ${total} re-alignment${total === 1 ? "" : "s"}`);
    setDelta(null);
    setVerdict(null); // stale — recompute on next Validate click
  };

  // #2 — Live suggestion: ask the AI for ONE more piece that fills a gap in
  // the current selection. Prefills the composer; the user confirms.
  const handleSuggestOneMore = () => {
    if (visiblePicks.length === 0) {
      toast.error("Keep at least one piece so the AI knows what to harmonise with.");
      return;
    }
    const prompt = buildSuggestOneMorePrompt(visiblePicks.map(asItem));
    sendConciergePrefill(prompt);
  };

  // #3 — Critique & Explain: prose-only breakdown of how the architect's
  // manual edits (skips, locks) shift the design vs the original proposal.
  const handleCritiqueEdits = () => {
    const skipped = uniquePreview.filter((p) => excluded.has(p.id));
    const lockedItems = uniquePreview.filter((p) => locked.has(p.id) && !excluded.has(p.id));
    const keptItems = uniquePreview.filter((p) => !excluded.has(p.id));
    if (skipped.length === 0 && lockedItems.length === 0) {
      toast.error("Skip or lock at least one piece so the critique has something to react to.");
      return;
    }
    const prompt = buildCritiqueEditsPrompt(
      uniquePreview.map(asItem),
      keptItems.map(asItem),
      skipped.map(asItem),
      lockedItems.map(asItem),
    );
    sendConciergePrefill(prompt);
  };

  // #5 — Validate / Sync: structured traffic-light verdict rendered in-card.
  // Only lit up while there are unverified changes (skip, lock, title rename).
  const titleChanged = !isAppend && title.trim() !== initialTitle.trim();
  const pendingChangesCount = excluded.size + locked.size + (titleChanged ? 1 : 0);
  const handleValidate = async () => {
    if (pendingChangesCount === 0) {
      toast.error("Make an edit first (skip, lock, or rename) and I'll run a validation pass.");
      return;
    }
    setVerdictLoading(true);
    setVerdict(null);
    try {
      const skipped = uniquePreview.filter((p) => excluded.has(p.id));
      const lockedItems = uniquePreview.filter((p) => locked.has(p.id) && !excluded.has(p.id));
      const kept = uniquePreview.filter((p) => !excluded.has(p.id));
      const v = await validateTearsheetEdits({
        title: title.trim() || initialTitle,
        original_note: proposal.args.note,
        kept: kept.map(asItem),
        skipped: skipped.map(asItem),
        locked: lockedItems.map(asItem),
        title_change: titleChanged ? { from: initialTitle, to: title.trim() } : null,
      });
      setVerdict(v);
    } catch (e) {
      toast.error(`Validation failed: ${(e as Error)?.message || "unknown"}`);
    } finally {
      setVerdictLoading(false);
    }
  };





  const handleApprove = async () => {
    if (visiblePicks.length === 0) {
      toast.error("Select at least one piece to include.");
      return;
    }
    if (isAppend && !selectedBoardId) {
      toast.error("Choose a tearsheet to add these pieces to.");
      return;
    }

    setStatus("committing");
    setError(null);

    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (!token) {
      setStatus("pending");
      setError("You need to be signed in to approve this draft.");
      return;
    }

    const pickIds = visiblePicks.map((p) => p.id);

    const requestBody = isAppend
      ? {
          tool: "add_to_tearsheet" as const,
          args: {
            board_id: selectedBoardId,
            note: proposal.args.note,
            pick_ids: pickIds,
          },
        }
      : {
          tool: "propose_tearsheet" as const,
          args: {
            title: title.trim() || "Untitled tearsheet",
            note: proposal.args.note,
            pick_ids: pickIds,
          },
        };

    const res = await commitProposal(requestBody, token);

    if (res.ok === false) {
      setStatus("pending");
      setError(res.error);
      toast.error(res.error);
      return;
    }
    setStatus("approved");
    const duplicates = res.duplicates || 0;
    setResult({ boardId: res.board_id, url: res.url, added: res.added, duplicates });

    // Look up the board's existing project_id so we know whether to prompt.
    const { data: boardRow } = await supabase
      .from("client_boards")
      .select("project_id")
      .eq("id", res.board_id)
      .maybeSingle();
    const currentProjectId = (boardRow?.project_id as string | null) ?? null;
    setExistingProjectId(currentProjectId);

    // Defer parent's auto-navigation when we'll show the project picker.
    const willPromptForProject = !currentProjectId;

    onResolved?.("approved", {
      boardId: res.board_id,
      url: res.url,
      added: res.added,
      duplicates,
      mode,
      deferNavigation: willPromptForProject,
    });
  };

  const handleProjectStepResolved = (_projectId: string | null) => {
    setProjectStepDone(true);
    if (result?.url) {
      // Give the user a beat to see the confirmation before navigating.
      setTimeout(() => navigate(result.url), 700);
    }
  };

  const handleDiscard = () => {
    setStatus("discarded");
    onResolved?.("discarded");
  };

  const headerLabel = isAppend
    ? "✦ Concierge proposes adding to your tearsheet"
    : "✦ Concierge proposes a new tearsheet";

  const approveLabel = isAppend ? "Approve & add" : "Approve & create";
  const ApproveIcon = isAppend ? Plus : Check;

  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/[0.04] p-3.5 my-2 animate-fade-in">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-[10px] uppercase tracking-widest text-accent">
          {headerLabel}
        </span>
        <RequirementsBadge validation={proposal.requirements_validation} />
      </div>

      {/* Segmented control — always visible while pending so the user can redirect either way */}
      {status === "pending" && (
        <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-muted/60 mb-2.5">
          <button
            type="button"
            onClick={() => setMode("append")}
            className={cn(
              "rounded-md px-2 py-1.5 font-body text-[10px] uppercase tracking-wider transition-colors",
              isAppend
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Add to existing
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={cn(
              "rounded-md px-2 py-1.5 font-body text-[10px] uppercase tracking-wider transition-colors",
              !isAppend
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Create new
          </button>
        </div>
      )}

      {/* Target — picker in append mode, editable title in create mode */}
      <div className="mb-2.5">
        {isAppend ? (
          <BoardPicker
            value={selectedBoardId}
            onChange={setSelectedBoardId}
            onCreateNew={() => setMode("create")}
            disabled={status !== "pending"}
          />
        ) : (
          <div className="flex items-center gap-2">
            {editingTitle && status === "pending" ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                autoFocus
                maxLength={120}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-display text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              />
            ) : (
              <h4 className="flex-1 font-display text-sm text-foreground">{title || "Untitled tearsheet"}</h4>
            )}
            {status === "pending" && (
              <button
                onClick={() => setEditingTitle((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Rename"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {proposal.args.note && (
        <p className="font-body text-xs text-muted-foreground italic mb-2.5">"{proposal.args.note}"</p>
      )}

      {/*
        Validate/Sync + cascading re-alignment.
        Desktop (≥lg): rendered in the docked <TearsheetInsightsSidebar>
        via portal (see end of component). Below lg the sidebar can't fit,
        so we keep the inline banner + diff panel as a fallback.
      */}
      <div className="lg:hidden">
        {verdictLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-2 mb-2.5">
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            <span className="font-body text-[11px] text-muted-foreground">Validator reviewing your edits…</span>
          </div>
        )}
        {verdict && !verdictLoading && (
          <ValidationBanner verdict={verdict} onDismiss={() => setVerdict(null)} />
        )}
        {deltaLoading && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/[0.04] px-2.5 py-2 mb-2.5">
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
            <span className="font-body text-[11px] text-accent">Re-aligner considering alternatives…</span>
          </div>
        )}
        {delta && !deltaLoading && (
          <RealignmentDiffPanel
            delta={delta}
            lockedItems={uniquePreview.filter((p) => locked.has(p.id) && !excluded.has(p.id))}
            keptUnlockedItems={uniquePreview.filter((p) => !locked.has(p.id) && !excluded.has(p.id))}
            onApply={handleApplyRealignment}
            onDismiss={() => setDelta(null)}
          />
        )}
      </div>



      {/* Collapse all reasoning panels — only when something is currently expanded */}
      {expandedDetail.size > 0 && (
        <div className="flex justify-end mb-1.5">
          <button
            type="button"
            onClick={() => {
              setExpandedDetail(new Set());
              persistExpanded(new Set());
            }}
            className="inline-flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Collapse all reasoning panels"
          >
            <ChevronDown className="h-2.5 w-2.5 rotate-180" />
            Collapse all ({expandedDetail.size})
          </button>
        </div>
      )}

      {/* Picks — grouped by designer so each section has its own collapse-all */}
      {(() => {
        // Stable groups in first-appearance order. Use "—" as the sectionless bucket.
        const groupOrder: string[] = [];
        const groups = new Map<string, typeof uniquePreview>();
        for (const p of uniquePreview) {
          const key = p.designer_name || "—";
          if (!groups.has(key)) {
            groups.set(key, []);
            groupOrder.push(key);
          }
          groups.get(key)!.push(p);
        }

        return groupOrder.map((groupName) => {
          const items = groups.get(groupName)!;
          const groupIds = items.map((p) => p.id);
          const expandedInGroup = groupIds.filter((id) => expandedDetail.has(id));
          const collapseGroup = () => {
            setExpandedDetail((prev) => {
              const next = new Set(prev);
              for (const id of groupIds) next.delete(id);
              persistExpanded(next);
              return next;
            });
          };

          return (
            <div key={groupName} className="mb-2.5 last:mb-3">
              <div className="flex items-center justify-between gap-2 px-1.5 mb-1">
                <span className="font-display text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                  {groupName}
                </span>
                {expandedInGroup.length > 0 && (
                  <button
                    type="button"
                    onClick={collapseGroup}
                    className="shrink-0 inline-flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={`Collapse all reasoning in ${groupName}`}
                  >
                    <ChevronDown className="h-2.5 w-2.5 rotate-180" />
                    Collapse ({expandedInGroup.length})
                  </button>
                )}
              </div>
              <ul className="space-y-1.5">
                {items.map((p) => {
                  const isExcluded = excluded.has(p.id);
                  const isLocked = locked.has(p.id) && !isExcluded;
                  const isNew = newPickIds ? newPickIds.includes(p.id) : false;
                  const fromArgs = proposal.args.pick_rationales?.[p.id];
                  const rationale = (p as any).rationale || fromArgs?.reason || null;
                  const rationaleDetail =
                    (p as any).rationale_detail || fromArgs?.detail || null;
                  const showRationale = isNew && !!rationale;
                  const isExpanded = expandedDetail.has(p.id);
                  const toggleDetail = () => {
                    setExpandedDetail((prev) => {
                      const next = new Set(prev);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      persistExpanded(next);
                      return next;
                    });
                  };
                  return (
                    <li
                      key={p.id}
                      data-pick-id={p.id}
                      ref={(el) => {
                        if (el) rowRefs.current.set(p.id, el);
                        else rowRefs.current.delete(p.id);
                      }}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg p-1.5 transition-all duration-300",
                        isExcluded && "opacity-40",
                        isLocked && "bg-muted/40 opacity-70 ring-1 ring-accent/20",
                        highlightedRowId === p.id && "ring-2 ring-accent bg-accent/[0.06]",
                      )}
                    >
                      <div className="relative h-10 w-10 shrink-0">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted" loading="lazy" />
                        ) : (
                          <div className="h-10 w-10 rounded bg-muted" />
                        )}
                        {p.image_from_hotspot && <HotspotImageBadge className="top-0 left-0 px-1 py-0 text-[8px]" />}
                        {isLocked && (
                          <div className="absolute -top-1 -right-1 rounded-full bg-accent text-accent-foreground p-0.5 shadow-sm" title="Locked — will not change on re-generate">
                            <Lock className="h-2.5 w-2.5" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="font-body text-xs text-foreground truncate">{p.title}</div>
                          {isNew && !isLocked && (
                            <span className="shrink-0 rounded-full bg-accent/15 text-accent font-body text-[8px] uppercase tracking-widest px-1.5 py-0.5">
                              New
                            </span>
                          )}
                          {isLocked && (
                            <span className="shrink-0 rounded-full bg-accent/20 text-accent font-body text-[8px] uppercase tracking-widest px-1.5 py-0.5">
                              Locked
                            </span>
                          )}
                        </div>
                        {verdict && (() => {
                          const row = verdict.per_row.find((r) => r.pick_id === p.id);
                          return row ? <div className="mt-1"><RowVerdictPill row={row} /></div> : null;
                        })()}

                        {p.materials && (
                          <div className="font-body text-[10px] text-muted-foreground truncate">
                            {p.materials}
                          </div>
                        )}
                        {showRationale && (
                          <>
                            <div className="font-body text-[10px] text-foreground/70 italic mt-0.5 leading-snug">
                              {rationale}
                            </div>
                            {(rationaleDetail || rationale) && (
                              <div className="mt-1 flex items-center gap-2">
                                {rationaleDetail && (
                                  <button
                                    type="button"
                                    onClick={toggleDetail}
                                    aria-expanded={isExpanded}
                                    className="inline-flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
                                  >
                                    <ChevronDown
                                      className={cn(
                                        "h-2.5 w-2.5 transition-transform",
                                        isExpanded && "rotate-180",
                                      )}
                                    />
                                    {isExpanded ? "Hide reasoning" : "Why this pick"}
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const parts = [
                                      `${p.title}${p.designer_name ? ` — ${p.designer_name}` : ""}`,
                                      rationale,
                                      rationaleDetail || undefined,
                                    ].filter(Boolean) as string[];
                                    const text = parts.join("\n\n");
                                    try {
                                      await navigator.clipboard.writeText(text);
                                      toast.success("Reasoning copied");
                                    } catch {
                                      toast.error("Could not copy to clipboard");
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
                                  aria-label="Copy reasoning for this pick"
                                  title="Copy reasoning"
                                >
                                  <Copy className="h-2.5 w-2.5" />
                                  Copy reasoning
                                </button>
                              </div>
                            )}
                            {rationaleDetail && isExpanded && (
                              <div className="mt-1 rounded-md border border-accent/30 bg-accent/[0.04] px-2 py-1.5 font-body text-[10.5px] text-foreground/80 leading-relaxed animate-fade-in">
                                {rationaleDetail}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {status === "pending" && (
                        <div className="flex items-center gap-1 self-center shrink-0">
                          <button
                            type="button"
                            onClick={() => toggleLock(p.id)}
                            disabled={isExcluded}
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors",
                              isLocked
                                ? "border-accent/50 bg-accent/15 text-accent hover:bg-accent/25"
                                : "border-border text-muted-foreground hover:text-foreground",
                              isExcluded && "opacity-40 cursor-not-allowed",
                            )}
                            aria-label={isLocked ? `Unlock ${p.title || "this pick"}` : `Lock ${p.title || "this pick"} so re-generation keeps it`}
                            aria-pressed={isLocked}
                            title={isLocked ? "Locked — re-generation will keep this piece" : "Lock this piece so re-generation keeps it"}
                          >
                            {isLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                            {isLocked ? "Locked" : "Lock"}
                          </button>
                          <button
                            type="button"
                            onClick={() => sendConciergePrefill(buildSwapPrompt({
                              pick_id: p.id,
                              title: p.title,
                              designer_name: p.designer_name,
                              materials: p.materials,
                              category: (p as any).category ?? null,
                            }))}
                            className="inline-flex items-center gap-1 text-muted-foreground hover:text-accent text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border transition-colors"
                            aria-label={`Swap ${p.title || "this pick"} for a similar piece`}
                            title="Swap for a similar piece (darker wood / warmer finish)"
                          >
                            <Repeat className="h-2.5 w-2.5" />
                            Swap
                          </button>
                          <button
                            onClick={() => togglePick(p.id)}
                            className="text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border"
                            aria-label={isExcluded ? "Include" : "Exclude"}
                          >
                            {isExcluded ? "Add" : "Skip"}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        });
      })()}
      {error && (
        <p className="font-body text-[11px] text-destructive mb-2">{error}</p>
      )}

      {/* Actions */}
      {status === "pending" && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-auto flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleRegenerateUnlocked}
              disabled={lockedVisible.length === 0 || unlockedVisibleCount === 0 || deltaLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/[0.06] text-accent font-body text-[11px] uppercase tracking-widest px-3 py-1.5 hover:bg-accent/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                lockedVisible.length === 0
                  ? "Lock at least one piece to re-align the rest"
                  : unlockedVisibleCount === 0
                  ? "Every included piece is locked"
                  : `Re-align ${unlockedVisibleCount} unlocked ${unlockedVisibleCount === 1 ? "piece" : "pieces"}; ${lockedVisible.length} locked stay untouched`
              }
              aria-label="Re-align unlocked pieces"
            >
              {deltaLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              Re-align unlocked{lockedVisible.length > 0 ? ` (${unlockedVisibleCount})` : ""}
            </button>

            <button
              type="button"
              onClick={handleSuggestOneMore}
              disabled={visiblePicks.length === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-border text-muted-foreground font-body text-[11px] uppercase tracking-widest px-3 py-1.5 hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Ask the concierge to add one more piece that harmonises with the current selection"
              aria-label="Suggest one more piece"
            >
              <PlusCircle className="h-3 w-3" />
              Suggest one more
            </button>
            <button
              type="button"
              onClick={handleCritiqueEdits}
              disabled={excluded.size === 0 && locked.size === 0}
              className="inline-flex items-center gap-1.5 rounded-full border border-border text-muted-foreground font-body text-[11px] uppercase tracking-widest px-3 py-1.5 hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                excluded.size === 0 && locked.size === 0
                  ? "Skip or lock a piece to give the critique something to react to"
                  : "Ask the concierge to critique how your edits shift the design"
              }
              aria-label="Critique my edits"
            >
              <MessageSquare className="h-3 w-3" />
              Critique my edits
            </button>
            <button
              type="button"
              onClick={handleValidate}
              disabled={pendingChangesCount === 0 || verdictLoading}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full font-body text-[11px] uppercase tracking-widest px-3 py-1.5 transition-colors",
                pendingChangesCount > 0
                  ? "bg-accent text-accent-foreground border border-accent hover:opacity-90"
                  : "border border-border text-muted-foreground/60 cursor-not-allowed",
              )}
              title={
                pendingChangesCount === 0
                  ? "No pending changes to validate — edit the draft first"
                  : `Batch-review your ${pendingChangesCount} pending manual ${pendingChangesCount === 1 ? "change" : "changes"} against the brief`
              }
              aria-label={`Validate ${pendingChangesCount} pending changes`}
            >
              {verdictLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
              Validate changes{pendingChangesCount > 0 ? ` (${pendingChangesCount})` : ""}
            </button>

          </div>
          <button
            onClick={handleDiscard}
            className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2.5 py-1.5 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleApprove}
            disabled={visiblePicks.length === 0 || (isAppend && !selectedBoardId)}
            className="flex items-center gap-1.5 rounded-full bg-foreground text-background font-body text-[11px] uppercase tracking-widest px-3.5 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <ApproveIcon className="h-3 w-3" />
            {approveLabel}
          </button>
        </div>
      )}

      {status === "committing" && (
        <div className="flex items-center justify-end gap-2 text-muted-foreground">
          <DotCircleLoader size="sm" className="h-3.5 w-3.5" />
          <span className="font-body text-[11px]">
            {isAppend ? "Adding to tearsheet…" : "Creating tearsheet…"}
          </span>
        </div>
      )}

      {status === "approved" && result && (
        <>
          <div className="flex items-center justify-between">
            <span className="font-body text-[11px] text-foreground/80">
              {isAppend ? (
                <>
                  ✓ Added {result.added} {result.added === 1 ? "piece" : "pieces"}
                  {result.duplicates > 0 && ` · ${result.duplicates} already on board`}
                </>
              ) : (
                <>✓ Created with {result.added} {result.added === 1 ? "piece" : "pieces"}</>
              )}
            </span>
            <Link
              to={result.url}
              onClick={() => {
                try { window.dispatchEvent(new Event("concierge:close")); } catch {}
              }}
              className="flex items-center gap-1 font-body text-[11px] uppercase tracking-widest text-accent hover:underline"
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          {/* Assign to project — only when the board has no project yet */}
          {!existingProjectId && !projectStepDone && (
            <ProjectAssignInline
              boardId={result.boardId}
              onResolved={handleProjectStepResolved}
            />
          )}
        </>
      )}

      {status === "discarded" && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <X className="h-3.5 w-3.5" />
          <span className="font-body text-[11px]">Discarded</span>
        </div>
      )}
    </div>
  );
}
