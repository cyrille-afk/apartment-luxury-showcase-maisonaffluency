import { format } from "date-fns";
import { Columns2, FolderKanban, History, RotateCcw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  filterRenderHistoryByScope,
  renderKindLabel,
  renderModeLabel,
  type AiRenderHistoryEntry,
  type ProjectScopeFilter,
} from "@/lib/aiRenderHistory";

export interface RenderHistoryProjectOption {
  id: string;
  name: string;
  client_name: string | null;
}

interface AiRenderHistoryPanelProps {
  entries: AiRenderHistoryEntry[];
  loading: boolean;
  projects: RenderHistoryProjectOption[];
  scope: ProjectScopeFilter;
  onScopeChange: (scope: ProjectScopeFilter) => void;
  activeResultUrl: string | null;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  onOpenCompare: () => void;
  onClearCompare: () => void;
  onReopen: (entry: AiRenderHistoryEntry) => void;
  onDelete: (entry: AiRenderHistoryEntry) => void;
  deletingId: string | null;
}

export function AiRenderHistoryPanel({
  entries,
  loading,
  projects,
  scope,
  onScopeChange,
  activeResultUrl,
  compareIds,
  onToggleCompare,
  onOpenCompare,
  onClearCompare,
  onReopen,
  onDelete,
  deletingId,
}: AiRenderHistoryPanelProps) {
  const visible = filterRenderHistoryByScope(entries, scope);
  const selectedCount = compareIds.length;

  const countFor = (projectId: string | null) =>
    entries.filter((entry) => entry.project_id === projectId).length;

  return (
    <section id="render-history" className="border border-border rounded-lg overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <h2 className="font-display text-sm text-foreground">Project Render History</h2>
          <span className="rounded-full bg-background border border-border px-2 py-0.5 font-body text-[10px] text-muted-foreground">
            {visible.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="render-history-project-filter">
            Filter render history by project
          </label>
          <select
            id="render-history-project-filter"
            value={scope}
            onChange={(e) => onScopeChange(e.target.value)}
            className="h-8 rounded-md border border-border bg-background px-2.5 font-body text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-foreground/20"
          >
            <option value="all">All Projects ({entries.length})</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} ({countFor(project.id)})
              </option>
            ))}
            <option value="unassigned">Unassigned ({countFor(null)})</option>
          </select>

          {selectedCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Button size="sm" className="h-8 text-xs" disabled={selectedCount !== 2} onClick={onOpenCompare}>
                <Columns2 className="w-3.5 h-3.5 mr-1.5" />
                {selectedCount === 2 ? "Compare 2 Renders" : "Select 1 more to compare"}
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClearCompare} title="Clear comparison selection">
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center font-body text-xs text-muted-foreground">
          Loading render history…
        </div>
      ) : visible.length === 0 ? (
        <div className="py-12 px-5 flex flex-col items-center justify-center gap-2 text-center">
          <FolderKanban className="w-6 h-6 text-muted-foreground/40" />
          <p className="font-body text-sm text-muted-foreground">
            No saved renders for this project yet
          </p>
          <p className="font-body text-xs text-muted-foreground/80 max-w-md">
            Every axonometric generation and AI edit is saved here automatically so you can revisit, compare, and reopen versions anytime.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
          {visible.map((entry) => {
            const compareIdx = compareIds.indexOf(entry.id);
            const isActive = activeResultUrl === entry.result_image_url;
            return (
              <article
                key={entry.id}
                className={`rounded-lg border overflow-hidden flex flex-col transition-colors ${
                  compareIdx >= 0
                    ? "border-primary ring-1 ring-primary"
                    : isActive
                      ? "border-foreground/60"
                      : "border-border"
                }`}
              >
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  <img
                    src={entry.result_image_url}
                    alt={`${renderModeLabel(entry.mode)} — ${entry.project_name || "Unassigned"}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    {compareIdx >= 0 && (
                      <span className="rounded bg-primary px-1.5 py-0.5 font-body text-[10px] font-medium text-primary-foreground">
                        Compare {compareIdx === 0 ? "A" : "B"}
                      </span>
                    )}
                    {isActive && (
                      <span className="rounded bg-foreground/85 px-1.5 py-0.5 font-body text-[10px] text-background">
                        Open
                      </span>
                    )}
                  </div>
                  <span className="absolute bottom-2 right-2 rounded bg-background/85 backdrop-blur-xs px-1.5 py-0.5 font-body text-[10px] text-foreground">
                    {renderKindLabel(entry.kind)}
                  </span>
                </div>

                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-xs text-foreground truncate">
                        {renderModeLabel(entry.mode)}
                      </span>
                      <span className="font-body text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(entry.created_at), "d MMM, HH:mm")}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {scope === "all" && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-body text-[10px] text-foreground truncate max-w-[140px]">
                          {entry.project_name || "Unassigned"}
                        </span>
                      )}
                      {entry.style_preset && (
                        <span className="rounded-full bg-muted px-2 py-0.5 font-body text-[10px] text-muted-foreground">
                          {entry.style_preset}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 font-body text-[10px] uppercase text-muted-foreground">
                        {entry.quality_tier}
                      </span>
                    </div>
                    {entry.prompt_note && (
                      <p className="font-body text-[11px] text-muted-foreground line-clamp-2">
                        {entry.prompt_note}
                      </p>
                    )}
                  </div>

                  <div className="mt-auto pt-1 flex items-center gap-1.5">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs" onClick={() => onReopen(entry)}>
                      <RotateCcw className="w-3 h-3 mr-1" />Reopen
                    </Button>
                    <Button
                      variant={compareIdx >= 0 ? "default" : "outline"}
                      size="sm"
                      className="h-8 text-xs px-2.5"
                      onClick={() => onToggleCompare(entry.id)}
                      aria-pressed={compareIdx >= 0}
                    >
                      <Columns2 className="w-3 h-3 mr-1" />
                      {compareIdx >= 0 ? (compareIdx === 0 ? "A" : "B") : "Compare"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === entry.id}
                      onClick={() => onDelete(entry)}
                      aria-label="Delete render from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}