import { useState } from "react";
import { Loader2, Check, X, Pencil, ExternalLink, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { commitProposal, type TearsheetProposal } from "@/lib/tradeConciergeStream";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Status = "pending" | "committing" | "approved" | "discarded";

interface Props {
  proposal: TearsheetProposal;
  onResolved?: (outcome: "approved" | "discarded", info?: { boardId: string; url: string; added: number; mode: "create" | "append" }) => void;
}

export function TearsheetProposalCard({ proposal, onResolved }: Props) {
  const isAppend = proposal.tool === "add_to_tearsheet";
  const initialTitle = isAppend ? proposal.args.board_title : proposal.args.title;

  const [title, setTitle] = useState(initialTitle);
  const [editingTitle, setEditingTitle] = useState(false);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>("pending");
  const [result, setResult] = useState<{ boardId: string; url: string; added: number; duplicates: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visiblePicks = proposal.preview.filter((p) => !excluded.has(p.id));

  const togglePick = (id: string) => {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async () => {
    if (visiblePicks.length === 0) {
      toast.error("Select at least one piece to include.");
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
            board_id: proposal.args.board_id,
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
    onResolved?.("approved", {
      boardId: res.board_id,
      url: res.url,
      added: res.added,
      mode: isAppend ? "append" : "create",
    });
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
      <div className="flex items-center gap-2 mb-2">
        <span className="font-display text-[10px] uppercase tracking-widest text-accent">
          {headerLabel}
        </span>
      </div>

      {/* Title — editable only in create mode */}
      <div className="flex items-center gap-2 mb-2">
        {!isAppend && editingTitle && status === "pending" ? (
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
          <h4 className="flex-1 font-display text-sm text-foreground">
            {isAppend && <span className="text-muted-foreground font-body text-[11px] mr-1">→</span>}
            {title || "Untitled tearsheet"}
          </h4>
        )}
        {!isAppend && status === "pending" && (
          <button
            onClick={() => setEditingTitle((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {proposal.args.note && (
        <p className="font-body text-xs text-muted-foreground italic mb-2.5">"{proposal.args.note}"</p>
      )}

      {/* Picks */}
      <ul className="space-y-1.5 mb-3">
        {proposal.preview.map((p) => {
          const isExcluded = excluded.has(p.id);
          return (
            <li
              key={p.id}
              className={cn(
                "flex items-center gap-2.5 rounded-lg p-1.5 transition-opacity",
                isExcluded && "opacity-40",
              )}
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-10 w-10 rounded object-cover bg-muted" loading="lazy" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted" />
              )}
              <div className="flex-1 min-w-0">
                <div className="font-body text-xs text-foreground truncate">{p.title}</div>
                <div className="font-body text-[10px] text-muted-foreground truncate">
                  {p.designer_name || "—"}{p.materials ? ` · ${p.materials}` : ""}
                </div>
              </div>
              {status === "pending" && (
                <button
                  onClick={() => togglePick(p.id)}
                  className="text-muted-foreground hover:text-foreground text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-border"
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
            disabled={visiblePicks.length === 0 || (isAppend && !proposal.args.board_id)}
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
