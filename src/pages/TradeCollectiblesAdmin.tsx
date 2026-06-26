import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { collectibleDesigners } from "@/components/Collectibles";
import {
  invalidateCollectibleOverrides,
  type AtelierOverride,
  type AtelierGalleryItem,
} from "@/hooks/useCollectibleOverrides";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  Eye,
  EyeOff,
  ArrowLeft,
  Pencil,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { z } from "zod";

type Row = {
  slug: string;
  name: string;
  founder?: string;
  specialty: string;
  trade_only: boolean;
};

const EditSchema = z.object({
  name: z.string().trim().min(1).max(120),
  founder: z.string().trim().max(120).optional().or(z.literal("")),
  specialty: z.string().trim().max(200),
  hero_image_url: z.string().trim().url().optional().or(z.literal("")),
  website_url: z.string().trim().url().optional().or(z.literal("")),
  instagram_url: z.string().trim().url().optional().or(z.literal("")),
});

type EditForm = z.infer<typeof EditSchema>;

type EditingState = {
  slug: string;
  baseName: string;
  defaults: EditForm; // hardcoded fallbacks (for preview / reset)
  form: EditForm;
  gallery: AtelierGalleryItem[];
};

export default function TradeCollectiblesAdmin() {
  const { isAdmin, loading } = useAuth();
  const { toast } = useToast();
  const [tradeOnly, setTradeOnly] = useState<Record<string, boolean>>({});
  const [overrides, setOverrides] = useState<Record<string, AtelierOverride>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [to, ov] = await Promise.all([
        supabase.from("collectible_overrides" as any).select("slug, trade_only"),
        supabase
          .from("collectible_atelier_overrides" as any)
          .select("slug, name, founder, specialty, hero_image_url, website_url, instagram_url"),
      ]);
      const tMap: Record<string, boolean> = {};
      (to.data as any[] | null)?.forEach((r) => {
        tMap[String(r.slug)] = !!r.trade_only;
      });
      const oMap: Record<string, AtelierOverride> = {};
      (ov.data as any[] | null)?.forEach((r) => {
        oMap[String(r.slug)] = r as AtelierOverride;
      });
      setTradeOnly(tMap);
      setOverrides(oMap);
      setLoaded(true);
    })();
  }, [isAdmin]);

  const rows: Row[] = useMemo(
    () =>
      collectibleDesigners
        .map((d) => {
          const slug = String(d.id || d.name);
          const ov = overrides[slug];
          return {
            slug,
            name: ov?.name || d.name,
            founder: ov?.founder ?? d.founder,
            specialty: ov?.specialty || d.specialty,
            trade_only: !!tradeOnly[slug],
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" })),
    [tradeOnly, overrides]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.founder || "").toLowerCase().includes(q) ||
        r.specialty.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const tradeOnlyCount = rows.filter((r) => r.trade_only).length;
  const editedCount = Object.keys(overrides).length;

  const toggleTradeOnly = async (slug: string, next: boolean) => {
    setSaving((s) => ({ ...s, [slug]: true }));
    const prev = tradeOnly[slug];
    setTradeOnly((o) => ({ ...o, [slug]: next }));
    const { error } = await supabase
      .from("collectible_overrides" as any)
      .upsert(
        { slug, trade_only: next, updated_by: (await supabase.auth.getUser()).data.user?.id },
        { onConflict: "slug" }
      );
    setSaving((s) => {
      const n = { ...s };
      delete n[slug];
      return n;
    });
    if (error) {
      setTradeOnly((o) => ({ ...o, [slug]: !!prev }));
      toast({ title: "Could not update", description: error.message, variant: "destructive" });
      return;
    }
    invalidateCollectibleOverrides();
    toast({ title: next ? "Now Trade Only" : "Visible to public", description: slug });
  };

  const openEditor = async (slug: string) => {
    const d = collectibleDesigners.find((x) => String(x.id || x.name) === slug);
    if (!d) return;
    const ov = overrides[slug];
    const defaults: EditForm = {
      name: d.name,
      founder: d.founder || "",
      specialty: d.specialty,
      hero_image_url: d.image || "",
      website_url: d.links?.find((l) => l.type.toLowerCase() === "website")?.url || "",
      instagram_url: d.links?.find((l) => l.type.toLowerCase() === "instagram")?.url || "",
    };
    const form: EditForm = {
      name: ov?.name ?? defaults.name,
      founder: ov?.founder ?? defaults.founder,
      specialty: ov?.specialty ?? defaults.specialty,
      hero_image_url: ov?.hero_image_url ?? defaults.hero_image_url,
      website_url: ov?.website_url ?? defaults.website_url,
      instagram_url: ov?.instagram_url ?? defaults.instagram_url,
    };
    const { data: gal } = await supabase
      .from("collectible_atelier_gallery" as any)
      .select("id, slug, image_url, caption, position")
      .eq("slug", slug)
      .order("position", { ascending: true });
    setEditing({
      slug,
      baseName: d.name,
      defaults,
      form,
      gallery: (gal as any[] | null)?.map((g) => g as AtelierGalleryItem) || [],
    });
  };

  const updateForm = (k: keyof EditForm, v: string) =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const updateGalleryField = (idx: number, k: "image_url" | "caption", v: string) =>
    setEditing((e) => {
      if (!e) return e;
      const gallery = e.gallery.slice();
      gallery[idx] = { ...gallery[idx], [k]: v };
      return { ...e, gallery };
    });

  const addGalleryRow = () =>
    setEditing((e) =>
      e
        ? {
            ...e,
            gallery: [
              ...e.gallery,
              {
                id: `new-${Date.now()}-${e.gallery.length}`,
                slug: e.slug,
                image_url: "",
                caption: "",
                position: e.gallery.length,
              },
            ],
          }
        : e
    );

  const removeGalleryRow = (idx: number) =>
    setEditing((e) =>
      e ? { ...e, gallery: e.gallery.filter((_, i) => i !== idx) } : e
    );

  const moveGalleryRow = (idx: number, dir: -1 | 1) =>
    setEditing((e) => {
      if (!e) return e;
      const next = idx + dir;
      if (next < 0 || next >= e.gallery.length) return e;
      const gallery = e.gallery.slice();
      [gallery[idx], gallery[next]] = [gallery[next], gallery[idx]];
      return { ...e, gallery };
    });

  const resetToDefaults = () =>
    setEditing((e) => (e ? { ...e, form: { ...e.defaults } } : e));

  const saveEdit = async () => {
    if (!editing) return;
    const parsed = EditSchema.safeParse(editing.form);
    if (!parsed.success) {
      toast({
        title: "Validation error",
        description: Object.values(parsed.error.flatten().fieldErrors).flat().join(" · "),
        variant: "destructive",
      });
      return;
    }
    // Validate gallery URLs
    for (const g of editing.gallery) {
      if (!g.image_url || !/^https?:\/\//.test(g.image_url)) {
        toast({ title: "Invalid gallery image URL", description: g.image_url || "(empty)", variant: "destructive" });
        return;
      }
    }
    setSavingEdit(true);
    const userId = (await supabase.auth.getUser()).data.user?.id;
    const payload = {
      slug: editing.slug,
      name: parsed.data.name,
      founder: parsed.data.founder || null,
      specialty: parsed.data.specialty,
      hero_image_url: parsed.data.hero_image_url || null,
      website_url: parsed.data.website_url || null,
      instagram_url: parsed.data.instagram_url || null,
      updated_by: userId,
    };
    const { error: e1 } = await supabase
      .from("collectible_atelier_overrides" as any)
      .upsert(payload, { onConflict: "slug" });
    if (e1) {
      setSavingEdit(false);
      toast({ title: "Could not save", description: e1.message, variant: "destructive" });
      return;
    }
    // Replace gallery: delete-all then insert (small N per atelier).
    const { error: eDel } = await supabase
      .from("collectible_atelier_gallery" as any)
      .delete()
      .eq("slug", editing.slug);
    if (eDel) {
      setSavingEdit(false);
      toast({ title: "Could not update gallery", description: eDel.message, variant: "destructive" });
      return;
    }
    if (editing.gallery.length > 0) {
      const rowsToInsert = editing.gallery.map((g, i) => ({
        slug: editing.slug,
        image_url: g.image_url,
        caption: g.caption || null,
        position: i,
        updated_by: userId,
      }));
      const { error: eIns } = await supabase
        .from("collectible_atelier_gallery" as any)
        .insert(rowsToInsert);
      if (eIns) {
        setSavingEdit(false);
        toast({ title: "Could not save gallery", description: eIns.message, variant: "destructive" });
        return;
      }
    }
    setOverrides((o) => ({ ...o, [editing.slug]: payload as AtelierOverride }));
    invalidateCollectibleOverrides();
    setSavingEdit(false);
    setEditing(null);
    toast({ title: "Saved", description: payload.name });
  };

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground font-body">
        Checking admin access…
      </div>
    );
  }
  if (!isAdmin) {
    if (import.meta.env.DEV) {
      return (
        <div className="p-8 max-w-xl space-y-3">
          <h1 className="font-display text-xl">Admin access required</h1>
          <p className="text-sm text-muted-foreground font-body">
            Sign in with an admin account to manage Collectible Design.
          </p>
        </div>
      );
    }
    return <Navigate to="/trade" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Collectible Design Editor — Trade Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              to="/trade/designers/admin"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Designer Editor
            </Link>
            <h1 className="font-display text-2xl tracking-wide mt-1">
              Collectible Design Editor
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-body">
              {rows.length} ateliers · {tradeOnlyCount} Trade Only · {editedCount} edited ·
              Edit name, hero, gallery and links per atelier, or hide one from public view.
            </p>
          </div>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search ateliers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {!loaded ? (
          <div className="text-sm text-muted-foreground font-body">Loading…</div>
        ) : (
          <div className="border rounded-md divide-y">
            {filtered.map((r) => {
              const isEdited = !!overrides[r.slug];
              return (
                <div
                  key={r.slug}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-sm tracking-wide truncate">
                        {r.name}
                      </span>
                      {r.founder && (
                        <span className="text-[11px] text-muted-foreground font-body">
                          · {r.founder}
                        </span>
                      )}
                      {isEdited && (
                        <Badge variant="outline" className="text-[10px] border-jade text-jade">
                          Edited
                        </Badge>
                      )}
                      {r.trade_only ? (
                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                          Trade Only
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Public
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-body truncate">
                      {r.specialty}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5 font-mono">
                      {r.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEditor(r.slug)}
                      className="h-8 gap-1.5"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {r.trade_only ? (
                      <EyeOff className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                    <label className="flex items-center gap-2 text-xs font-body cursor-pointer">
                      Trade Only
                      <Switch
                        checked={r.trade_only}
                        disabled={!!saving[r.slug]}
                        onCheckedChange={(checked) => toggleTradeOnly(r.slug, checked)}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center font-body">
                No ateliers match "{search}".
              </div>
            )}
          </div>
        )}
      </div>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle className="font-display tracking-wide">
                  Edit · {editing.baseName}
                </SheetTitle>
                <SheetDescription className="font-body text-xs">
                  Changes go live immediately. Leave a field as-is to keep the default;
                  clear it to fall back to the hardcoded value.
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5 mt-5">
                <Field label="Atelier name">
                  <Input
                    value={editing.form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />
                </Field>
                <Field label="Founder">
                  <Input
                    value={editing.form.founder || ""}
                    onChange={(e) => updateForm("founder", e.target.value)}
                    placeholder="(optional)"
                  />
                </Field>
                <Field label="Specialty / one-liner">
                  <Input
                    value={editing.form.specialty}
                    onChange={(e) => updateForm("specialty", e.target.value)}
                  />
                </Field>
                <Field label="Hero image URL">
                  <Input
                    value={editing.form.hero_image_url || ""}
                    onChange={(e) => updateForm("hero_image_url", e.target.value)}
                    placeholder="https://res.cloudinary.com/…"
                  />
                  {editing.form.hero_image_url && (
                    <img
                      src={editing.form.hero_image_url}
                      alt="Hero preview"
                      className="mt-2 h-32 w-full object-cover rounded border"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </Field>
                <div className="grid grid-cols-1 gap-4">
                  <Field label="Website URL">
                    <Input
                      value={editing.form.website_url || ""}
                      onChange={(e) => updateForm("website_url", e.target.value)}
                      placeholder="https://…"
                    />
                  </Field>
                  <Field label="Instagram URL">
                    <Input
                      value={editing.form.instagram_url || ""}
                      onChange={(e) => updateForm("instagram_url", e.target.value)}
                      placeholder="https://instagram.com/…"
                    />
                  </Field>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-display text-sm tracking-wide">Gallery</h3>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addGalleryRow}
                      className="h-7 gap-1.5"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add image
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-body mb-3">
                    Reorderable image list shown on the atelier page (max 30).
                  </p>
                  {editing.gallery.length === 0 && (
                    <p className="text-xs text-muted-foreground font-body italic">
                      No gallery images yet.
                    </p>
                  )}
                  <div className="space-y-2">
                    {editing.gallery.map((g, i) => (
                      <div key={g.id} className="flex items-start gap-2 border rounded p-2">
                        <div className="flex flex-col gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={i === 0}
                            onClick={() => moveGalleryRow(i, -1)}
                            className="h-6 w-6"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            disabled={i === editing.gallery.length - 1}
                            onClick={() => moveGalleryRow(i, 1)}
                            className="h-6 w-6"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                        </div>
                        {g.image_url && (
                          <img
                            src={g.image_url}
                            alt=""
                            className="h-16 w-16 object-cover rounded border shrink-0"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                            }}
                          />
                        )}
                        <div className="flex-1 space-y-1.5 min-w-0">
                          <Input
                            value={g.image_url}
                            onChange={(e) => updateGalleryField(i, "image_url", e.target.value)}
                            placeholder="Image URL"
                            className="h-8 text-xs"
                          />
                          <Input
                            value={g.caption || ""}
                            onChange={(e) => updateGalleryField(i, "caption", e.target.value)}
                            placeholder="Caption (optional)"
                            className="h-8 text-xs"
                          />
                        </div>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeGalleryRow(i)}
                          className="h-7 w-7 text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <SheetFooter className="mt-6 gap-2 flex-row justify-between sm:justify-between">
                <Button type="button" variant="ghost" onClick={resetToDefaults}>
                  Reset to default
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveEdit} disabled={savingEdit}>
                    {savingEdit ? "Saving…" : "Save"}
                  </Button>
                </div>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-body">
        {label}
      </span>
      {children}
    </label>
  );
}
