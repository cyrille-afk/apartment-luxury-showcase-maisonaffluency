import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_LABELS, type JournalCategory } from "@/lib/journal";
import { useToast } from "@/hooks/use-toast";
import {
  CalendarDays, ChevronDown, ChevronUp, Pencil, Plus, X, Check,
  Lightbulb, FileEdit, Eye, Sparkles, BookOpen, Ban, FileUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

type PipelineStatus = "idea" | "planning" | "drafting" | "review" | "ready" | "published" | "killed";

interface PipelineItem {
  id: string;
  title: string;
  category: JournalCategory;
  target_date: string | null;
  status: PipelineStatus;
  designer_or_brand: string;
  angle: string;
  seo_keywords: string;
  notes: string;
  author: string;
  article_id: string | null;
  created_at: string;
  updated_at: string;
}

const STATUS_CONFIG: Record<PipelineStatus, { label: string; icon: typeof Lightbulb; color: string }> = {
  idea: { label: "Idea", icon: Lightbulb, color: "bg-muted text-muted-foreground" },
  planning: { label: "Planning", icon: CalendarDays, color: "bg-amber-500/10 text-amber-600" },
  drafting: { label: "Drafting", icon: FileEdit, color: "bg-blue-500/10 text-blue-600" },
  review: { label: "Review", icon: Eye, color: "bg-purple-500/10 text-purple-600" },
  ready: { label: "Ready", icon: Sparkles, color: "bg-emerald-500/10 text-emerald-600" },
  published: { label: "Published", icon: BookOpen, color: "bg-primary/10 text-primary" },
  killed: { label: "Killed", icon: Ban, color: "bg-destructive/10 text-destructive" },
};

const STATUS_ORDER: PipelineStatus[] = ["idea", "planning", "drafting", "review", "ready", "published", "killed"];

const emptyItem = (): Partial<PipelineItem> => ({
  title: "",
  category: "design_trend",
  target_date: null,
  status: "idea",
  designer_or_brand: "",
  angle: "",
  seo_keywords: "",
  notes: "",
  author: "Maison Affluency",
});

const EditorialPipeline = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<PipelineItem> | null>(null);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"timeline" | "kanban">("timeline");

  useEffect(() => {
    fetchPipeline();
  }, []);

  const fetchPipeline = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("journal_pipeline")
      .select("*")
      .order("target_date", { ascending: true });
    setItems((data as PipelineItem[]) || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: PipelineStatus) => {
    await supabase
      .from("journal_pipeline")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i));
    toast({ title: `Moved to ${STATUS_CONFIG[status].label}` });
  };

  const startEdit = (item: PipelineItem) => {
    setEditingId(item.id);
    setEditForm({ ...item });
    setAdding(false);
  };

  const startAdd = () => {
    setAdding(true);
    setEditForm(emptyItem());
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
    setAdding(false);
  };

  const saveEdit = async () => {
    if (!editForm || !editForm.title?.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSaving(true);

    if (adding) {
      const { error } = await supabase.from("journal_pipeline").insert({
        title: editForm.title,
        category: editForm.category || "design_trend",
        target_date: editForm.target_date || null,
        status: editForm.status || "idea",
        designer_or_brand: editForm.designer_or_brand || "",
        angle: editForm.angle || "",
        seo_keywords: editForm.seo_keywords || "",
        notes: editForm.notes || "",
        author: editForm.author || "Maison Affluency",
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Article added to pipeline" });
      }
    } else if (editingId) {
      const { error } = await supabase
        .from("journal_pipeline")
        .update({
          title: editForm.title,
          category: editForm.category,
          target_date: editForm.target_date || null,
          status: editForm.status,
          designer_or_brand: editForm.designer_or_brand,
          angle: editForm.angle,
          seo_keywords: editForm.seo_keywords,
          notes: editForm.notes,
          author: editForm.author,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingId);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Updated" });
      }
    }

    setSaving(false);
    cancelEdit();
    fetchPipeline();
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const formatMonth = (d: string | null) =>
    d ? new Date(d + "T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : "Unscheduled";

  // Group by month for timeline view
  const grouped = items.reduce<Record<string, PipelineItem[]>>((acc, item) => {
    const key = formatMonth(item.target_date);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});

  // Stats
  const statusCounts = items.reduce<Record<string, number>>((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  const now = new Date();
  const upcoming = items.filter(i => {
    if (!i.target_date || i.status === "published" || i.status === "killed") return false;
    const d = new Date(i.target_date);
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  const overdue = items.filter(i => {
    if (!i.target_date || i.status === "published" || i.status === "killed") return false;
    return new Date(i.target_date) < now;
  });

  const isEditing = editingId !== null || adding;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => !isEditing && setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h2 className="font-display text-sm text-foreground tracking-wide">Editorial Pipeline</h2>
          <span className="font-body text-[10px] text-muted-foreground">
            {items.length} planned · {statusCounts["published"] || 0} published
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-5 py-4 space-y-4">
          {/* Stats bar */}
          <div className="flex flex-wrap gap-4 pb-4 border-b border-border">
            {overdue.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <span className="font-body text-[11px] text-destructive font-medium">{overdue.length} overdue</span>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-body text-[11px] text-amber-600 font-medium">{upcoming.length} due within 30 days</span>
              </div>
            )}
            {STATUS_ORDER.filter(s => s !== "killed").map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`font-body text-[10px] px-2 py-0.5 rounded-full ${STATUS_CONFIG[s].color}`}>
                  {STATUS_CONFIG[s].label}: {statusCounts[s] || 0}
                </span>
              </div>
            ))}
          </div>

          {/* View toggle + add button */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode("timeline")}
                className={`px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-wider transition-colors ${
                  viewMode === "timeline" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`px-3 py-1 rounded-full font-body text-[10px] uppercase tracking-wider transition-colors ${
                  viewMode === "kanban" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                By Status
              </button>
            </div>
            <button
              onClick={startAdd}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-background font-body text-[10px] uppercase tracking-[0.12em] rounded-full hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3 h-3" /> Add Article
            </button>
          </div>

          {/* Inline editor */}
          {isEditing && editForm && (
            <div className="border border-primary/30 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  value={editForm.title || ""}
                  onChange={e => setEditForm(f => f ? { ...f, title: e.target.value } : null)}
                  placeholder="Article title"
                  className="col-span-full pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors"
                />
                <div className="flex gap-3">
                  <select
                    value={editForm.category || "design_trend"}
                    onChange={e => setEditForm(f => f ? { ...f, category: e.target.value as JournalCategory } : null)}
                    className="flex-1 pb-2 border-b border-border bg-transparent font-body text-xs text-foreground outline-none"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <select
                    value={editForm.status || "idea"}
                    onChange={e => setEditForm(f => f ? { ...f, status: e.target.value as PipelineStatus } : null)}
                    className="flex-1 pb-2 border-b border-border bg-transparent font-body text-xs text-foreground outline-none"
                  >
                    {STATUS_ORDER.map(s => (
                      <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                    ))}
                  </select>
                </div>
                <input
                  type="date"
                  value={editForm.target_date || ""}
                  onChange={e => setEditForm(f => f ? { ...f, target_date: e.target.value } : null)}
                  className="pb-2 border-b border-border bg-transparent font-body text-xs text-foreground outline-none"
                />
                <input
                  value={editForm.designer_or_brand || ""}
                  onChange={e => setEditForm(f => f ? { ...f, designer_or_brand: e.target.value } : null)}
                  placeholder="Designer / Brand"
                  className="pb-2 border-b border-border bg-transparent font-body text-xs text-foreground outline-none"
                />
                <input
                  value={editForm.angle || ""}
                  onChange={e => setEditForm(f => f ? { ...f, angle: e.target.value } : null)}
                  placeholder="Angle / Hook"
                  className="col-span-full pb-2 border-b border-border bg-transparent font-body text-xs text-foreground outline-none"
                />
                <input
                  value={editForm.notes || ""}
                  onChange={e => setEditForm(f => f ? { ...f, notes: e.target.value } : null)}
                  placeholder="Notes"
                  className="col-span-full pb-2 border-b border-border bg-transparent font-body text-xs text-muted-foreground outline-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={cancelEdit}
                  className="px-4 py-1.5 font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-foreground text-background font-body text-[10px] uppercase tracking-wider rounded-full hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="w-3 h-3" />
                  {saving ? "Saving..." : adding ? "Add" : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-12 bg-muted rounded-md" />
              ))}
            </div>
          ) : viewMode === "timeline" ? (
            /* Timeline view */
            <div className="space-y-6">
              {Object.entries(grouped).map(([month, monthItems]) => (
                <div key={month}>
                  <h3 className="font-body text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2 sticky top-0 bg-background py-1">
                    {month}
                  </h3>
                  <div className="space-y-1.5">
                    {monthItems.map(item => {
                      const isOverdue = item.target_date && new Date(item.target_date) < now && item.status !== "published" && item.status !== "killed";
                      const StatusIcon = STATUS_CONFIG[item.status].icon;
                      return (
                        <div
                          key={item.id}
                          className={`group flex items-center gap-3 px-3 py-2.5 rounded-md border transition-colors hover:bg-muted/30 ${
                            isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border"
                          }`}
                        >
                          {/* Status badge */}
                          <select
                            value={item.status}
                            onChange={e => updateStatus(item.id, e.target.value as PipelineStatus)}
                            className={`shrink-0 px-2 py-0.5 rounded-full font-body text-[10px] uppercase tracking-wider border-none outline-none cursor-pointer ${STATUS_CONFIG[item.status].color}`}
                          >
                            {STATUS_ORDER.map(s => (
                              <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                            ))}
                          </select>

                          {/* Date */}
                          <span className={`shrink-0 font-body text-[10px] w-16 ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                            {item.target_date ? formatDate(item.target_date) : "—"}
                          </span>

                          {/* Category chip */}
                          <span className="shrink-0 font-body text-[9px] uppercase tracking-[0.12em] text-primary bg-primary/5 px-1.5 py-0.5 rounded hidden md:inline">
                            {CATEGORY_LABELS[item.category]}
                          </span>

                          {/* Title + angle */}
                          <div className="flex-1 min-w-0">
                            <p className="font-body text-xs text-foreground truncate">{item.title}</p>
                            {item.angle && (
                              <p className="font-body text-[10px] text-muted-foreground truncate">{item.angle}</p>
                            )}
                          </div>

                          {/* Brand */}
                          {item.designer_or_brand && (
                            <span className="hidden lg:inline font-body text-[10px] text-muted-foreground shrink-0 max-w-[120px] truncate">
                              {item.designer_or_brand}
                            </span>
                          )}

                          {/* Edit button */}
                          <button
                            onClick={() => startEdit(item)}
                            className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-muted transition-all"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Kanban-style view */
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {STATUS_ORDER.filter(s => s !== "killed" || (statusCounts["killed"] || 0) > 0).map(status => {
                const StatusIcon = STATUS_CONFIG[status].icon;
                const statusItems = items.filter(i => i.status === status);
                return (
                  <div key={status} className="space-y-2">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${STATUS_CONFIG[status].color}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span className="font-body text-[10px] uppercase tracking-wider font-medium">
                        {STATUS_CONFIG[status].label} ({statusItems.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {statusItems.map(item => (
                        <div
                          key={item.id}
                          className="group p-2.5 rounded-md border border-border hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => startEdit(item)}
                        >
                          <p className="font-body text-[11px] text-foreground leading-snug line-clamp-2">{item.title}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="font-body text-[9px] text-primary uppercase tracking-wider">
                              {CATEGORY_LABELS[item.category]}
                            </span>
                            {item.target_date && (
                              <span className="font-body text-[9px] text-muted-foreground">
                                {formatDate(item.target_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                      {statusItems.length === 0 && (
                        <p className="font-body text-[10px] text-muted-foreground/50 text-center py-4">None</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EditorialPipeline;
