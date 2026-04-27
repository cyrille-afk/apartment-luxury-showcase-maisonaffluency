import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, FolderOpen, Loader2, Calendar, MapPin, User as UserIcon, Users, EyeOff } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const STATUS_TABS: { key: "active" | "completed" | "archived"; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "archived", label: "Archived" },
];

export default function TradeProjects() {
  const { user } = useAuth();
  const { currentStudio, canEdit, isAdmin } = useStudio();
  const { projects, loading, refresh } = useProjects();
  const [tab, setTab] = useState<"active" | "completed" | "archived">("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [creating, setCreating] = useState(false);
  const [hiddenForMeCount, setHiddenForMeCount] = useState(0);

  // Count projects in this studio that are explicitly hidden from the current
  // user via a per-project override (role = NULL). Purely informational.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || !currentStudio) { setHiddenForMeCount(0); return; }
      const { data } = await supabase
        .from("studio_project_overrides" as any)
        .select("project_id, role, projects!inner(studio_id)")
        .eq("user_id", user.id)
        .eq("projects.studio_id", currentStudio.id)
        .is("role", null);
      if (!cancelled) setHiddenForMeCount((data || []).length);
    })();
    return () => { cancelled = true; };
  }, [user?.id, currentStudio?.id, projects.length]);

  const filtered = projects.filter((p) => p.status === tab);


  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    if (!canEdit) {
      toast.error("Your role doesn't allow creating projects in this studio");
      return;
    }
    setCreating(true);
    const { error } = await supabase.from("projects" as any).insert({
      user_id: user.id,
      studio_id: currentStudio?.id ?? null,
      name: name.trim(),
      client_name: clientName.trim(),
      location: location.trim(),
    } as any);
    setCreating(false);
    if (error) { toast.error("Could not create project"); return; }
    toast.success("Project created");
    setName(""); setClientName(""); setLocation("");
    setDialogOpen(false);
    refresh();
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl text-foreground mb-1">Projects</h1>
          <p className="font-body text-sm text-muted-foreground">
            Group quotes, mood boards, FF&E, tearsheets, and timelines under named projects.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" /> New project
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">Create project</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Project name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Villa Antibes — Master Suite"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-xs">Client name</Label>
                <Input value={clientName} onChange={(e) => setClientName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City / region" />
              </div>
              <Button onClick={handleCreate} disabled={!name.trim() || creating} className="w-full">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-1 border-b border-border mb-6">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 font-body text-xs uppercase tracking-[0.15em] border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            <span className="ml-2 text-[10px] text-muted-foreground">
              {projects.filter((p) => p.status === t.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-md">
          <FolderOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <p className="font-body text-sm text-muted-foreground mb-4">
            No {tab} projects yet.
          </p>
          {tab === "active" && (
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              Create your first project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              to={`/trade/projects/${p.id}`}
              className="group block border border-border rounded-md overflow-hidden bg-background hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                {p.cover_image_url ? (
                  <img
                    src={p.cover_image_url}
                    alt={p.name}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-display text-base text-foreground truncate mb-1">{p.name}</h3>
                <div className="space-y-1 text-xs text-muted-foreground font-body">
                  {p.client_name && (
                    <div className="flex items-center gap-1.5 truncate">
                      <UserIcon className="h-3 w-3 shrink-0" /> {p.client_name}
                    </div>
                  )}
                  {p.location && (
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" /> {p.location}
                    </div>
                  )}
                  {p.target_completion_date && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      {new Date(p.target_completion_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
