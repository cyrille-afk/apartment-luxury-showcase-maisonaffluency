import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Save, X, Link2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import CloudUpload from "@/components/trade/CloudUpload";

type FabricCategory = "Fabric & Leather" | "Wood" | "Fabrics" | "Stone" | "Metal" | "Other";

const CATEGORIES: FabricCategory[] = [
  "Fabric & Leather",
  "Wood",
  "Fabrics",
  "Stone",
  "Metal",
  "Other",
];


interface Fabric {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  supplier: string | null;
  sort_order: number;
  is_active: boolean;
}

interface Pick {
  id: string;
  title: string | null;
  subtitle: string | null;
}

interface ProductFabric {
  id: string;
  pick_id: string;
  fabric_id: string;
  sort_order: number;
}

const blankDraft = (): Partial<Fabric> => ({
  name: "",
  category: "Upholstery",
  supplier: "",
  description: "",
  image_url: "",
  sort_order: 0,
  is_active: true,
});

export default function TradeAdminFabrics() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Fabric>>({});
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<Partial<Fabric>>(blankDraft());
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [pickSearch, setPickSearch] = useState("");

  const { data: fabrics = [], isLoading } = useQuery({
    queryKey: ["admin-fabrics"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fabrics")
        .select("*")
        .order("category")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return (data as Fabric[]) || [];
    },
    enabled: isAdmin,
  });

  const { data: picks = [] } = useQuery({
    queryKey: ["admin-fabrics-picks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("id, title, subtitle")
        .order("title");
      if (error) throw error;
      return (data as Pick[]) || [];
    },
    enabled: isAdmin,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["admin-fabrics-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_fabrics")
        .select("*");
      if (error) throw error;
      return (data as ProductFabric[]) || [];
    },
    enabled: isAdmin,
  });

  const linkCountByFabric = useMemo(() => {
    const m = new Map<string, number>();
    links.forEach((l) => m.set(l.fabric_id, (m.get(l.fabric_id) || 0) + 1));
    return m;
  }, [links]);

  const linkedPickIds = useMemo(() => {
    if (!linkingId) return new Set<string>();
    return new Set(links.filter((l) => l.fabric_id === linkingId).map((l) => l.pick_id));
  }, [links, linkingId]);

  const filtered = useMemo(() => {
    let rows = fabrics;
    if (categoryFilter) rows = rows.filter((r) => (r.category || "") === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.supplier || "").toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q),
      );
    }
    return rows;
  }, [fabrics, search, categoryFilter]);

  const grouped = useMemo(() => {
    const g: Record<string, Fabric[]> = {};
    filtered.forEach((f) => {
      const k = f.category || "Other";
      (g[k] = g[k] || []).push(f);
    });
    return g;
  }, [filtered]);

  const filteredPicks = useMemo(() => {
    if (!pickSearch.trim()) return picks.slice(0, 50);
    const q = pickSearch.toLowerCase();
    return picks
      .filter(
        (p) =>
          (p.title || "").toLowerCase().includes(q) ||
          (p.subtitle || "").toLowerCase().includes(q),
      )
      .slice(0, 50);
  }, [picks, pickSearch]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const startEdit = (f: Fabric) => {
    setEditingId(f.id);
    setEditDraft({ ...f });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const patch = {
      name: editDraft.name?.trim() || "",
      category: editDraft.category || null,
      supplier: editDraft.supplier?.trim() || null,
      description: editDraft.description?.trim() || null,
      image_url: editDraft.image_url?.trim() || null,
      sort_order: editDraft.sort_order ?? 0,
      is_active: editDraft.is_active ?? true,
    };
    if (!patch.name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("fabrics").update(patch).eq("id", editingId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Updated ${patch.name}` });
    cancelEdit();
    qc.invalidateQueries({ queryKey: ["admin-fabrics"] });
  };

  const remove = async (f: Fabric) => {
    if (!confirm(`Delete ${f.name}? This also removes all product links.`)) return;
    const { error } = await supabase.from("fabrics").delete().eq("id", f.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Removed ${f.name}` });
    qc.invalidateQueries({ queryKey: ["admin-fabrics"] });
    qc.invalidateQueries({ queryKey: ["admin-fabrics-links"] });
  };

  const addNew = async () => {
    const name = newRow.name?.trim();
    if (!name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("fabrics").insert({
      name,
      category: newRow.category || null,
      supplier: newRow.supplier?.trim() || null,
      description: newRow.description?.trim() || null,
      image_url: newRow.image_url?.trim() || null,
      sort_order: newRow.sort_order ?? 0,
      is_active: newRow.is_active ?? true,
    });
    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Added ${name}` });
    setAdding(false);
    setNewRow(blankDraft());
    qc.invalidateQueries({ queryKey: ["admin-fabrics"] });
  };

  const togglePickLink = async (fabricId: string, pickId: string, currentlyLinked: boolean) => {
    if (currentlyLinked) {
      const { error } = await supabase
        .from("product_fabrics")
        .delete()
        .eq("fabric_id", fabricId)
        .eq("pick_id", pickId);
      if (error) {
        toast({ title: "Unlink failed", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { error } = await supabase
        .from("product_fabrics")
        .insert({ fabric_id: fabricId, pick_id: pickId, sort_order: 0 });
      if (error) {
        toast({ title: "Link failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    qc.invalidateQueries({ queryKey: ["admin-fabrics-links"] });
  };

  return (
    <>
      <Helmet>
        <title>Fabrics & Finishes — Admin — Maison Affluency</title>
      </Helmet>
      <div className="max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="font-display text-2xl text-foreground">Fabrics & Finishes</h1>
              <p className="font-body text-sm text-muted-foreground mt-0.5">
                Manage upholstery fabrics, wood finishes, leather, stone and metal swatches. Link each swatch to the products that offer it.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, supplier…"
              className="px-3 py-1.5 text-sm font-body rounded-md border border-border bg-background w-56"
            />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-sm font-body rounded-md border border-border bg-background"
            >
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] uppercase tracking-wider font-body rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            >
              <Plus className="h-3 w-3" /> Add fabric
            </button>
          </div>
        </div>

        {adding && (
          <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-12 gap-2">
              <input
                className="col-span-4 px-2 py-1.5 text-sm rounded border border-border bg-background"
                placeholder="Name (e.g. Cole Cinnamon)"
                value={newRow.name || ""}
                onChange={(e) => setNewRow((n) => ({ ...n, name: e.target.value }))}
              />
              <select
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-border bg-background"
                value={newRow.category || "Upholstery"}
                onChange={(e) => setNewRow((n) => ({ ...n, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <input
                className="col-span-3 px-2 py-1.5 text-sm rounded border border-border bg-background"
                placeholder="Supplier (e.g. Pierre Frey)"
                value={newRow.supplier || ""}
                onChange={(e) => setNewRow((n) => ({ ...n, supplier: e.target.value }))}
              />
              <input
                type="number"
                className="col-span-1 px-2 py-1.5 text-sm rounded border border-border bg-background"
                placeholder="Sort"
                value={newRow.sort_order ?? 0}
                onChange={(e) => setNewRow((n) => ({ ...n, sort_order: Number(e.target.value) }))}
              />
              <label className="col-span-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={newRow.is_active ?? true}
                  onChange={(e) => setNewRow((n) => ({ ...n, is_active: e.target.checked }))}
                />
                Active
              </label>
              <textarea
                className="col-span-12 px-2 py-1.5 text-sm rounded border border-border bg-background"
                placeholder="Description (optional)"
                rows={2}
                value={newRow.description || ""}
                onChange={(e) => setNewRow((n) => ({ ...n, description: e.target.value }))}
              />
              <div className="col-span-8 flex items-center gap-3">
                <input
                  className="flex-1 px-2 py-1.5 text-sm rounded border border-border bg-background"
                  placeholder="Image URL (or upload →)"
                  value={newRow.image_url || ""}
                  onChange={(e) => setNewRow((n) => ({ ...n, image_url: e.target.value }))}
                />
                <CloudUpload
                  folder="fabrics"
                  accept="image/*"
                  label="Upload swatch"
                  onUpload={(urls) => setNewRow((n) => ({ ...n, image_url: urls[0] }))}
                />
                {newRow.image_url && (
                  <img src={newRow.image_url} alt="" className="h-10 w-10 rounded border border-border object-cover" />
                )}
              </div>
              <div className="col-span-4 flex items-center justify-end gap-2">
                <button onClick={() => { setAdding(false); setNewRow(blankDraft()); }} className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted">
                  Cancel
                </button>
                <button onClick={addNew} className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90">
                  Save fabric
                </button>
              </div>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-lg">
            {fabrics.length === 0 ? "No fabrics yet. Add your first swatch above." : "No fabrics match your filters."}
          </div>
        ) : (
          CATEGORIES.filter((c) => grouped[c]?.length).map((cat) => (
            <section key={cat} className="space-y-2">
              <h2 className="font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                {cat} <span className="text-foreground/40">· {grouped[cat].length}</span>
              </h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-14">Swatch</th>
                      <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5">Name</th>
                      <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-40">Supplier</th>
                      <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-20">Sort</th>
                      <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-20">Active</th>
                      <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-24">Products</th>
                      <th className="px-3 py-2.5 w-32" />
                    </tr>
                  </thead>
                  <tbody>
                    {grouped[cat].map((f) => {
                      const isEditing = editingId === f.id;
                      const count = linkCountByFabric.get(f.id) || 0;
                      return (
                        <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/20 align-top">
                          <td className="px-3 py-2">
                            {(isEditing ? editDraft.image_url : f.image_url) ? (
                              <img src={(isEditing ? editDraft.image_url : f.image_url) as string} alt="" className="h-10 w-10 rounded border border-border object-cover" />
                            ) : (
                              <div className="h-10 w-10 rounded border border-dashed border-border bg-muted/30" />
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <div className="space-y-1.5">
                                <input
                                  className="w-full px-1.5 py-1 text-xs rounded border border-border bg-background"
                                  value={editDraft.name || ""}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                                />
                                <textarea
                                  className="w-full px-1.5 py-1 text-xs rounded border border-border bg-background"
                                  rows={2}
                                  placeholder="Description"
                                  value={editDraft.description || ""}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))}
                                />
                                <div className="flex items-center gap-2">
                                  <input
                                    className="flex-1 px-1.5 py-1 text-xs rounded border border-border bg-background"
                                    placeholder="Image URL"
                                    value={editDraft.image_url || ""}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, image_url: e.target.value }))}
                                  />
                                  <CloudUpload
                                    folder="fabrics"
                                    accept="image/*"
                                    label="Upload"
                                    onUpload={(urls) => setEditDraft((d) => ({ ...d, image_url: urls[0] }))}
                                  />
                                </div>
                                <select
                                  className="px-1.5 py-1 text-xs rounded border border-border bg-background"
                                  value={editDraft.category || ""}
                                  onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                                >
                                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                            ) : (
                              <div>
                                <div className="font-display text-sm text-foreground">{f.name}</div>
                                {f.description && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{f.description}</div>}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <input
                                className="w-full px-1.5 py-1 text-xs rounded border border-border bg-background"
                                value={editDraft.supplier || ""}
                                onChange={(e) => setEditDraft((d) => ({ ...d, supplier: e.target.value }))}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{f.supplier || "—"}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <input
                                type="number"
                                className="w-14 px-1.5 py-1 text-xs rounded border border-border bg-background"
                                value={editDraft.sort_order ?? 0}
                                onChange={(e) => setEditDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">{f.sort_order}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {isEditing ? (
                              <input
                                type="checkbox"
                                checked={editDraft.is_active ?? true}
                                onChange={(e) => setEditDraft((d) => ({ ...d, is_active: e.target.checked }))}
                              />
                            ) : (
                              <span className={`text-[10px] uppercase tracking-wider ${f.is_active ? "text-emerald-700" : "text-muted-foreground"}`}>
                                {f.is_active ? "Yes" : "No"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => { setLinkingId(f.id); setPickSearch(""); }}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                              title="Link to products"
                            >
                              <Link2 className="h-3 w-3" /> {count}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <button onClick={saveEdit} className="p-1 rounded text-primary hover:bg-primary/10" title="Save">
                                    <Save className="h-3.5 w-3.5" />
                                  </button>
                                  <button onClick={cancelEdit} className="p-1 rounded text-muted-foreground hover:bg-muted" title="Cancel">
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              ) : (
                                <button onClick={() => startEdit(f)} className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border hover:bg-muted">
                                  Edit
                                </button>
                              )}
                              <button onClick={() => remove(f)} className="p-1 rounded text-destructive hover:bg-destructive/10" title="Delete">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>

      {linkingId && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setLinkingId(null)}>
          <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg">Link products</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {fabrics.find((f) => f.id === linkingId)?.name} — {linkedPickIds.size} linked
                </p>
              </div>
              <button onClick={() => setLinkingId(null)} className="p-1.5 rounded hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 border-b border-border">
              <input
                type="text"
                value={pickSearch}
                onChange={(e) => setPickSearch(e.target.value)}
                placeholder="Search product title or brand…"
                className="w-full px-3 py-2 text-sm rounded-md border border-border bg-background"
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-auto">
              {filteredPicks.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">No products match.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredPicks.map((p) => {
                    const linked = linkedPickIds.has(p.id);
                    return (
                      <li key={p.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/30">
                        <div className="min-w-0">
                          <div className="text-sm text-foreground truncate">{p.title || "(untitled)"}</div>
                          {p.subtitle && <div className="text-xs text-muted-foreground truncate">{p.subtitle}</div>}
                        </div>
                        <button
                          onClick={() => togglePickLink(linkingId, p.id, linked)}
                          className={`shrink-0 ml-3 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border ${
                            linked
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {linked ? "Linked" : "Link"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
