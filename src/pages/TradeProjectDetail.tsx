import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { useDesignerDisplayName } from "@/hooks/useDesignerDisplayName";
import ActiveFilterChips from "@/components/trade/ActiveFilterChips";
import {
  ArrowLeft, Pencil, Save, Trash2, Loader2, FileText, FolderArchive,
  ListChecks, CalendarClock, Image as ImageIcon, ExternalLink, Archive, CheckCircle2,
  Package, Users, LayoutGrid, Truck, Lock,
} from "lucide-react";
import { useProject } from "@/hooks/useProjects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const { user, isAdmin } = useAuth();
  const { project, loading, refresh } = useProject(id);
  const accessDenied = !loading && project != null && project.user_id !== user?.id && !isAdmin;
  const canManage = !accessDenied;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", client_name: "", location: "", notes: "", target_completion_date: "" });
  const [saving, setSaving] = useState(false);

  const [quotes, setQuotes] = useState<LinkedQuote[]>([]);
  const [boards, setBoards] = useState<LinkedBoard[]>([]);
  const [timelines, setTimelines] = useState<LinkedTimeline[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [quoteItemCount, setQuoteItemCount] = useState(0);
  const [boardItemCount, setBoardItemCount] = useState(0);
  const [designerBreakdown, setDesignerBreakdown] = useState<{ name: string; count: number }[]>([]);
  const { designerFilter: selectedDesigner, setDesignerFilter: setSelectedDesigner } = useProjectFilter();
  const selectedDesignerLabel = useDesignerDisplayName(selectedDesigner);
  const [brandQuoteIds, setBrandQuoteIds] = useState<Record<string, Set<string>>>({});
  const [brandBoardIds, setBrandBoardIds] = useState<Record<string, Set<string>>>({});

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
    if (!id || !user || accessDenied) return;
    (async () => {
      setLoadingLinks(true);
      const sb = supabase as any;
      const [q, b, t] = await Promise.all([
        sb.from("trade_quotes").select("id, status, created_at, client_name").eq("project_id", id).order("created_at", { ascending: false }),
        sb.from("client_boards").select("id, title, status, created_at").eq("project_id", id).order("created_at", { ascending: false }),
        sb.from("order_timeline").select("id, quote_id, kanban_status, estimated_delivery_at").eq("project_id", id),
      ]);
      const qList: LinkedQuote[] = (q.data as any) || [];
      const bList: LinkedBoard[] = (b.data as any) || [];
      setQuotes(qList);
      setBoards(bList);
      setTimelines((t.data as any) || []);

      // Aggregate item counts + designer breakdown
      const quoteIds = qList.map((x) => x.id);
      const boardIds = bList.map((x) => x.id);
      const [qItems, bItems] = await Promise.all([
        quoteIds.length
          ? sb.from("trade_quote_items").select("quote_id, quantity, trade_products(brand_name)").in("quote_id", quoteIds)
          : Promise.resolve({ data: [] }),
        boardIds.length
          ? sb.from("client_board_items").select("id, board_id, trade_products(brand_name)").in("board_id", boardIds)
          : Promise.resolve({ data: [] }),
      ]);
      const qItemsData: any[] = qItems.data || [];
      const bItemsData: any[] = bItems.data || [];
      const qCount = qItemsData.reduce((sum, r) => sum + (r.quantity || 1), 0);
      setQuoteItemCount(qCount);
      setBoardItemCount(bItemsData.length);

      const tally = new Map<string, number>();
      const qByBrand: Record<string, Set<string>> = {};
      const bByBrand: Record<string, Set<string>> = {};
      qItemsData.forEach((r) => {
        const name = r.trade_products?.brand_name;
        if (name) {
          tally.set(name, (tally.get(name) || 0) + (r.quantity || 1));
          (qByBrand[name] ||= new Set()).add(r.quote_id);
        }
      });
      bItemsData.forEach((r) => {
        const name = r.trade_products?.brand_name;
        if (name) {
          tally.set(name, (tally.get(name) || 0) + 1);
          (bByBrand[name] ||= new Set()).add(r.board_id);
        }
      });
      setBrandQuoteIds(qByBrand);
      setBrandBoardIds(bByBrand);
      const breakdown = Array.from(tally.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      setDesignerBreakdown(breakdown);

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

  if (accessDenied) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-muted mb-4">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <h1 className="font-display text-xl text-foreground mb-2">Access denied</h1>
        <p className="font-body text-sm text-muted-foreground mb-6">
          You don't have permission to view this project. Only the project owner or an administrator can open it.
        </p>
        <Link
          to="/trade/projects"
          className="inline-flex items-center gap-1.5 font-body text-xs text-foreground underline hover:no-underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to your projects
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <ActiveFilterChips className="mb-4" confirmClearAll />
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

      {/* Tabbed workspace hub */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="mb-4 flex flex-wrap h-auto bg-muted/30">
          <TabsTrigger value="overview" className="gap-1.5"><LayoutGrid className="h-3.5 w-3.5" /> Overview</TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Quotes <span className="ml-1 text-[10px] text-muted-foreground">({quotes.length})</span></TabsTrigger>
          <TabsTrigger value="boards" className="gap-1.5"><FolderArchive className="h-3.5 w-3.5" /> Boards <span className="ml-1 text-[10px] text-muted-foreground">({boards.length})</span></TabsTrigger>
          <TabsTrigger value="tearsheets" className="gap-1.5"><ImageIcon className="h-3.5 w-3.5" /> Tearsheets</TabsTrigger>
          <TabsTrigger value="shipping" className="gap-1.5"><Truck className="h-3.5 w-3.5" /> Shipping <span className="ml-1 text-[10px] text-muted-foreground">({timelines.length})</span></TabsTrigger>
          <TabsTrigger value="ffe" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" /> FF&E</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB — keeps the original summary panel */}
        <TabsContent value="overview" className="mt-0">
      {/* Summary panel */}
      <div className="border border-border rounded-md p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground">Project summary</h2>
          {loadingLinks && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Stat icon={FileText} label="Quotes" value={quotes.length} />
          <Stat icon={FolderArchive} label="Boards" value={boards.length} />
          <Stat icon={Package} label="Quote items" value={quoteItemCount} />
          <Stat icon={ListChecks} label="Board items" value={boardItemCount} />
        </div>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mr-1">Quick filter:</span>
          <Link
            to={`/trade/quotes?project=${project.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-muted/40 px-3 py-1 font-body text-xs text-foreground transition-colors"
          >
            <FileText className="h-3 w-3" /> View quotes for this project
          </Link>
          <Link
            to={`/trade/boards?project=${project.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-muted/40 px-3 py-1 font-body text-xs text-foreground transition-colors"
          >
            <FolderArchive className="h-3 w-3" /> View boards for this project
          </Link>
          <Link
            to={`/trade/tearsheets?project=${project.id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background hover:bg-muted/40 px-3 py-1 font-body text-xs text-foreground transition-colors"
          >
            <ImageIcon className="h-3 w-3" /> Tearsheets
          </Link>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="font-body text-[11px] uppercase tracking-[0.15em] text-muted-foreground">By designer / brand</h3>
            </div>
            {selectedDesigner && (
              <button
                onClick={() => setSelectedDesigner(null)}
                className="font-body text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          {designerBreakdown.length === 0 ? (
            <p className="font-body text-xs text-muted-foreground">
              {loadingLinks ? "Loading…" : "No items linked to this project yet."}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {designerBreakdown.map((d) => {
                const active = selectedDesigner === d.name;
                return (
                  <button
                    key={d.name}
                    onClick={() => setSelectedDesigner(active ? null : d.name)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 font-body text-xs transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-background text-foreground hover:bg-muted/40"
                    }`}
                  >
                    <span className="truncate max-w-[160px]">{d.name}</span>
                    <span className={`text-[10px] ${active ? "text-background/70" : "text-muted-foreground"}`}>{d.count}</span>
                  </button>
                );
              })}
            </div>
          )}
          {selectedDesigner && (
            <p className="mt-3 font-body text-[11px] text-muted-foreground">
              <span className="text-foreground">{selectedDesignerLabel}</span> contributes{" "}
              {designerBreakdown.find((d) => d.name === selectedDesigner)?.count || 0} item
              {(designerBreakdown.find((d) => d.name === selectedDesigner)?.count || 0) === 1 ? "" : "s"} across this project's quotes and boards.
            </p>
          )}
        </div>
      </div>

      {/* Overview-tab quick links to other tabs (kept compact, the per-tab content lives below) */}
        </TabsContent>

        {/* QUOTES TAB */}
        <TabsContent value="quotes" className="mt-0">
          {(() => {
            const visibleQuotes = selectedDesigner
              ? quotes.filter((q) => brandQuoteIds[selectedDesigner]?.has(q.id))
              : quotes;
            return (
              <Section
                icon={FileText}
                title="Quotes in this project"
                count={visibleQuotes.length}
                loading={loadingLinks}
                empty={selectedDesigner ? `No quotes contain ${selectedDesignerLabel}.` : "No quotes linked yet."}
                link={`/trade/quotes?project=${project.id}`}
                linkLabel="Open quotes filtered by this project"
              >
                {visibleQuotes.map((q) => (
                  <Row
                    key={q.id}
                    to="/trade/quotes"
                    title={q.client_name || "Untitled quote"}
                    meta={`${q.status} · ${new Date(q.created_at).toLocaleDateString()}`}
                  />
                ))}
              </Section>
            );
          })()}
        </TabsContent>

        {/* BOARDS TAB */}
        <TabsContent value="boards" className="mt-0">
          {(() => {
            const visibleBoards = selectedDesigner
              ? boards.filter((b) => brandBoardIds[selectedDesigner]?.has(b.id))
              : boards;
            return (
              <Section
                icon={FolderArchive}
                title="Mood boards in this project"
                count={visibleBoards.length}
                loading={loadingLinks}
                empty={selectedDesigner ? `No boards contain ${selectedDesignerLabel}.` : "No mood boards linked yet."}
                link={`/trade/boards?project=${project.id}`}
                linkLabel="Open boards filtered by this project"
              >
                {visibleBoards.map((b) => (
                  <Row
                    key={b.id}
                    to={`/trade/boards/${b.id}`}
                    title={b.title}
                    meta={`${b.status} · ${new Date(b.created_at).toLocaleDateString()}`}
                  />
                ))}
              </Section>
            );
          })()}
        </TabsContent>

        {/* TEARSHEETS TAB */}
        <TabsContent value="tearsheets" className="mt-0">
          <Section
            icon={ImageIcon}
            title="Tearsheets & mood boards"
            count={null}
            loading={false}
            empty=""
            link={`/trade/tearsheets?project=${project.id}`}
            linkLabel="Open tearsheet builder for this project"
          >
            <p className="font-body text-xs text-muted-foreground px-3 py-2">
              Tearsheets aggregate from products in this project's quotes and boards. Open the builder to compose and export.
            </p>
            <Link
              to={`/trade/mood-boards?project=${project.id}`}
              className="block px-3 py-2 text-xs font-body text-foreground hover:bg-muted/40"
            >
              Open mood board builder →
            </Link>
          </Section>
        </TabsContent>

        {/* SHIPPING TAB */}
        <TabsContent value="shipping" className="mt-0">
          <Section
            icon={CalendarClock}
            title="Order timelines & shipping"
            count={timelines.length}
            loading={loadingLinks}
            empty="No order timelines linked yet."
            link={`/trade/order-timeline?project=${project.id}`}
            linkLabel="Open timeline board for this project"
          >
            {timelines.map((t) => (
              <Row
                key={t.id}
                to={`/trade/order-timeline?project=${project.id}`}
                title={`Status: ${t.kanban_status.replace(/_/g, " ")}`}
                meta={t.estimated_delivery_at ? `ETA ${new Date(t.estimated_delivery_at).toLocaleDateString()}` : "ETA TBD"}
              />
            ))}
          </Section>
        </TabsContent>

        {/* FF&E TAB */}
        <TabsContent value="ffe" className="mt-0">
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
              FF&E auto-aggregates from this project's confirmed quotes. The export includes PO numbers, lead times, deposit schedule and cost codes.
            </p>
          </Section>
        </TabsContent>
      </Tabs>
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

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-muted/10 p-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="font-display text-xl text-foreground leading-none">{value}</div>
        <div className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}
