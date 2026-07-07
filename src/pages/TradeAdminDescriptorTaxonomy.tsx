import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import {
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";

const CATEGORIES = [
  "construction",
  "treatment",
  "finish",
  "feature",
  "attribute",
  "hardware",
] as const;
type Category = (typeof CATEGORIES)[number];

interface Descriptor {
  id: string;
  slug: string;
  name: string;
  category: Category;
  synonyms: string[];
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export default function TradeAdminDescriptorTaxonomy() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<Descriptor[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [remapBusy, setRemapBusy] = useState(false);
  const [editing, setEditing] = useState<Descriptor | null>(null);
  const [deleting, setDeleting] = useState<Descriptor | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: tax, error: e1 }, { data: links, error: e2 }] = await Promise.all([
      supabase
        .from("descriptor_taxonomy")
        .select("id, slug, name, category, synonyms, description, is_active, sort_order")
        .order("category", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("product_descriptor_links").select("descriptor_id"),
    ]);
    if (e1 || e2) {
      toast({ title: "Failed to load", description: (e1 || e2)?.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setRows((tax || []) as Descriptor[]);
    const c: Record<string, number> = {};
    for (const row of links || []) {
      c[row.descriptor_id] = (c[row.descriptor_id] || 0) + 1;
    }
    setCounts(c);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const grouped = useMemo(() => {
    const g: Record<string, Descriptor[]> = {};
    for (const r of rows) (g[r.category] ||= []).push(r);
    return g;
  }, [rows]);

  const move = async (row: Descriptor, dir: -1 | 1) => {
    const siblings = grouped[row.category] || [];
    const idx = siblings.findIndex((r) => r.id === row.id);
    const swap = siblings[idx + dir];
    if (!swap) return;
    // Optimistic swap
    const a = row.sort_order;
    const b = swap.sort_order;
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id ? { ...r, sort_order: b } : r.id === swap.id ? { ...r, sort_order: a } : r,
      ),
    );
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("descriptor_taxonomy").update({ sort_order: b }).eq("id", row.id),
      supabase.from("descriptor_taxonomy").update({ sort_order: a }).eq("id", swap.id),
    ]);
    if (e1 || e2) {
      toast({ title: "Reorder failed", description: (e1 || e2)?.message, variant: "destructive" });
      load();
    }
  };

  const remap = async () => {
    if (remapBusy) return;
    setRemapBusy(true);
    const { data, error } = await supabase.rpc("remap_product_descriptors");
    setRemapBusy(false);
    if (error) {
      toast({ title: "Remap failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Remap complete", description: `${data} product ↔ descriptor links` });
    load();
  };

  const doDelete = async (row: Descriptor) => {
    const { error } = await supabase.from("descriptor_taxonomy").delete().eq("id", row.id);
    if (error) {
      toast({
        title: "Delete failed",
        description:
          error.message.includes("foreign key") || error.message.includes("violates")
            ? "This descriptor still has product links. Re-map first or clear its links."
            : error.message,
        variant: "destructive",
      });
      return;
    }
    setDeleting(null);
    toast({ title: "Deleted" });
    load();
  };

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Descriptor Taxonomy — Admin — Maison Affluency</title>
      </Helmet>
      <div className="max-w-5xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl text-foreground">Descriptor Taxonomy</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Non-material product descriptors (construction, treatment, finish, feature, hardware,
              attribute). Edit synonyms — the remap rules — then re-run the mapping to rebuild
              product links.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={remap} disabled={remapBusy}>
              {remapBusy ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Re-map products
            </Button>
            <Button
              size="sm"
              onClick={() =>
                setEditing({
                  id: "",
                  slug: "",
                  name: "",
                  category: "attribute",
                  synonyms: [],
                  description: "",
                  is_active: true,
                  sort_order: 0,
                })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Add descriptor
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const list = grouped[cat] || [];
            if (!list.length) return null;
            return (
              <div key={cat} className="border border-border rounded-lg overflow-hidden">
                <div className="bg-muted/40 px-4 py-2 flex items-center justify-between">
                  <h2 className="font-display text-sm uppercase tracking-wide text-foreground">
                    {cat}
                  </h2>
                  <span className="font-body text-xs text-muted-foreground">
                    {list.length} tag{list.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {list.map((row, i) => (
                    <div
                      key={row.id}
                      className="px-4 py-3 flex items-center gap-3 hover:bg-muted/20"
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          onClick={() => move(row, -1)}
                          disabled={i === 0}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => move(row, 1)}
                          disabled={i === list.length - 1}
                          className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          aria-label="Move down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display text-sm text-foreground">{row.name}</span>
                          <span className="font-body text-[10px] text-muted-foreground">
                            {row.slug}
                          </span>
                          {!row.is_active && (
                            <Badge variant="outline" className="text-[10px]">
                              inactive
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px]">
                            {counts[row.id] || 0} links
                          </Badge>
                        </div>
                        {row.synonyms.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {row.synonyms.map((s) => (
                              <span
                                key={s}
                                className="text-[10px] font-body text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setEditing(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(row)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <EditDialog
        open={!!editing}
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
        maxSort={(cat) => {
          const list = grouped[cat] || [];
          return list.length ? Math.max(...list.map((r) => r.sort_order)) + 10 : 10;
        }}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This descriptor has {counts[deleting?.id || ""] || 0} product link
              {(counts[deleting?.id || ""] || 0) === 1 ? "" : "s"}. Deletion is blocked while links
              exist — clear or re-map them first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && doDelete(deleting)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function EditDialog({
  open,
  row,
  onClose,
  onSaved,
  maxSort,
}: {
  open: boolean;
  row: Descriptor | null;
  onClose: () => void;
  onSaved: () => void;
  maxSort: (cat: Category) => number;
}) {
  const [form, setForm] = useState<Descriptor | null>(row);
  const [synonymsText, setSynonymsText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(row);
    setSynonymsText(row?.synonyms.join("\n") ?? "");
  }, [row]);

  if (!form) return null;
  const isNew = !form.id;

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    const synonyms = synonymsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload = {
      slug: form.slug.trim() || slugify(form.name),
      name: form.name.trim(),
      category: form.category,
      synonyms,
      description: form.description?.trim() || null,
      is_active: form.is_active,
      sort_order: isNew ? maxSort(form.category) : form.sort_order,
    };
    setSaving(true);
    const { error } = isNew
      ? await supabase.from("descriptor_taxonomy").insert(payload)
      : await supabase.from("descriptor_taxonomy").update(payload).eq("id", form.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isNew ? "Descriptor added" : "Saved" });
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add descriptor" : `Edit ${form.name}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={form.slug}
                placeholder={slugify(form.name) || "auto"}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as Category })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Synonyms / remap rules (one per line, case-insensitive)</Label>
            <Textarea
              rows={6}
              value={synonymsText}
              onChange={(e) => setSynonymsText(e.target.value)}
              placeholder={"gold leaf\n24k gold\ngold-leaf"}
            />
            <p className="mt-1 text-[10px] font-body text-muted-foreground">
              Each line is matched as a whole word/phrase against product materials text. Re-run
              “Re-map products” after saving to apply changes.
            </p>
          </div>

          <div>
            <Label>Description</Label>
            <Textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm({ ...form, is_active: v })}
            />
            <Label className="text-sm">Active (matched during remap)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isNew ? "Add" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
