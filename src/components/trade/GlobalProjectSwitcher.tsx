import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronDown, FolderKanban, FolderOpen, Plus, X } from "lucide-react";
import { useProjects, getRecentProjectIds, pushRecentProject } from "@/hooks/useProjects";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Compact global project switcher rendered in the trade header.
 * Sets the cross-page `?project=` filter (sessionStorage-backed via useProjectFilter).
 * Per-tool overrides remain available because every tool reads `?project=` directly.
 */
export function GlobalProjectSwitcher() {
  const { user } = useAuth();
  const { projectFilter, setProjectFilter, clearProjectFilter } = useProjectFilter();
  const { projects, loading, refresh } = useProjects({ activeOnly: false });
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const selected = projects.find((p) => p.id === projectFilter) || null;

  // Hide on routes where a project filter is meaningless
  const path = location.pathname;
  const hidden =
    path.startsWith("/trade/admin") ||
    path.startsWith("/trade/login") ||
    path === "/trade/settings";

  const recentIds = useMemo(() => getRecentProjectIds(), [open]);
  const filtered = useMemo(
    () =>
      projects.filter(
        (p) =>
          !filter ||
          p.name.toLowerCase().includes(filter.toLowerCase()) ||
          p.client_name.toLowerCase().includes(filter.toLowerCase()),
      ),
    [projects, filter],
  );
  const recent = recentIds
    .map((id) => filtered.find((p) => p.id === id))
    .filter(Boolean) as typeof projects;
  const recentSet = new Set(recent.map((p) => p.id));
  const others = filtered.filter((p) => !recentSet.has(p.id));

  const choose = (id: string | null) => {
    if (id) {
      setProjectFilter(id);
      pushRecentProject(id);
    } else {
      clearProjectFilter();
    }
    setOpen(false);
  };

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    setCreating(true);
    const { data, error } = await supabase
      .from("projects" as any)
      .insert({ user_id: user.id, name: newName.trim() } as any)
      .select()
      .single();
    setCreating(false);
    if (error || !data) {
      toast.error("Could not create project");
      return;
    }
    toast.success("Project created");
    setNewName("");
    await refresh();
    choose((data as any).id);
  };

  if (hidden) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="hidden md:inline-flex items-center gap-1.5 rounded-md border border-border bg-background hover:bg-muted/40 transition-colors px-2.5 py-1.5 font-body text-[11px] text-foreground max-w-[220px]"
          aria-label="Active project"
        >
          <FolderKanban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">
            {selected ? selected.name : "All projects"}
          </span>
          {selected ? (
            <X
              className="h-3 w-3 text-muted-foreground hover:text-foreground shrink-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                choose(null);
              }}
            />
          ) : (
            <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-2 border-b border-border">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search projects…"
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          <button
            type="button"
            onClick={() => choose(null)}
            className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
          >
            <span className="font-body text-xs text-foreground">All projects (no filter)</span>
            {!selected && <Check className="h-3.5 w-3.5 text-foreground shrink-0 ml-2" />}
          </button>
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
          )}
          {recent.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Recent
              </div>
              {recent.map((p) => (
                <Row key={p.id} p={p} active={p.id === projectFilter} onSelect={() => choose(p.id)} />
              ))}
            </>
          )}
          {others.length > 0 && (
            <>
              {recent.length > 0 && (
                <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                  All projects
                </div>
              )}
              {others.map((p) => (
                <Row key={p.id} p={p} active={p.id === projectFilter} onSelect={() => choose(p.id)} />
              ))}
            </>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              No projects yet — create one below.
            </div>
          )}
        </div>
        <div className="border-t border-border p-2 flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project name"
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button size="sm" disabled={!newName.trim() || creating} onClick={handleCreate} className="h-8 px-2">
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        {selected && (
          <div className="border-t border-border p-2">
            <Link
              to={`/trade/projects/${selected.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-muted/40 font-body text-[11px] text-foreground"
            >
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
              Open project workspace →
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Row({ p, active, onSelect }: { p: any; active: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
    >
      <div className="min-w-0">
        <div className="font-body text-xs text-foreground truncate">{p.name}</div>
        {p.client_name && (
          <div className="font-body text-[10px] text-muted-foreground truncate">{p.client_name}</div>
        )}
      </div>
      {active && <Check className="h-3.5 w-3.5 text-foreground shrink-0 ml-2" />}
    </button>
  );
}
