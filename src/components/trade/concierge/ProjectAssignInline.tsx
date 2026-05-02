import { useMemo, useState } from "react";
import { Loader2, Check, FolderPlus } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  boardId: string;
  /** Called when the user picks a project OR explicitly skips. */
  onResolved: (projectId: string | null) => void;
}

/**
 * Compact post-commit prompt: "Assign this tearsheet to a project?"
 * Shows the user's active projects as chips + a "Skip" affordance.
 * Updates client_boards.project_id directly (RLS allows owners).
 */
export function ProjectAssignInline({ boardId, onResolved }: Props) {
  const { projects, loading } = useProjects({ activeOnly: true });
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<{ projectName: string } | null>(null);

  // Show 6 most-recent projects inline; rest go in a select.
  const { quick, rest } = useMemo(() => {
    const active = projects.filter((p) => p.status === "active");
    return { quick: active.slice(0, 6), rest: active.slice(6) };
  }, [projects]);

  const handlePick = async (projectId: string, projectName: string) => {
    setSaving(projectId);

    // Look up the chosen project + the board's current metadata so we only
    // fill in fields that are still empty (never overwrite user edits).
    const [{ data: proj }, { data: board }] = await Promise.all([
      supabase
        .from("projects" as any)
        .select("client_name, studio_id, name")
        .eq("id", projectId)
        .maybeSingle(),
      supabase
        .from("client_boards")
        .select("client_name, studio_id, title")
        .eq("id", boardId)
        .maybeSingle(),
    ]);

    const updates: Record<string, unknown> = {
      project_id: projectId,
      updated_at: new Date().toISOString(),
    };
    const projectClient = (proj as any)?.client_name?.trim?.() || "";
    const projectStudio = (proj as any)?.studio_id ?? null;
    const projectFullName = (proj as any)?.name?.trim?.() || "";
    const boardClient = (board as any)?.client_name?.trim?.() || "";
    const boardStudio = (board as any)?.studio_id ?? null;
    const boardTitle = (board as any)?.title?.trim?.() || "";

    if (!boardClient && projectClient) updates.client_name = projectClient;
    if (!boardStudio && projectStudio) updates.studio_id = projectStudio;
    // If the title is still the generic placeholder, prefix it with the project name.
    if (projectFullName && /^untitled tearsheet$/i.test(boardTitle)) {
      updates.title = `${projectFullName} — Tearsheet`;
    }

    const { error } = await supabase
      .from("client_boards")
      .update(updates)
      .eq("id", boardId);
    setSaving(null);
    if (error) {
      toast.error(`Could not assign project: ${error.message}`);
      return;
    }

    // Audit trail: log the project assignment so it's traceable later.
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id;
    if (userId) {
      await supabase.from("trade_concierge_actions").insert({
        user_id: userId,
        tool: "assign_tearsheet_project",
        args: {
          board_id: boardId,
          project_id: projectId,
          project_name: projectFullName || projectName,
          autofilled: {
            client_name: updates.client_name ?? null,
            studio_id: updates.studio_id ?? null,
            title: updates.title ?? null,
          },
        },
        status: "approved",
        resulting_resource_id: boardId,
        resulting_resource_type: "client_board",
      });
    }

    setDone({ projectName });
    onResolved(projectId);
  };

  const handleSkip = async () => {
    // Audit trail: log the explicit skip so we know it wasn't just abandoned.
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user?.id;
    if (userId) {
      await supabase.from("trade_concierge_actions").insert({
        user_id: userId,
        tool: "assign_tearsheet_project",
        args: { board_id: boardId, project_id: null, skipped: true },
        status: "discarded",
        resulting_resource_id: boardId,
        resulting_resource_type: "client_board",
      });
    }
    setDone({ projectName: "" });
    onResolved(null);
  };

  if (done) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-accent/20">
        <p className="font-body text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Check className="h-3 w-3 text-accent" />
          {done.projectName ? <>Assigned to <span className="text-foreground">{done.projectName}</span></> : "Not assigned to a project"}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-accent/20">
      <div className="flex items-center gap-1.5 mb-2">
        <FolderPlus className="h-3 w-3 text-accent" />
        <span className="font-display text-[10px] uppercase tracking-widest text-accent">
          Assign to a project?
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="font-body text-[11px]">Loading your projects…</span>
        </div>
      ) : quick.length === 0 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="font-body text-[11px] text-muted-foreground">
            No active projects yet.
          </span>
          <button
            onClick={handleSkip}
            className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2 py-1"
          >
            Skip
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {quick.map((p) => (
              <button
                key={p.id}
                onClick={() => handlePick(p.id, p.name)}
                disabled={saving !== null}
                className={cn(
                  "rounded-full border border-border bg-background px-2.5 py-1 font-body text-[11px] text-foreground transition-colors",
                  "hover:border-accent hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed",
                  saving === p.id && "border-accent text-accent",
                )}
              >
                {saving === p.id ? (
                  <Loader2 className="h-3 w-3 animate-spin inline" />
                ) : (
                  <>
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 align-middle"
                      style={{ backgroundColor: p.color }}
                    />
                    {p.name}
                  </>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            {rest.length > 0 ? (
              <select
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  const proj = rest.find((p) => p.id === id);
                  if (proj) handlePick(proj.id, proj.name);
                }}
                disabled={saving !== null}
                defaultValue=""
                className="flex-1 rounded-md border border-border bg-background px-2 py-1 font-body text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="" disabled>
                  More projects ({rest.length})…
                </option>
                {rest.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            ) : <span />}
            <button
              onClick={handleSkip}
              disabled={saving !== null}
              className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground px-2 py-1"
            >
              Skip
            </button>
          </div>
        </>
      )}
    </div>
  );
}
