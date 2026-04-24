import { useMemo, useState } from "react";
import { FolderOpen, Plus, Check, X } from "lucide-react";
import { useProjects, getRecentProjectIds, pushRecentProject, type Project } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  value: string | null;
  onChange: (projectId: string | null) => void;
  compact?: boolean;
}

/**
 * Shared project picker. Shows recent projects first (auto-suggest),
 * then full list, with inline "Create project" affordance.
 */
export function ProjectPicker({ value, onChange, compact }: Props) {
  const { user } = useAuth();
  const { projects, loading, refresh } = useProjects({ activeOnly: false });
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [filter, setFilter] = useState("");

  const recentIds = getRecentProjectIds();
  const selected = projects.find((p) => p.id === value) || null;

  const { recent, others } = useMemo(() => {
    const filtered = projects.filter(
      (p) =>
        !filter ||
        p.name.toLowerCase().includes(filter.toLowerCase()) ||
        p.client_name.toLowerCase().includes(filter.toLowerCase())
    );
    const recent = recentIds
      .map((id) => filtered.find((p) => p.id === id))
      .filter(Boolean) as Project[];
    const recentSet = new Set(recent.map((p) => p.id));
    const others = filtered.filter((p) => !recentSet.has(p.id));
    return { recent, others };
  }, [projects, recentIds, filter]);

  const handleSelect = (id: string | null) => {
    onChange(id);
    if (id) pushRecentProject(id);
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
    handleSelect((data as any).id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 font-body text-xs text-foreground hover:bg-muted/40 transition-colors ${compact ? "" : "min-h-[36px]"}`}
        >
          <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate max-w-[180px]">
            {selected ? selected.name : "Assign to project"}
          </span>
          {selected && (
            <X
              className="h-3 w-3 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(null);
              }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search projects…"
            className="h-8 text-xs"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
          )}
          {!loading && recent.length === 0 && others.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No projects yet — create one below.
            </div>
          )}
          {recent.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                Recent
              </div>
              {recent.map((p) => (
                <ProjectRow key={p.id} project={p} selected={p.id === value} onSelect={handleSelect} />
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
                <ProjectRow key={p.id} project={p} selected={p.id === value} onSelect={handleSelect} />
              ))}
            </>
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
          <Button
            size="sm"
            variant="default"
            disabled={!newName.trim() || creating}
            onClick={handleCreate}
            className="h-8 px-2"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProjectRow({
  project,
  selected,
  onSelect,
}: {
  project: Project;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(project.id)}
      className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-muted/40 transition-colors"
    >
      <div className="min-w-0">
        <div className="font-body text-xs text-foreground truncate">{project.name}</div>
        {project.client_name && (
          <div className="font-body text-[10px] text-muted-foreground truncate">
            {project.client_name}
          </div>
        )}
      </div>
      {selected && <Check className="h-3.5 w-3.5 text-foreground shrink-0 ml-2" />}
    </button>
  );
}
