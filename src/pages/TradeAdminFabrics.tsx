import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Save, X, Link2, ExternalLink, Settings2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import CloudUpload from "@/components/trade/CloudUpload";
import { slugify } from "@/lib/whatsapp-share";

type FabricCategory = "Fabric & Leather" | "Wood" | "Stone" | "Metal" | "Glass" | "Other";

const CATEGORIES: FabricCategory[] = [
  "Fabric & Leather",
  "Wood",
  "Stone",
  "Metal",
  "Glass",
  "Other",
];

const normalizeAdminFabricCategory = (category: string | null | undefined): FabricCategory => {
  const raw = (category || "").trim().toLowerCase();
  if (["fabric", "fabrics", "upholstery", "leather", "fabric & leather", "fabric/leather"].includes(raw)) return "Fabric & Leather";
  if (["wood", "woods", "timber", "rattan", "cane", "wicker"].includes(raw)) return "Wood";
  if (raw === "stone") return "Stone";
  if (raw === "metal") return "Metal";
  if (raw === "glass") return "Glass";
  return "Other";
};


interface Fabric {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  supplier: string | null;
  sort_order: number;
  is_active: boolean;
  tier: "A" | "B" | "C" | "D" | "E" | null;
  price_per_lm_cents: number | null;
  currency: string | null;
}

const TIERS: Array<"A" | "B" | "C" | "D" | "E"> = ["A", "B", "C", "D", "E"];

/** Format cents → "€150/lm" */
const fmtLm = (cents: number | null | undefined, currency: string | null | undefined) => {
  if (!cents) return null;
  const sym = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  return `${sym}${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}/lm`;
};

interface Pick {
  id: string;
  title: string | null;
  subtitle: string | null;
  designer_id: string | null;
  size_variants?: { label?: string; base?: string; top?: string; price_cents?: number }[] | null;
}

interface DesignerLite {
  id: string;
  slug: string | null;
  name: string | null;
  display_name: string | null;
}



interface ProductFabric {
  id: string;
  pick_id: string | null;
  product_label: string | null;
  fabric_id: string;
  sort_order: number;
  price_tier_label: string | null;
  image_indices: number[] | null;
}

/**
 * Parse a user-typed image range like "1-4, 6, 8-9" into a sorted, unique
 * array of 1-based image indices. Returns null when the input is empty or
 * has no valid indices (treated as "no mapping").
 */
const parseImageRange = (raw: string): number[] | null => {
  if (!raw || !raw.trim()) return null;
  const out = new Set<number>();
  raw.split(/[,;]/).forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const m = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = parseInt(m[1], 10);
      const b = parseInt(m[2], 10);
      const [lo, hi] = a <= b ? [a, b] : [b, a];
      for (let i = lo; i <= hi; i++) if (i > 0) out.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = parseInt(p, 10);
      if (n > 0) out.add(n);
    }
  });
  const arr = Array.from(out).sort((a, b) => a - b);
  return arr.length > 0 ? arr : null;
};

/** Serialize an int[] back into a compact "1-4, 6" string for display. */
const formatImageRange = (arr: number[] | null | undefined): string => {
  if (!arr || arr.length === 0) return "";
  const sorted = [...arr].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const n = sorted[i];
    if (n === prev + 1) { prev = n; continue; }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    start = n;
    prev = n;
  }
  return parts.join(", ");
};

const blankDraft = (): Partial<Fabric> => ({
  name: "",
  category: "Fabric & Leather",
  supplier: "",
  description: "",
  image_url: "",
  sort_order: 0,
  is_active: true,
  tier: null,
  price_per_lm_cents: null,
  currency: "EUR",
});

