import { useState } from "react";
import { Loader2, Check, X, Pencil, ExternalLink, Plus, ChevronDown } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { commitProposal, type TearsheetProposal } from "@/lib/tradeConciergeStream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BoardPicker } from "@/components/trade/concierge/BoardPicker";
import { ProjectAssignInline } from "@/components/trade/concierge/ProjectAssignInline";
import { HotspotImageBadge } from "@/components/trade/HotspotImageBadge";

type Status = "pending" | "committing" | "approved" | "discarded";
type Mode = "create" | "append";

interface Props {
  proposal: TearsheetProposal;
  onResolved?: (outcome: "approved" | "discarded", info?: { boardId: string; url: string; added: number; duplicates: number; mode: Mode; deferNavigation?: boolean }) => void;
  /** Lifted exclusion state so the parent can inject "kept vs removed" into the next chat turn. */
  excluded?: Set<string>;
  onExcludedChange?: (excluded: Set<string>) => void;
  /** IDs that are NEW vs the previous proposal — rationale will be shown for these. */
  newPickIds?: string[];
}

export function TearsheetProposalCard({ proposal, onResolved, excluded: excludedProp, onExcludedChange, newPickIds }: Props) {
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
  const uniquePreview = (() => {
    const seen = new Set<string>();
    return proposal.preview.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  })();
  const visiblePicks = uniquePreview.filter((p) => !excluded.has(p.id));

  const togglePick = (id: string) => {
    const next = new Set(excluded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExcludedLocal(next);
    onExcludedChange?.(next);
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
      <div className="mb-2">
        <span className="font-display text-[10px] uppercase tracking-widest text-accent">
          {headerLabel}
        </span>
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

      {/* Picks */}
      <ul className="space-y-1.5 mb-3">
        {uniquePreview.map((p) => {
          const isExcluded = excluded.has(p.id);
          const isNew = newPickIds ? newPickIds.includes(p.id) : false;
          // Prefer the rationale baked onto the preview by the edge function;
          // fall back to the per-id map on args for resilience.
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
              className={cn(
                "flex items-start gap-2.5 rounded-lg p-1.5 transition-opacity",
                isExcluded && "opacity-40",
              )}
            >
              <div className="relative h-10 w-10 shrink-0">
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted" loading="lazy" />
                ) : (
                  <div className="h-10 w-10 rounded bg-muted" />
                )}
                {p.image_from_hotspot && <HotspotImageBadge className="top-0 left-0 px-1 py-0 text-[8px]" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="font-body text-xs text-foreground truncate">{p.title}</div>
                  {isNew && (
                    <span className="shrink-0 rounded-full bg-accent/15 text-accent font-body text-[8px] uppercase tracking-widest px-1.5 py-0.5">
                      New
                    </span>
                  )}
                </div>
                <div className="font-body text-[10px] text-muted-foreground truncate">
                  {p.designer_name || "—"}{p.materials ? ` · ${p.materials}` : ""}
                </div>
                {showRationale && (
                  <>
                    <div className="font-body text-[10px] text-foreground/70 italic mt-0.5 leading-snug">
                      {rationale}
                    </div>
                    {rationaleDetail && (
                      <>
                        <button
                          type="button"
                          onClick={toggleDetail}
                          aria-expanded={isExpanded}
                          className="mt-1 inline-flex items-center gap-1 font-body text-[9px] uppercase tracking-widest text-accent hover:text-accent/80 transition-colors"
                        >
                          <ChevronDown
                            className={cn(
                              "h-2.5 w-2.5 transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                          {isExpanded ? "Hide reasoning" : "Why this pick"}
                        </button>
                        {isExpanded && (
                          <div className="mt-1 rounded-md border border-accent/30 bg-accent/[0.04] px-2 py-1.5 font-body text-[10.5px] text-foreground/80 leading-relaxed animate-fade-in">
                            {rationaleDetail}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
              {status === "pending" && (
                <button
                  onClick={() => togglePick(p.id)}
                  className="text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border self-center"
                  aria-label={isExcluded ? "Include" : "Exclude"}
                >
                  {isExcluded ? "Add" : "Skip"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="font-body text-[11px] text-destructive mb-2">{error}</p>
      )}

      {/* Actions */}
      {status === "pending" && (
        <div className="flex items-center justify-end gap-2">
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
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
