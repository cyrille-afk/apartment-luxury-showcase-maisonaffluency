import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, X, Plus, Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Row {
  id: string;
  product_name: string | null;
  brand_name: string | null;
  category: string | null;
  subcategory: string | null;
  available_finishes: string[] | null;
  fabric_options: string[] | null;
}

type Field = "available_finishes" | "fabric_options";
type BulkMode = "add" | "remove" | "replace";

function TagEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const commit = () => {
    const parts = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const merged = Array.from(new Set([...values, ...parts]));
    onChange(merged);
    setInput("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1">
      {values.map((v) => (
        <Badge
          key={v}
          variant="secondary"
          className="gap-1 font-body text-[11px] font-normal"
        >
          {v}
          <button
            type="button"
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="hover:text-destructive"
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        placeholder={placeholder ?? "add…"}
        className="min-w-[80px] flex-1 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

export default function TradeAdminBulkFinishes() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [drafts, setDrafts] = useState<
    Record<string, { available_finishes?: string[]; fabric_options?: string[] }>
  >({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [bulkField, setBulkField] = useState<Field>("available_finishes");
  const [bulkMode, setBulkMode] = useState<BulkMode>("add");
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-bulk-finishes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_products")
        .select(
          "id, product_name, brand_name, category, subcategory, available_finishes, fabric_options"
        )
        .order("brand_name", { ascending: true, nullsFirst: false })
        .order("product_name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return (data as unknown as Row[]) || [];
    },
    enabled: isAdmin,
  });

  const brands = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.brand_name && s.add(r.brand_name));
    return Array.from(s).sort();
  }, [rows]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.category && s.add(r.category));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (brandFilter !== "all" && r.brand_name !== brandFilter) return false;
      if (categoryFilter !== "all" && r.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        (r.product_name || "").toLowerCase().includes(q) ||
        (r.brand_name || "").toLowerCase().includes(q) ||
        (r.subcategory || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, brandFilter, categoryFilter]);

  const effective = (r: Row, field: Field): string[] =>
    drafts[r.id]?.[field] ?? (r[field] ?? []);

  const setRow = (id: string, field: Field, next: string[]) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: next } }));

  const dirtyIds = Object.keys(drafts);

  const saveAll = async () => {
    if (dirtyIds.length === 0) return;
    setSaving(true);
    try {
      for (const id of dirtyIds) {
        const patch = drafts[id];
        const { error } = await supabase
          .from("trade_products")
          .update(patch)
          .eq("id", id);
        if (error) throw error;
      }
      toast({ title: `Saved ${dirtyIds.length} product${dirtyIds.length > 1 ? "s" : ""}` });
      setDrafts({});
      qc.invalidateQueries({ queryKey: ["admin-bulk-finishes"] });
    } catch (e: any) {
      toast({
        title: "Save failed",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const applyBulk = () => {
    if (selected.size === 0) {
      toast({ title: "Select at least one product", variant: "destructive" });
      return;
    }
    if (bulkMode !== "replace" && bulkTags.length === 0) {
      toast({ title: "Add at least one tag to apply", variant: "destructive" });
      return;
    }
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of selected) {
        const row = rows.find((r) => r.id === id);
        if (!row) continue;
        const current = next[id]?.[bulkField] ?? row[bulkField] ?? [];
        let updated: string[];
        if (bulkMode === "add") {
          updated = Array.from(new Set([...current, ...bulkTags]));
        } else if (bulkMode === "remove") {
          const rm = new Set(bulkTags);
          updated = current.filter((v) => !rm.has(v));
        } else {
          updated = [...bulkTags];
        }
        next[id] = { ...next[id], [bulkField]: updated };
      }
      return next;
    });
    toast({
      title: `Queued ${bulkMode} on ${selected.size} product${selected.size > 1 ? "s" : ""}`,
      description: "Review and click Save to persist.",
    });
  };

  const toggleAllFiltered = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((r) => (checked ? next.add(r.id) : next.delete(r.id)));
      return next;
    });
  };

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id));

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Bulk Finishes & Fabrics — Trade Admin — Maison Affluency</title>
      </Helmet>

      <div className="max-w-7xl space-y-6">
        <div>
          <Link
            to="/trade/admin/dashboard"
            className="inline-flex items-center gap-1 text-[11px] font-body uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Admin Dashboard
          </Link>
          <h1 className="font-display text-2xl text-foreground mt-2">
            Bulk Finishes & Fabrics
          </h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Edit <code>available_finishes</code> and <code>fabric_options</code>{" "}
            across many trade products. Changes are staged locally — click{" "}
            <strong>Save</strong> to persist.
          </p>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 rounded-lg border border-border bg-card">
          <Input
            placeholder="Search name, brand, subcategory…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Brand" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center justify-end gap-3 text-[11px] font-body text-muted-foreground">
            <span>
              {filtered.length} product{filtered.length === 1 ? "" : "s"} · {selected.size} selected
            </span>
          </div>
        </div>

        {/* Bulk apply bar */}
        <div className="p-4 rounded-lg border border-border bg-card space-y-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-body">
            Bulk apply to selected
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[160px_140px_1fr_auto] gap-3 items-start">
            <Select value={bulkField} onValueChange={(v) => setBulkField(v as Field)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available_finishes">Finishes</SelectItem>
                <SelectItem value="fabric_options">Fabrics</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bulkMode} onValueChange={(v) => setBulkMode(v as BulkMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="add">Add</SelectItem>
                <SelectItem value="remove">Remove</SelectItem>
                <SelectItem value="replace">Replace</SelectItem>
              </SelectContent>
            </Select>
            <div className="border border-input rounded-md px-2 py-1.5 min-h-9 bg-background">
              <TagEditor
                values={bulkTags}
                onChange={setBulkTags}
                placeholder="type value, Enter or comma…"
              />
            </div>
            <Button onClick={applyBulk} variant="secondary">
              <Plus className="h-4 w-4 mr-1" /> Apply
            </Button>
          </div>
          <p className="text-[11px] font-body text-muted-foreground">
            <strong>Add</strong> merges tags into each selected row's existing list.{" "}
            <strong>Remove</strong> deletes matching tags.{" "}
            <strong>Replace</strong> overwrites the field entirely (can be empty).
          </p>
        </div>

        {/* Save bar */}
        {dirtyIds.length > 0 && (
          <div className="sticky top-0 z-20 flex items-center justify-between gap-3 p-3 rounded-lg border border-foreground/30 bg-background/95 backdrop-blur">
            <span className="font-body text-sm">
              {dirtyIds.length} unsaved change{dirtyIds.length > 1 ? "s" : ""}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDrafts({})} disabled={saving}>
                Discard
              </Button>
              <Button onClick={saveAll} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[32px_1.6fr_1fr_1fr_1.4fr_1.4fr] gap-3 px-4 py-2 border-b border-border bg-muted/40 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-body">
            <div className="flex items-center">
              <Checkbox
                checked={allFilteredSelected}
                onCheckedChange={(c) => toggleAllFiltered(!!c)}
                aria-label="Select all filtered"
              />
            </div>
            <div>Product</div>
            <div>Brand</div>
            <div>Category</div>
            <div>Finishes</div>
            <div>Fabrics</div>
          </div>

          {isLoading && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading products…
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No products match your filters.
            </div>
          )}

          <div className="divide-y divide-border">
            {filtered.map((r) => {
              const isDirty = !!drafts[r.id];
              return (
                <div
                  key={r.id}
                  className={`grid grid-cols-[32px_1.6fr_1fr_1fr_1.4fr_1.4fr] gap-3 px-4 py-3 items-start ${
                    isDirty ? "bg-yellow-50/40 dark:bg-yellow-900/10" : ""
                  }`}
                >
                  <div className="pt-1">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={(c) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (c) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        });
                      }}
                    />
                  </div>
                  <div className="font-body text-[13px] text-foreground min-w-0">
                    <div className="truncate">{r.product_name || "—"}</div>
                    {isDirty && (
                      <div className="text-[10px] uppercase tracking-[0.16em] text-foreground/60 mt-0.5">
                        Unsaved
                      </div>
                    )}
                  </div>
                  <div className="font-body text-[12px] text-muted-foreground truncate">
                    {r.brand_name || "—"}
                  </div>
                  <div className="font-body text-[12px] text-muted-foreground truncate">
                    {r.category || "—"}
                    {r.subcategory ? (
                      <span className="block text-[10px] opacity-70">
                        {r.subcategory}
                      </span>
                    ) : null}
                  </div>
                  <div className="border border-input rounded-md px-2 py-1 bg-background min-h-9">
                    <TagEditor
                      values={effective(r, "available_finishes")}
                      onChange={(next) => setRow(r.id, "available_finishes", next)}
                      placeholder="add finish…"
                    />
                  </div>
                  <div className="border border-input rounded-md px-2 py-1 bg-background min-h-9">
                    <TagEditor
                      values={effective(r, "fabric_options")}
                      onChange={(next) => setRow(r.id, "fabric_options", next)}
                      placeholder="add fabric…"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