export default function TradeAdminFabrics() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [designerFilter, setDesignerFilter] = useState<string>("");
  const [productFilter, setProductFilter] = useState<"all" | "picks" | "labels">("all");

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
        .select("id, title, subtitle, designer_id, size_variants")
        .order("title");
      if (error) throw error;
      return (data as Pick[]) || [];
    },
    enabled: isAdmin,
  });

  const { data: designersList = [] } = useQuery({
    queryKey: ["admin-fabrics-designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, display_name");
      if (error) throw error;
      return (data as DesignerLite[]) || [];
    },
    enabled: isAdmin,
  });


  const designerSlugById = useMemo(() => {
    const m = new Map<string, string | null>();
    designersList.forEach((d) => m.set(d.id, d.slug));
    return m;
  }, [designersList]);

  const designerNameById = useMemo(() => {
    const m = new Map<string, string | null>();
    designersList.forEach((d) => m.set(d.id, d.display_name || d.name || null));
    return m;
  }, [designersList]);



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

  const linkedPicksByFabric = useMemo(() => {
    const m = new Map<string, Pick[]>();
    links.forEach((l) => {
      if (!l.pick_id) return;
      const pick = picks.find((p) => p.id === l.pick_id);
      if (!pick) return;
      const arr = m.get(l.fabric_id) || [];
      arr.push(pick);
      m.set(l.fabric_id, arr);
    });
    return m;
  }, [links, picks]);

  /** Free-text (non-catalog) product links grouped by fabric. */
  const linkedLabelsByFabric = useMemo(() => {
    const m = new Map<string, ProductFabric[]>();
    links.forEach((l) => {
      if (l.pick_id || !l.product_label) return;
      const arr = m.get(l.fabric_id) || [];
      arr.push(l);
      m.set(l.fabric_id, arr);
    });
    return m;
  }, [links]);

  const linkedPickIds = useMemo(() => {
    if (!linkingId) return new Set<string>();
    return new Set(links.filter((l) => l.fabric_id === linkingId).map((l) => l.pick_id));
  }, [links, linkingId]);

  const linkByPickId = useMemo(() => {
    const m = new Map<string, ProductFabric>();
    if (!linkingId) return m;
    links.filter((l) => l.fabric_id === linkingId).forEach((l) => m.set(l.pick_id, l));
    return m;
  }, [links, linkingId]);

  const topOptionsByPickId = useMemo(() => {
    const m = new Map<string, string[]>();
    picks.forEach((p) => {
      const tops = new Set<string>();
      (p.size_variants || []).forEach((v) => {
        const t = (v.top || v.label || "").trim();
        if (t) tops.add(t);
      });
      m.set(p.id, Array.from(tops));
    });
    return m;
  }, [picks]);

  const filtered = useMemo(() => {
    let rows = fabrics;
    if (categoryFilter) rows = rows.filter((r) => normalizeAdminFabricCategory(r.category) === categoryFilter);
    if (designerFilter) {
      rows = rows.filter((r) => {
        const linked = linkedPicksByFabric.get(r.id) || [];
        return linked.some((p) => p.designer_id === designerFilter);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => {
        if (r.name.toLowerCase().includes(q)) return true;
        if ((r.supplier || "").toLowerCase().includes(q)) return true;
        if ((r.description || "").toLowerCase().includes(q)) return true;
        const linked = linkedPicksByFabric.get(r.id) || [];
        return linked.some((p) => {
          if ((p.title || "").toLowerCase().includes(q)) return true;
          if ((p.subtitle || "").toLowerCase().includes(q)) return true;
          const dName = designerNameById.get(p.designer_id || "") || "";
          if (dName.toLowerCase().includes(q)) return true;
          return false;
        });
      });
    }
    return rows;
  }, [fabrics, search, categoryFilter, designerFilter, linkedPicksByFabric, designerNameById]);


  const grouped = useMemo(() => {
    const g: Record<string, Fabric[]> = {};
    filtered.forEach((f) => {
      const k = normalizeAdminFabricCategory(f.category);
      (g[k] = g[k] || []).push(f);
    });
    // Within each category, sort by supplier (A→Z), then by name (A→Z).
    const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
    Object.keys(g).forEach((k) => {
      g[k].sort((a, b) => {
        const sa = (a.supplier || "").trim();
        const sb = (b.supplier || "").trim();
        if (sa && !sb) return -1;
        if (!sa && sb) return 1;
        const s = collator.compare(sa, sb);
        if (s !== 0) return s;
        return collator.compare(a.name || "", b.name || "");
      });
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
      tier: editDraft.tier || null,
      price_per_lm_cents: editDraft.price_per_lm_cents ?? null,
      currency: editDraft.currency || "EUR",
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
      tier: newRow.tier || null,
      price_per_lm_cents: newRow.price_per_lm_cents ?? null,
      currency: newRow.currency || "EUR",
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

  const setPickLinkLabel = async (linkId: string, label: string) => {
    const { error } = await supabase
      .from("product_fabrics")
      .update({ price_tier_label: label.trim() || null })
      .eq("id", linkId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-fabrics-links"] });
  };

  const setPickLinkImageRange = async (linkId: string, raw: string) => {
    const indices = parseImageRange(raw);
    const { error } = await supabase
      .from("product_fabrics")
      .update({ image_indices: indices })
      .eq("id", linkId);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
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
            <select
              value={designerFilter}
              onChange={(e) => setDesignerFilter(e.target.value)}
              className="px-3 py-1.5 text-sm font-body rounded-md border border-border bg-background"
            >
              <option value="">All designers</option>
              {designersList
                .filter((d) => d.name || d.display_name)
                .sort((a, b) => ((a.display_name || a.name || "").localeCompare(b.display_name || b.name || "", "en", { sensitivity: "base" })))
                .map((d) => (
                  <option key={d.id} value={d.id}>{d.display_name || d.name}</option>
                ))}
            </select>
            <div className="flex items-center rounded-md border border-border bg-background overflow-hidden">

              {(["all", "picks", "labels"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setProductFilter(key)}
                  className={`px-2.5 py-1.5 text-[11px] font-body capitalize transition-colors ${
                    productFilter === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={key === "all" ? "Show all linked products" : key === "picks" ? "Only catalog picks" : "Only free-text labels"}
                >
                  {key === "all" ? "All" : key === "picks" ? "Picks" : "Labels"}
                </button>
              ))}
            </div>
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
                value={newRow.category || "Fabric & Leather"}
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
          <div className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-lg space-y-3">
            <p>{fabrics.length === 0 ? "No fabrics yet. Add your first swatch above." : "No fabrics match your filters."}</p>
            {(search || categoryFilter || designerFilter || productFilter !== "all") && (
              <button
                onClick={() => { setSearch(""); setCategoryFilter(""); setDesignerFilter(""); setProductFilter("all"); }}
                className="px-3 py-1.5 text-xs rounded border border-border hover:bg-muted"
              >
                Clear filters
              </button>
            )}
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
                                <div className="flex items-center gap-1.5 pt-1">
                                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Tier</label>
                                  <select
                                    className="px-1.5 py-1 text-xs rounded border border-border bg-background"
                                    value={editDraft.tier || ""}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, tier: (e.target.value || null) as Fabric["tier"] }))}
                                  >
                                    <option value="">—</option>
                                    {TIERS.map((t) => <option key={t} value={t}>CAT {t}</option>)}
                                  </select>
                                  <select
                                    className="px-1.5 py-1 text-xs rounded border border-border bg-background"
                                    value={editDraft.currency || "EUR"}
                                    onChange={(e) => setEditDraft((d) => ({ ...d, currency: e.target.value }))}
                                  >
                                    <option value="EUR">€</option>
                                    <option value="USD">$</option>
                                    <option value="GBP">£</option>
                                  </select>
                                  <input
                                    type="number"
                                    placeholder="/lm"
                                    className="w-20 px-1.5 py-1 text-xs rounded border border-border bg-background"
                                    value={editDraft.price_per_lm_cents != null ? editDraft.price_per_lm_cents / 100 : ""}
                                    onChange={(e) => setEditDraft((d) => ({
                                      ...d,
                                      price_per_lm_cents: e.target.value ? Math.round(Number(e.target.value) * 100) : null,
                                    }))}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-display text-sm text-foreground">{f.name}</div>
                                {(f.tier || f.price_per_lm_cents) && (
                                  <div className="text-[10px] uppercase tracking-wider text-primary/80 mt-0.5">
                                    {f.tier ? `CAT ${f.tier}` : ""}{f.tier && f.price_per_lm_cents ? " · " : ""}{fmtLm(f.price_per_lm_cents, f.currency) || ""}
                                  </div>
                                )}
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
                            {(() => {
                              const linked = linkedPicksByFabric.get(f.id) || [];
                              const labelLinks = linkedLabelsByFabric.get(f.id) || [];
                              const showPicks = productFilter !== "labels";
                              const showLabels = productFilter !== "picks";
                              const visiblePicks = showPicks ? linked : [];
                              const visibleLabels = showLabels ? labelLinks : [];
                              const hasAny = visiblePicks.length + visibleLabels.length > 0;
                              return (
                                <div className="flex flex-col gap-1">
                                  <div className="flex flex-wrap gap-1">
                                    {visiblePicks.slice(0, 2).map((p) => {
                                      const dSlug = p.designer_id ? designerSlugById.get(p.designer_id) : null;
                                      const productSlug = slugify(`${p.title || ""}${p.subtitle ? `-${p.subtitle}` : ""}`);
                                      const to = dSlug && p.title
                                        ? `/trade/products/${dSlug}/${productSlug}`
                                        : `/trade/products/${p.id}`;
                                      return (
                                        <span
                                          key={p.id}
                                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground"
                                          title={p.subtitle ? `${p.subtitle} — ${p.title}` : p.title || ""}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => { setLinkingId(f.id); setPickSearch(""); }}
                                            className="inline-flex items-center gap-1 hover:underline"
                                            title="Edit price tier & image range"
                                          >
                                            <Settings2 className="h-2.5 w-2.5 text-primary" />
                                            <span className="truncate max-w-[120px]">{p.title || "(untitled)"}</span>
                                          </button>
                                          <Link to={to} className="ml-1 opacity-60 hover:opacity-100" title="Open product page" target="_blank" rel="noreferrer">
                                            <ExternalLink className="h-2.5 w-2.5" />
                                          </Link>
                                        </span>
                                      );
                                    })}

                                    {visiblePicks.length > 2 && (
                                      <button
                                        onClick={() => { setLinkingId(f.id); setPickSearch(""); }}
                                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground hover:bg-muted"
                                      >
                                        +{visiblePicks.length - 2} more
                                      </button>
                                    )}

                                    {visibleLabels.slice(0, 3).map((l) => (
                                      <span
                                        key={l.id}
                                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-dashed border-amber-500/50 bg-amber-500/5 text-amber-900 dark:text-amber-200 italic"
                                        title={`Non-catalog (free-text): ${l.product_label}`}
                                      >
                                        <span className="truncate max-w-[140px]">{l.product_label}</span>
                                      </span>
                                    ))}
                                    {visibleLabels.length > 3 && (
                                      <span
                                        className="text-[10px] px-1.5 py-0.5 rounded border border-dashed border-amber-500/40 text-amber-700 dark:text-amber-300 italic"
                                        title={visibleLabels.slice(3).map((l) => l.product_label).join("\n")}
                                      >
                                        +{visibleLabels.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                  {!hasAny ? (
                                    <button
                                      onClick={() => { setLinkingId(f.id); setPickSearch(""); }}
                                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline self-start"
                                    >
                                      <Link2 className="h-3 w-3" /> Link
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => { setLinkingId(f.id); setPickSearch(""); }}
                                      className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline self-start mt-0.5"
                                      title="Manage linked products, price tier, and image range"
                                    >
                                      <Settings2 className="h-2.5 w-2.5" /> Manage links & image ranges
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
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
                    const link = linkByPickId.get(p.id);
                    const tops = topOptionsByPickId.get(p.id) || [];
                    const datalistId = `tops-${p.id}`;
                    return (
                      <li key={p.id} className="px-4 py-2.5 hover:bg-muted/30">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-foreground truncate">{p.title || "(untitled)"}</div>
                            {p.subtitle && <div className="text-xs text-muted-foreground truncate">{p.subtitle}</div>}
                          </div>
                          <button
                            onClick={() => togglePickLink(linkingId, p.id, linked)}
                            className={`shrink-0 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded border ${
                              linked
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {linked ? "Linked" : "Link"}
                          </button>
                        </div>
                        {linked && link && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                              Price tier
                            </label>
                            <input
                              type="text"
                              list={tops.length ? datalistId : undefined}
                              defaultValue={link.price_tier_label || ""}
                              placeholder={tops[0] || "e.g. ECART fabric, Leather, Shearling"}
                              onBlur={(e) => {
                                const next = e.target.value.trim();
                                if (next !== (link.price_tier_label || "")) {
                                  setPickLinkLabel(link.id, next);
                                }
                              }}
                              className="flex-1 px-2 py-1 text-xs rounded border border-border bg-background"
                            />
                            {tops.length > 0 && (
                              <datalist id={datalistId}>
                                {tops.map((t) => <option key={t} value={t} />)}
                              </datalist>
                            )}
                          </div>
                        )}
                        {linked && link && (
                          <div className="mt-2 flex items-center gap-2">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                              Image range
                            </label>
                            <input
                              type="text"
                              defaultValue={formatImageRange(link.image_indices)}
                              placeholder="e.g. 1-4 or 1,2,5"
                              onBlur={(e) => {
                                const next = e.target.value.trim();
                                const prev = formatImageRange(link.image_indices);
                                if (next !== prev) setPickLinkImageRange(link.id, next);
                              }}
                              className="flex-1 px-2 py-1 text-xs rounded border border-border bg-background"
                              title="1-based gallery image indices that depict this swatch on the product. Leave empty to skip."
                            />
                          </div>
                        )}
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
