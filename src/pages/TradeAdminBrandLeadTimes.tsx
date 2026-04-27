import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

type StockStatus = "in_stock" | "low_stock" | "made_to_order" | "discontinued";

interface BrandLeadTime {
  id: string;
  brand_name: string;
  default_lead_weeks_min: number | null;
  default_lead_weeks_max: number | null;
  default_stock_status: StockStatus;
  notes: string | null;
}

const STATUS_OPTIONS: { value: StockStatus; label: string }[] = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "made_to_order", label: "Made to order" },
  { value: "discontinued", label: "Discontinued" },
];

export default function TradeAdminBrandLeadTimes() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, Partial<BrandLeadTime>>>({});
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState<Partial<BrandLeadTime>>({
    brand_name: "",
    default_lead_weeks_min: 4,
    default_lead_weeks_max: 8,
    default_stock_status: "made_to_order",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-brand-lead-times"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_lead_times")
        .select("*")
        .order("brand_name");
      if (error) throw error;
      return (data as BrandLeadTime[]) || [];
    },
    enabled: isAdmin,
  });

  // Pull distinct brand names from trade_products to suggest unset brands
  const { data: allBrands = [] } = useQuery({
    queryKey: ["admin-distinct-brands"],
    queryFn: async () => {
      const { data } = await supabase.from("trade_products").select("brand_name").not("brand_name", "is", null);
      const set = new Set<string>();
      (data || []).forEach((r: any) => r.brand_name && set.add(r.brand_name));
      return Array.from(set).sort();
    },
    enabled: isAdmin,
  });

  const unsetBrands = useMemo(() => {
    const known = new Set(rows.map((r) => r.brand_name.toLowerCase()));
    return allBrands.filter((b) => !known.has(b.toLowerCase()));
  }, [rows, allBrands]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.brand_name.toLowerCase().includes(q));
  }, [rows, search]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const setField = (id: string, field: keyof BrandLeadTime, value: any) => {
    setDraft((d) => ({ ...d, [id]: { ...d[id], [field]: value } }));
  };

  const save = async (row: BrandLeadTime) => {
    const patch = draft[row.id];
    if (!patch) return;
    const { error } = await supabase.from("brand_lead_times").update(patch).eq("id", row.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Updated ${row.brand_name}` });
    setDraft((d) => {
      const { [row.id]: _, ...rest } = d;
      return rest;
    });
    qc.invalidateQueries({ queryKey: ["admin-brand-lead-times"] });
  };

  const remove = async (row: BrandLeadTime) => {
    if (!confirm(`Remove lead-time defaults for ${row.brand_name}?`)) return;
    const { error } = await supabase.from("brand_lead_times").delete().eq("id", row.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Removed ${row.brand_name}` });
    qc.invalidateQueries({ queryKey: ["admin-brand-lead-times"] });
  };

  const addNew = async () => {
    if (!newRow.brand_name) {
      toast({ title: "Brand name required", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("brand_lead_times").insert({
      brand_name: newRow.brand_name,
      default_lead_weeks_min: newRow.default_lead_weeks_min ?? null,
      default_lead_weeks_max: newRow.default_lead_weeks_max ?? null,
      default_stock_status: newRow.default_stock_status ?? "made_to_order",
      notes: newRow.notes ?? null,
    });
    if (error) {
      toast({ title: "Add failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Added ${newRow.brand_name}` });
    setAdding(false);
    setNewRow({ brand_name: "", default_lead_weeks_min: 4, default_lead_weeks_max: 8, default_stock_status: "made_to_order" });
    qc.invalidateQueries({ queryKey: ["admin-brand-lead-times"] });
  };

  return (
    <>
      <Helmet><title>Brand Lead Times — Admin — Maison Affluency</title></Helmet>
      <div className="max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
            <div>
              <h1 className="font-display text-2xl text-foreground">Brand Lead Times</h1>
              <p className="font-body text-sm text-muted-foreground mt-0.5">
                Default availability + lead time per brand. Used for stock badges across the trade portal.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brand…"
              className="px-3 py-1.5 text-sm font-body rounded-md border border-border bg-background w-56"
            />
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] uppercase tracking-wider font-body rounded-md border border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            >
              <Plus className="h-3 w-3" /> Add brand
            </button>
          </div>
        </div>

        {unsetBrands.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <div className="font-body text-[11px] uppercase tracking-wider text-amber-900 mb-1">
              {unsetBrands.length} brand{unsetBrands.length === 1 ? "" : "s"} have no lead-time defaults
            </div>
            <div className="flex flex-wrap gap-1">
              {unsetBrands.slice(0, 20).map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setNewRow((n) => ({ ...n, brand_name: b }));
                    setAdding(true);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded border border-amber-300 bg-white text-amber-900 hover:bg-amber-100"
                >
                  {b}
                </button>
              ))}
              {unsetBrands.length > 20 && (
                <span className="text-[10px] text-amber-800 px-2 py-0.5">+{unsetBrands.length - 20} more</span>
              )}
            </div>
          </div>
        )}

        {adding && (
          <div className="border border-primary/30 bg-primary/5 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-12 gap-2 items-center">
              <input
                className="col-span-4 px-2 py-1.5 text-sm rounded border border-border bg-background"
                placeholder="Brand name"
                value={newRow.brand_name || ""}
                onChange={(e) => setNewRow((n) => ({ ...n, brand_name: e.target.value }))}
              />
              <input
                type="number" min={0}
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-border bg-background"
                placeholder="Min wks"
                value={newRow.default_lead_weeks_min ?? ""}
                onChange={(e) => setNewRow((n) => ({ ...n, default_lead_weeks_min: e.target.value ? Number(e.target.value) : null }))}
              />
              <input
                type="number" min={0}
                className="col-span-2 px-2 py-1.5 text-sm rounded border border-border bg-background"
                placeholder="Max wks"
                value={newRow.default_lead_weeks_max ?? ""}
                onChange={(e) => setNewRow((n) => ({ ...n, default_lead_weeks_max: e.target.value ? Number(e.target.value) : null }))}
              />
              <select
                className="col-span-3 px-2 py-1.5 text-sm rounded border border-border bg-background"
                value={newRow.default_stock_status}
                onChange={(e) => setNewRow((n) => ({ ...n, default_stock_status: e.target.value as StockStatus }))}
              >
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button
                onClick={addNew}
                className="col-span-1 px-2 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
            </div>
            <button onClick={() => setAdding(false)} className="text-[10px] uppercase tracking-wider text-muted-foreground hover:underline">
              Cancel
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5">Brand</th>
                  <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-20">Min wks</th>
                  <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-20">Max wks</th>
                  <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5 w-40">Stock status</th>
                  <th className="text-left font-body text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-2.5">Notes</th>
                  <th className="px-3 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const d = draft[row.id] || {};
                  const dirty = Object.keys(d).length > 0;
                  return (
                    <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2 font-display text-sm">{row.brand_name}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min={0}
                          className="w-16 px-1.5 py-1 text-xs rounded border border-border bg-background"
                          value={d.default_lead_weeks_min ?? row.default_lead_weeks_min ?? ""}
                          onChange={(e) => setField(row.id, "default_lead_weeks_min", e.target.value ? Number(e.target.value) : null)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number" min={0}
                          className="w-16 px-1.5 py-1 text-xs rounded border border-border bg-background"
                          value={d.default_lead_weeks_max ?? row.default_lead_weeks_max ?? ""}
                          onChange={(e) => setField(row.id, "default_lead_weeks_max", e.target.value ? Number(e.target.value) : null)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          className="px-1.5 py-1 text-xs rounded border border-border bg-background"
                          value={d.default_stock_status ?? row.default_stock_status}
                          onChange={(e) => setField(row.id, "default_stock_status", e.target.value as StockStatus)}
                        >
                          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          className="w-full px-1.5 py-1 text-xs rounded border border-border bg-background"
                          value={d.notes ?? row.notes ?? ""}
                          onChange={(e) => setField(row.id, "notes", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {dirty && (
                            <button onClick={() => save(row)} className="p-1 rounded text-primary hover:bg-primary/10" title="Save">
                              <Save className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button onClick={() => remove(row)} className="p-1 rounded text-destructive hover:bg-destructive/10" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {rows.length === 0 ? "No brand lead times configured yet." : `No brands match "${search}"`}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
