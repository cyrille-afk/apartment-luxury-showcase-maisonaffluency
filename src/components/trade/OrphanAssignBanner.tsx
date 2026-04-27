import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useProjects } from "@/hooks/useProjects";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type OrphanQuote = { id: string; client_name: string | null; created_at: string };
type OrphanBoard = { id: string; title: string; created_at: string };
type OrphanTimeline = { id: string; quote_id: string; kanban_status: string };

const DISMISS_KEY = "ma:orphan-banner-dismissed-at";
const DISMISS_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * On first visit (per user, per session-scoped expiry), if the user has any
 * unassigned quotes/boards/timelines, prompt them to bulk-assign each to a
 * project. Snoozable for 7 days. Hidden inside admin/login routes.
 */
export function OrphanAssignBanner() {
  const { user, isTradeUser, isAdmin } = useAuth();
  const location = useLocation();
  const { projects, refresh: refreshProjects } = useProjects({ activeOnly: false });

  const [quotes, setQuotes] = useState<OrphanQuote[]>([]);
  const [boards, setBoards] = useState<OrphanBoard[]>([]);
  const [timelines, setTimelines] = useState<OrphanTimeline[]>([]);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [bulkProject, setBulkProject] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const path = location.pathname;
  const hidden =
    !user ||
    (!isTradeUser && !isAdmin) ||
    path.startsWith("/trade/login") ||
    path.startsWith("/trade/register") ||
    path.startsWith("/trade/admin");

  useEffect(() => {
    if (hidden) return;
    // Snooze check
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw && Date.now() - parseInt(raw, 10) < DISMISS_TTL_MS) return;
    } catch { /* ignore */ }

    let cancelled = false;
    (async () => {
      setLoading(true);
      const [q, b, t] = await Promise.all([
        supabase
          .from("trade_quotes")
          .select("id, client_name, created_at")
          .eq("user_id", user!.id)
          .is("project_id", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("client_boards" as any)
          .select("id, title, created_at")
          .eq("user_id", user!.id)
          .is("project_id", null)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("order_timeline" as any)
          .select("id, quote_id, kanban_status")
          .eq("user_id", user!.id)
          .is("project_id", null)
          .limit(50),
      ]);
      if (cancelled) return;
      setQuotes((q.data as any) || []);
      setBoards((b.data as any) || []);
      setTimelines((t.data as any) || []);
      const total =
        ((q.data as any)?.length || 0) +
        ((b.data as any)?.length || 0) +
        ((t.data as any)?.length || 0);
      setOpen(total > 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [hidden, user?.id]);

  const total = quotes.length + boards.length + timelines.length;
  if (hidden || !open || total === 0) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch { /* ignore */ }
    setOpen(false);
    setExpanded(false);
  };

  const applyBulk = () => {
    if (!bulkProject) return;
    const map: Record<string, string> = { ...assignments };
    quotes.forEach((q) => { map[`quote:${q.id}`] = bulkProject; });
    boards.forEach((b) => { map[`board:${b.id}`] = bulkProject; });
    timelines.forEach((t) => { map[`timeline:${t.id}`] = bulkProject; });
    setAssignments(map);
  };

  const saveAll = async () => {
    const entries = Object.entries(assignments).filter(([, v]) => !!v);
    if (entries.length === 0) {
      toast.error("Pick a project for at least one item, or snooze the prompt.");
      return;
    }
    setSaving(true);
    const groups: Record<string, { quotes: string[]; boards: string[]; timelines: string[] }> = {};
    entries.forEach(([key, projectId]) => {
      const [kind, id] = key.split(":");
      groups[projectId] ||= { quotes: [], boards: [], timelines: [] };
      if (kind === "quote") groups[projectId].quotes.push(id);
      if (kind === "board") groups[projectId].boards.push(id);
      if (kind === "timeline") groups[projectId].timelines.push(id);
    });

    let errors = 0;
    for (const [projectId, g] of Object.entries(groups)) {
      const tasks: Promise<any>[] = [];
      if (g.quotes.length)
        tasks.push(Promise.resolve(supabase.from("trade_quotes").update({ project_id: projectId } as any).in("id", g.quotes)));
      if (g.boards.length)
        tasks.push(Promise.resolve(supabase.from("client_boards" as any).update({ project_id: projectId } as any).in("id", g.boards)));
      if (g.timelines.length)
        tasks.push(Promise.resolve(supabase.from("order_timeline" as any).update({ project_id: projectId } as any).in("id", g.timelines)));
      const results = await Promise.all(tasks);
      results.forEach((r) => { if (r.error) errors++; });
    }
    setSaving(false);
    if (errors > 0) {
      toast.error(`${errors} update(s) failed. Try again.`);
      return;
    }
    toast.success(`Assigned ${entries.length} item${entries.length === 1 ? "" : "s"} to project.`);
    // Remove assigned items from the list
    setQuotes((prev) => prev.filter((q) => !assignments[`quote:${q.id}`]));
    setBoards((prev) => prev.filter((b) => !assignments[`board:${b.id}`]));
    setTimelines((prev) => prev.filter((t) => !assignments[`timeline:${t.id}`]));
    setAssignments({});
    setBulkProject(null);
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <p className="font-body text-xs md:text-sm text-foreground">
            <span className="font-medium">{total}</span> item{total === 1 ? "" : "s"} not yet linked to a project
            <span className="text-muted-foreground hidden md:inline">
              {" "}— {quotes.length} quote{quotes.length === 1 ? "" : "s"}, {boards.length} board{boards.length === 1 ? "" : "s"}, {timelines.length} timeline{timelines.length === 1 ? "" : "s"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Hide" : "Assign"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" onClick={dismiss}>
            Snooze 7d
            <X className="h-3 w-3 ml-1" />
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-amber-500/20 p-4 space-y-3">
          {/* Bulk assign */}
          <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-border">
            <span className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Bulk assign all to:
            </span>
            <ProjectPicker value={bulkProject} onChange={setBulkProject} compact />
            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!bulkProject} onClick={applyBulk}>
              Apply
            </Button>
            {projects.length === 0 && (
              <span className="font-body text-[11px] text-muted-foreground">
                Create your first project from the picker →
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            <Column title="Quotes" items={quotes} emptyText="No orphan quotes." render={(q) => q.client_name || "Untitled quote"} kind="quote" assignments={assignments} setAssignments={setAssignments} />
            <Column title="Mood boards" items={boards} emptyText="No orphan boards." render={(b) => b.title} kind="board" assignments={assignments} setAssignments={setAssignments} />
            <Column title="Order timelines" items={timelines} emptyText="No orphan timelines." render={(t) => `Status: ${t.kanban_status.replace(/_/g, " ")}`} kind="timeline" assignments={assignments} setAssignments={setAssignments} />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setExpanded(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1.5" disabled={saving} onClick={saveAll}>
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              Save assignments
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Column<T extends { id: string }>({
  title, items, emptyText, render, kind, assignments, setAssignments,
}: {
  title: string;
  items: T[];
  emptyText: string;
  render: (item: T) => string;
  kind: "quote" | "board" | "timeline";
  assignments: Record<string, string>;
  setAssignments: (next: Record<string, string>) => void;
}) {
  return (
    <div>
      <h3 className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-2">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground/70">{emptyText}</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((item) => {
            const key = `${kind}:${item.id}`;
            return (
              <div key={item.id} className="rounded-md border border-border bg-background/50 p-2">
                <div className="font-body text-xs text-foreground truncate mb-1.5">{render(item)}</div>
                <ProjectPicker
                  value={assignments[key] || null}
                  onChange={(pid) => {
                    const next = { ...assignments };
                    if (pid) next[key] = pid;
                    else delete next[key];
                    setAssignments(next);
                  }}
                  compact
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
