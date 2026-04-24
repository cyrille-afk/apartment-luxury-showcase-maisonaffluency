import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Pencil, Save, Trash2, Loader2, FileText, FolderArchive,
  ListChecks, CalendarClock, Image as ImageIcon, ExternalLink, Archive, CheckCircle2,
  Package, Users,
} from "lucide-react";
import { useProject } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type LinkedQuote = { id: string; status: string; created_at: string; client_name: string | null };
type LinkedBoard = { id: string; title: string; status: string; created_at: string };
type LinkedTimeline = { id: string; quote_id: string; kanban_status: string; estimated_delivery_at: string | null };

export default function TradeProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { project, loading, refresh } = useProject(id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", client_name: "", location: "", notes: "", target_completion_date: "" });
  const [saving, setSaving] = useState(false);

  const [quotes, setQuotes] = useState<LinkedQuote[]>([]);
  const [boards, setBoards] = useState<LinkedBoard[]>([]);
  const [timelines, setTimelines] = useState<LinkedTimeline[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);

  useEffect(() => {
    if (project) {
      setForm({
        name: project.name,
        client_name: project.client_name,
        location: project.location,
        notes: project.notes || "",
        target_completion_date: project.target_completion_date || "",
      });
    }
  }, [project]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      setLoadingLinks(true);
      const sb = supabase as any;
      const [q, b, t] = await Promise.all([
        sb.from("trade_quotes").select("id, status, created_at, client_name").eq("project_id", id).order("created_at", { ascending: false }),
        sb.from("client_boards").select("id, title, status, created_at").eq("project_id", id).order("created_at", { ascending: false }),
        sb.from("order_timeline").select("id, quote_id, kanban_status, estimated_delivery_at").eq("project_id", id),
      ]);
      setQuotes((q.data as any) || []);
      setBoards((b.data as any) || []);
      setTimelines((t.data as any) || []);
      setLoadingLinks(false);
    })();
  }, [id, user]);

  const handleSave = async () => {
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from("projects" as any).update({
      name: form.name.trim() || "Untitled Project",
      client_name: form.client_name.trim(),
      location: form.location.trim(),
      notes: form.notes.trim(),
      target_completion_date: form.target_completion_date || null,
    } as any).eq("id", id);
    setSaving(false);
    if (error) { toast.error("Could not save"); return; }
    toast.success("Project saved");
    setEditing(false);
    refresh();
  };

  const setStatus = async (status: "active" | "completed" | "archived") => {
    if (!id) return;
    const { error } = await supabase.from("projects" as any).update({ status } as any).eq("id", id);
    if (error) { toast.error("Could not update"); return; }
    toast.success(`Marked as ${status}`);
    refresh();
  };

  const handleDelete = async () => {
    if (!id) return;
    const { error } = await supabase.from("projects" as any).delete().eq("id", id);
    if (error) { toast.error("Could not delete"); return; }
    toast.success("Project deleted");
    navigate("/trade/projects");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="font-body text-sm text-muted-foreground mb-4">Project not found.</p>
        <Link to="/trade/projects" className="font-body text-xs underline">Back to projects</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <Link to="/trade/projects" className="inline-flex items-center gap-1.5 font-body text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All projects
        </Link>
        <div className="flex items-center gap-2">
          {project.status !== "active" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("active")} className="gap-1.5">
              Reactivate
            </Button>
          )}
          {project.status !== "completed" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("completed")} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Mark complete
            </Button>
          )}
          {project.status !== "archived" && (
            <Button size="sm" variant="ghost" onClick={() => setStatus("archived")} className="gap-1.5">
              <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete project?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the project. Linked quotes, mood boards, and timelines will be detached but not deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Header */}
      <div className="border border-border rounded-md p-6 mb-6">
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Project name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="font-display text-lg" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Client</Label>
                <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Target completion</Label>
              <Input type="date" value={form.target_completion_date} onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl md:text-3xl text-foreground mb-2">{project.name}</h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-body text-muted-foreground">
                {project.client_name && <span>{project.client_name}</span>}
                {project.location && <span>· {project.location}</span>}
                {project.target_completion_date && (
                  <span>· Target: {new Date(project.target_completion_date).toLocaleDateString()}</span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-muted text-foreground/80 text-[10px] uppercase tracking-wider">
                  {project.status}
                </span>
              </div>
              {project.notes && (
                <p className="mt-3 font-body text-sm text-muted-foreground whitespace-pre-wrap">{project.notes}</p>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)} className="gap-1.5 shrink-0">
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        )}
      </div>

      {/* Linked items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section
          icon={FileText}
          title="Quotes"
          count={quotes.length}
          loading={loadingLinks}
          empty="No quotes linked yet."
          link="/trade/quotes"
          linkLabel="Manage quotes"
        >
          {quotes.map((q) => (
            <Row
              key={q.id}
              to="/trade/quotes"
              title={q.client_name || "Untitled quote"}
              meta={`${q.status} · ${new Date(q.created_at).toLocaleDateString()}`}
            />
          ))}
        </Section>

        <Section
          icon={FolderArchive}
          title="Project folders / boards"
          count={boards.length}
          loading={loadingLinks}
          empty="No mood boards linked yet."
          link="/trade/boards"
          linkLabel="Manage boards"
        >
          {boards.map((b) => (
            <Row
              key={b.id}
              to={`/trade/boards/${b.id}`}
              title={b.title}
              meta={`${b.status} · ${new Date(b.created_at).toLocaleDateString()}`}
            />
          ))}
        </Section>

        <Section
          icon={CalendarClock}
          title="Order timelines"
          count={timelines.length}
          loading={loadingLinks}
          empty="No order timelines linked yet."
          link="/trade/order-timeline"
          linkLabel="Open timeline board"
        >
          {timelines.map((t) => (
            <Row
              key={t.id}
              to="/trade/order-timeline"
              title={`Status: ${t.kanban_status.replace(/_/g, " ")}`}
              meta={t.estimated_delivery_at ? `ETA ${new Date(t.estimated_delivery_at).toLocaleDateString()}` : "ETA TBD"}
            />
          ))}
        </Section>

        <Section
          icon={ListChecks}
          title="FF&E schedule"
          count={null}
          loading={false}
          empty=""
          link={`/trade/ffe-schedule?project=${project.id}`}
          linkLabel="Open FF&E for this project"
        >
          <p className="font-body text-xs text-muted-foreground px-3 py-2">
            FF&E auto-aggregates from quotes linked to this project.
          </p>
        </Section>

        <Section
          icon={ImageIcon}
          title="Tearsheets & mood boards"
          count={null}
          loading={false}
          empty=""
          link="/trade/tearsheets"
          linkLabel="Open tearsheet builder"
        >
          <p className="font-body text-xs text-muted-foreground px-3 py-2">
            Tag tearsheets and mood boards with this project to see them here.
          </p>
          <Link
            to="/trade/mood-boards"
            className="block px-3 py-2 text-xs font-body text-foreground hover:bg-muted/40"
          >
            Open mood board builder →
          </Link>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon, title, count, loading, empty, link, linkLabel, children,
}: {
  icon: any; title: string; count: number | null; loading: boolean;
  empty: string; link: string; linkLabel: string; children: React.ReactNode;
}) {
  const childArray = Array.isArray(children) ? children : [children];
  const hasContent = childArray.some((c) => c);
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-sm text-foreground">{title}</h2>
          {count !== null && (
            <span className="text-[10px] text-muted-foreground">({count})</span>
          )}
        </div>
        <Link to={link} className="font-body text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          {linkLabel} <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="divide-y divide-border">
        {loading ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">Loading…</div>
        ) : !hasContent && empty ? (
          <div className="px-3 py-4 text-xs text-muted-foreground">{empty}</div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function Row({ to, title, meta }: { to: string; title: string; meta: string }) {
  return (
    <Link to={to} className="flex items-center justify-between px-3 py-2.5 hover:bg-muted/40 transition-colors">
      <div className="min-w-0">
        <div className="font-body text-xs text-foreground truncate">{title}</div>
        <div className="font-body text-[10px] text-muted-foreground truncate">{meta}</div>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0 ml-2" />
    </Link>
  );
}
