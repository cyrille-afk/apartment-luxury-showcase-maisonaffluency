import { useState, useMemo, useCallback, Fragment, useEffect, useRef } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { cn } from "@/lib/utils";
import { priceRugVariantFromLabel, isRugCategory } from "@/lib/rugPricing";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Save, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Plus, Trash2, GripVertical, BookOpen, Monitor, Smartphone, AlertTriangle, Instagram, Wand2, Loader2, X, FileDown, ArrowUp, ArrowDown, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { lazy, Suspense } from "react";
import CloudUpload from "@/components/trade/CloudUpload";
import CsvBulkUpload from "@/components/admin/CsvBulkUpload";
import BiographyToolbar from "@/components/admin/BiographyToolbar";
import DesignerCompletenessAudit from "@/components/admin/DesignerCompletenessAudit";
import GalleryThumbnailsEditor from "@/components/admin/GalleryThumbnailsEditor";
import SlugHealthBadge, { useSlugHealthMap } from "@/components/admin/SlugHealthBadge";
import VariantPreviewPanel from "@/components/admin/VariantPreviewPanel";
import ProductFabricsPanel from "@/components/admin/ProductFabricsPanel";
import SwatchSyncDialog from "@/components/admin/SwatchSyncDialog";

// Pilot: surface inline Fabrics & Finishes editor only for these picks for now.
const FABRICS_PANEL_PILOT_PICK_IDS = new Set<string>([
  "0d33b077-dc1a-4aed-bc8e-86dd2884b2dd", // Jean-Michel Frank — Transat c. 1929
  "1547d5cf-ccf4-4ea5-b28a-40cedea1d6c2", // ECART — Wolf Armchair
  "fc3a68b1-65cd-4d6f-941c-b8a2451dd064", // ECART — Corbeille Sofa c. 1923
  "9baeef6c-d0fa-4789-ac9d-2703209486dd", // Paul László — Carmelina Chair c. 1947
  "b1534548-cba8-4df4-b6fb-616f802b7bd2", // Paul László — Rodeo Chair c. 1947
  "d423e61c-baac-4e9e-af3d-f80b82b6726a", // Jean-Michel Frank — Croisillon Lamp (Wood) c. 1924
  "99f811c1-8fa5-4dda-a926-a35de571c606", // Jean-Michel Frank — Croisillon Lamp (Brass) c. 1924
]);
import { variantImageKey } from "@/lib/variantImageMap";
import BiographyPdfButton from "@/components/BiographyPdfButton";
import { applyCuratorPickOrder, sortCuratorPicks } from "@/lib/curatorPickSort";

const EditorialBiography = lazy(() => import("@/components/EditorialBiography"));

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Small helper: type L × W × H in cm, auto-compute CBM (m³). */
function DimsToCbm({ onCompute }: { onCompute: (cbm: number) => void }) {
  const [l, setL] = useState("");
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const compute = (lv: string, wv: string, hv: string) => {
    const ln = parseFloat(lv), wn = parseFloat(wv), hn = parseFloat(hv);
    if ([ln, wn, hn].every((x) => Number.isFinite(x) && x > 0)) {
      const cbm = Math.round((ln * wn * hn) / 1_000_000 * 1000) / 1000;
      onCompute(cbm);
    }
  };
  const cbmPreview = (() => {
    const ln = parseFloat(l), wn = parseFloat(w), hn = parseFloat(h);
    if ([ln, wn, hn].every((x) => Number.isFinite(x) && x > 0)) {
      return (Math.round((ln * wn * hn) / 1_000_000 * 1000) / 1000).toFixed(3);
    }
    return null;
  })();
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <Input type="number" step="0.1" value={l} placeholder="L"
        onChange={(e) => { setL(e.target.value); compute(e.target.value, w, h); }}
        className="text-xs h-9" />
      <span className="text-xs text-muted-foreground">×</span>
      <Input type="number" step="0.1" value={w} placeholder="W"
        onChange={(e) => { setW(e.target.value); compute(l, e.target.value, h); }}
        className="text-xs h-9" />
      <span className="text-xs text-muted-foreground">×</span>
      <Input type="number" step="0.1" value={h} placeholder="H"
        onChange={(e) => { setH(e.target.value); compute(l, w, e.target.value); }}
        className="text-xs h-9" />
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
        cm {cbmPreview ? `→ ${cbmPreview} m³` : ""}
      </span>
    </div>
  );
}


const parseBiographyMediaEntry = (entry: string) => {
  const rawSegments = entry.split("|");
  const url = (rawSegments[0] || "").trim();
  const hasMetadata = rawSegments.length > 2;
  const caption = rawSegments.length > 1
    ? rawSegments[1]
        .replace(/^ /, "")
        .replace(hasMetadata ? / $/ : /$^/, "")
    : "";

  return {
    url,
    caption,
    metadata: rawSegments.slice(2).map((segment) => segment.trim()),
  };
};

const serializeBiographyMediaEntry = (url: string, caption: string, metadata: string[] = []) => {
  const parts = [url.trim()];

  if (caption !== "" || metadata.length > 0) {
    parts.push(caption);
  }

  parts.push(...metadata.map((segment) => segment.trim()));

  while (parts.length > 1 && parts[parts.length - 1] === "") parts.pop();

  return parts.join(" | ");
};

/** Inline heritage slide manager for each designer */
function HeritageSlideManager({ designerId }: { designerId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [slides, setSlides] = useState<{ id: string; image_url: string; caption: string | null; sort_order: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("designer_heritage_slides" as any)
      .select("*")
      .eq("designer_id", designerId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setSlides((data as any[]) || []);
        setLoaded(true);
      });
  }, [designerId]);

  const handleUpload = async (urls: string[]) => {
    for (const url of urls) {
      const order = slides.length;
      const { data, error } = await (supabase.from("designer_heritage_slides" as any) as any)
        .insert({ designer_id: designerId, image_url: url, sort_order: order })
        .select()
        .single();
      if (error) {
        toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      } else if (data) {
        setSlides((prev) => [...prev, data as any]);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["heritage-slides", designerId] });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this heritage slide? This action cannot be undone.")) return;
    await (supabase.from("designer_heritage_slides" as any) as any).delete().eq("id", id);
    setSlides((prev) => prev.filter((s) => s.id !== id));
    queryClient.invalidateQueries({ queryKey: ["heritage-slides", designerId] });
  };

  const handleCaptionChange = async (id: string, caption: string) => {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, caption: caption || null } : s)));
    await (supabase.from("designer_heritage_slides" as any) as any).update({ caption: caption || null }).eq("id", id);
  };

  if (!loaded) return null;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Heritage Slides <span className="normal-case font-normal">(5–7 historical photos shown as a slider between paragraphs)</span>
      </label>
      <div className="mt-2 space-y-2">
        {slides.map((slide) => (
          <div key={slide.id} className="flex items-start gap-2">
            <img src={slide.image_url} alt="" className="w-16 h-10 object-cover rounded shrink-0 bg-muted" />
            <Input
              value={slide.caption || ""}
              onChange={(e) => handleCaptionChange(slide.id, e.target.value)}
              placeholder="Caption (optional)"
              className="text-xs flex-1"
            />
            <button
              onClick={() => handleDelete(slide.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <CloudUpload
          folder="heritage-slides"
          accept="image/*"
          multiple
          label="Upload heritage photos"
          onUpload={handleUpload}
        />
      </div>
    </div>
  );
}

/** Inline Curator Picks manager for each designer */
function CuratorPicksManager({ designerId, designerName }: { designerId: string; designerName?: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  type PdfEntry = { label: string; url: string; filename?: string };
  type Pick = {
    id: string; designer_id: string; image_url: string; hover_image_url: string | null;
    gallery_images: string[] | null;
    title: string; subtitle: string | null; category: string | null; subcategory: string | null;
    materials: string | null; materials_description: string | null; dimensions: string | null; description: string | null;
    edition: string | null; photo_credit: string | null; pdf_url: string | null;
    pdf_filename: string | null; pdf_urls: PdfEntry[] | null; currency: string; trade_price_cents: number | null;
    price_per_sqm_cents: number | null;
    price_prefix: string | null; sort_order: number; created_at: string;
    size_variants: { label?: string; base?: string; top?: string; price_cents: number }[] | null;
    variant_placeholder: string | null;
    base_axis_label: string | null;
    top_axis_label: string | null;
    wood_label_override: string | null;
    variant_image_map: Record<string, number> | null;
    pack_cbm: number | null;
    pack_weight_kg: number | null;
    pack_carton_count: number | null;
    default_ship_mode: string | null;
    pickup_country: string | null;
    pickup_postcode: string | null;
    pickup_address: string | null;
  };
  const [picks, setPicks] = useState<Pick[]>([]);
  const [syncPickId, setSyncPickId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const expandedPickStorageKey = `designer_editor_expanded_pick_v1::${designerId}`;
  const [expandedPickId, setExpandedPickIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try { return sessionStorage.getItem(expandedPickStorageKey); } catch { return null; }
  });
  const setExpandedPickId = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
    setExpandedPickIdState((prev) => {
      const next = typeof value === "function" ? (value as (p: string | null) => string | null)(prev) : value;
      try {
        if (next) sessionStorage.setItem(expandedPickStorageKey, next);
        else sessionStorage.removeItem(expandedPickStorageKey);
      } catch { /* ignore */ }
      return next;
    });
  }, [expandedPickStorageKey]);

  const loadPicks = useCallback(async () => {
    const { data, error } = await applyCuratorPickOrder(
      supabase
        .from("designer_curator_picks")
        .select("*")
        .eq("designer_id", designerId)
    );

    if (error) {
      toast({ title: "Failed to load picks", description: error.message, variant: "destructive" });
      setLoaded(true);
      return;
    }

    setPicks(sortCuratorPicks((data as any[]) || []) as any);
    setLoaded(true);
  }, [designerId, toast]);

  useEffect(() => {
    void loadPicks();
  }, [loadPicks]);

  const didRestorePickScrollRef = useRef(false);
  useEffect(() => {
    if (!loaded || didRestorePickScrollRef.current || !expandedPickId) return;
    const el = document.querySelector(`[data-pick-row-id="${expandedPickId}"]`);
    if (el) {
      didRestorePickScrollRef.current = true;
      requestAnimationFrame(() => el.scrollIntoView({ block: "center", behavior: "auto" }));
    }
  }, [loaded, expandedPickId, picks.length]);

  const handleAdd = async () => {
    const order = picks.length;
    const { data, error } = await supabase
      .from("designer_curator_picks")
      .insert({ designer_id: designerId, title: "Untitled Piece", image_url: "", sort_order: order } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Failed to add pick", description: error.message, variant: "destructive" });
    } else if (data) {
      setPicks((prev) => [...prev, data as any]);
      setExpandedPickId((data as any).id);
      queryClient.invalidateQueries({ queryKey: ["admin-public-picks-counts"] });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this curator pick? This action cannot be undone.")) return;
    const { data, error } = await supabase
      .from("designer_curator_picks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }

    if (!data) {
      toast({
        title: "Delete did not persist",
        description: "This pick was removed from the editor view, but not from the backend. The list has been refreshed.",
        variant: "destructive",
      });
      await loadPicks();
      return;
    }

    setPicks((prev) => prev.filter((p) => p.id !== id));
    setExpandedPickId((prev) => (prev === id ? null : prev));
    queryClient.invalidateQueries({ queryKey: ["admin-public-picks-counts"] });
    toast({ title: "Pick deleted" });
  };

  // Debounced autosave: coalesce rapid keystrokes per (pick, field) into a
  // single UPDATE 600ms after the user stops typing. Cuts trigger-chain
  // pressure (audit log + mirror triggers) by ~10-20x on long text fields.
  const pendingWritesRef = useRef<Map<string, { value: any; timer: number }>>(new Map());
  const updateField = (id: string, field: string, value: any) => {
    setPicks((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    const key = `${id}::${field}`;
    const existing = pendingWritesRef.current.get(key);
    if (existing) window.clearTimeout(existing.timer);
    const timer = window.setTimeout(() => {
      const entry = pendingWritesRef.current.get(key);
      pendingWritesRef.current.delete(key);
      void supabase
        .from("designer_curator_picks")
        .update({ [field]: entry?.value } as any)
        .eq("id", id);
    }, 600);
    pendingWritesRef.current.set(key, { value, timer });
  };

  const applyFieldToAll = async (field: string, value: any) => {
    setPicks((prev) => prev.map((p) => ({ ...p, [field]: value })));
    await supabase
      .from("designer_curator_picks")
      .update({ [field]: value } as any)
      .eq("designer_id", designerId);
    toast({ title: `Applied ${field} to all ${picks.length} picks` });
  };

  const movePick = async (id: string, direction: -1 | 1) => {
    const idx = picks.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= picks.length) return;
    const reordered = [...picks];
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const renumbered = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setPicks(renumbered);
    await Promise.all(
      renumbered.map((p) =>
        supabase.from("designer_curator_picks").update({ sort_order: p.sort_order }).eq("id", p.id)
      )
    );
    queryClient.invalidateQueries({ queryKey: ["admin-public-picks-counts"] });
  };

  if (!loaded) return null;

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
        Curators&apos; Picks ({picks.length})
      </label>
      <div className="mt-2 space-y-2">
        {picks.map((pick) => (
          <div key={pick.id} data-pick-row-id={pick.id} className={`rounded-md border border-border/60 p-2 ${(pick as any).is_hidden ? "opacity-60" : ""}`}>
            <div className="flex items-center gap-2">
              {pick.image_url && (
                <img src={pick.image_url} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
              )}
              <span className="text-xs font-medium flex-1 truncate">
                {pick.title || "Untitled"}
                {(pick as any).is_hidden && <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">(hidden)</span>}
              </span>
              {(pick.pdf_url || (pick.pdf_urls && pick.pdf_urls.length > 0)) && (
                <Badge variant="outline" className="text-[10px] border-[hsl(var(--pdf-red))]/40 text-[hsl(var(--pdf-red))]">
                  <FileDown className="w-2.5 h-2.5 mr-0.5" />
                  PDF{pick.pdf_urls && pick.pdf_urls.length > 1 ? ` ×${pick.pdf_urls.length}` : ''}
                </Badge>
              )}
              {pick.category && <Badge variant="outline" className="text-[10px]">{pick.category}</Badge>}
              {(() => {
                const idx = picks.findIndex((p) => p.id === pick.id);
                return (
                  <>
                    <button
                      onClick={() => movePick(pick.id, -1)}
                      disabled={idx <= 0}
                      title="Move up"
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => movePick(pick.id, 1)}
                      disabled={idx >= picks.length - 1}
                      title="Move down"
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </>
                );
              })()}
              <button
                onClick={() => updateField(pick.id, "is_hidden", !(pick as any).is_hidden)}
                title={(pick as any).is_hidden ? "Show on galleries" : "Hide from galleries"}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {(pick as any).is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setExpandedPickId(expandedPickId === pick.id ? null : pick.id)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {expandedPickId === pick.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => handleDelete(pick.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {expandedPickId === pick.id && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Title</label>
                    <Input value={pick.title} onChange={(e) => updateField(pick.id, "title", e.target.value)} className="text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Subtitle</label>
                    <Input value={pick.subtitle || ""} onChange={(e) => updateField(pick.id, "subtitle", e.target.value || null)} className="text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Category</label>
                    <Input value={pick.category || ""} onChange={(e) => updateField(pick.id, "category", e.target.value || null)} className="text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Subcategory</label>
                    <Input value={pick.subcategory || ""} onChange={(e) => updateField(pick.id, "subcategory", e.target.value || null)} className="text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Image URL</label>
                  <Input value={pick.image_url} onChange={(e) => updateField(pick.id, "image_url", e.target.value)} className="text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Hover Image URL</label>
                  <Input value={pick.hover_image_url || ""} onChange={(e) => updateField(pick.id, "hover_image_url", e.target.value || null)} className="text-xs" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Gallery Thumbnails (shown on the public product page — reorder with ↑/↓, insert between rows with +). Unlimited — add as many as you need.</label>
                  <GalleryThumbnailsEditor
                    value={pick.gallery_images || []}
                    onChange={(next) => updateField(pick.id, "gallery_images", next.length ? next : null)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Materials (each option becomes a dropdown choice — leave empty when using the legend below)</label>
                    <Input value={pick.materials || ""} onChange={(e) => updateField(pick.id, "materials", e.target.value || null)} className="text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Dimensions</label>
                    <Input value={pick.dimensions || ""} onChange={(e) => updateField(pick.id, "dimensions", e.target.value || null)} className="text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Product Legend (free-form description — when set, replaces the Materials dropdown and renders as a plain paragraph with the Layers icon)</label>
                  <Textarea
                    value={(pick as any).materials_description || ""}
                    onChange={(e) => updateField(pick.id, "materials_description" as any, e.target.value || null)}
                    className="text-xs min-h-[60px]"
                    placeholder="e.g. Frame in solid and multilayer wood with elastic belts and upholstery in different densities polyurethane foam · Slide feet or lacquered solid wood base"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Edition (manual override)</label>
                    <Input value={pick.edition || ""} onChange={(e) => updateField(pick.id, "edition", e.target.value || null)} className="text-xs" placeholder="leave empty to auto-compose" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Edition Number</label>
                    <Input value={(pick as any).edition_number || ""} onChange={(e) => updateField(pick.id, "edition_number" as any, e.target.value || null)} className="text-xs" placeholder="e.g. 1/8" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Signing Details</label>
                    <Input value={(pick as any).edition_signing || ""} onChange={(e) => updateField(pick.id, "edition_signing" as any, e.target.value || null)} className="text-xs" placeholder="e.g. Signed and dated by the artist" />
                  </div>
                 </div>
                 <div>
                   <label className="text-[10px] text-muted-foreground">Upholstered (finish selector)</label>
                   <select
                     value={
                       (pick as any).is_upholstered === true
                         ? "yes"
                         : (pick as any).is_upholstered === false
                         ? "no"
                         : "auto"
                     }
                     onChange={(e) => {
                       const v = e.target.value;
                       updateField(
                         pick.id,
                         "is_upholstered" as any,
                         v === "yes" ? true : v === "no" ? false : null,
                       );
                     }}
                     className="w-full text-xs h-8 rounded-md border border-input bg-background px-2"
                   >
                     <option value="auto">Auto-detect by category</option>
                    <option value="yes">Yes — show finish selector</option>
                    <option value="no">No — hide finish selector</option>
                   </select>
                 </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Lead Time</label>
                    <Input value={(pick as any).lead_time || ""} onChange={(e) => updateField(pick.id, "lead_time", e.target.value || null)} className="text-xs" placeholder="e.g. 8–10 weeks" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Photo Credit</label>
                    <Input value={pick.photo_credit || ""} onChange={(e) => updateField(pick.id, "photo_credit", e.target.value || null)} className="text-xs" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Origin</label>
                  <div className="flex gap-2">
                    <Input value={(pick as any).origin || ""} onChange={(e) => updateField(pick.id, "origin", e.target.value || null)} className="text-xs" placeholder="e.g. Handmade in Europe" />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-8 whitespace-nowrap"
                      onClick={() => applyFieldToAll("origin", (pick as any).origin || null)}
                      title="Copy this origin to all picks for this designer"
                    >
                      Apply to all
                    </Button>
                  </div>
                </div>


                {/* Logistics & packing — feeds the shipping estimator on quotes */}
                <div className="space-y-2 border border-dashed border-border rounded-md p-2.5 bg-muted/20">
                  <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                    Logistics & packing <span className="italic normal-case font-normal">— used to pre-fill shipping on quotes</span>
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="col-span-2 md:col-span-4">
                      <label className="text-[10px] text-muted-foreground">Packed dimensions (cm) — auto-fills CBM below</label>
                      <DimsToCbm onCompute={(cbm) => updateField(pick.id, "pack_cbm", cbm)} />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Packing CBM (m³)</label>
                      <Input
                        type="number"
                        step="0.001"
                        value={pick.pack_cbm != null ? String(pick.pack_cbm) : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") { updateField(pick.id, "pack_cbm", null); return; }
                          const n = parseFloat(v);
                          updateField(pick.id, "pack_cbm", Number.isFinite(n) ? n : null);
                        }}
                        placeholder="e.g. 0.50"
                        className="text-xs"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-muted-foreground">Weight (kg, gross)</label>
                      <Input
                        type="number"
                        step="0.01"
                        value={pick.pack_weight_kg != null ? String(pick.pack_weight_kg) : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") { updateField(pick.id, "pack_weight_kg", null); return; }
                          const n = parseFloat(v);
                          updateField(pick.id, "pack_weight_kg", Number.isFinite(n) ? n : null);
                        }}
                        placeholder="e.g. 84"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Cartons / crates</label>
                      <Input
                        type="number"
                        step="1"
                        value={pick.pack_carton_count != null ? String(pick.pack_carton_count) : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "") { updateField(pick.id, "pack_carton_count", null); return; }
                          const n = parseInt(v, 10);
                          updateField(pick.id, "pack_carton_count", Number.isFinite(n) ? n : null);
                        }}
                        placeholder="e.g. 1"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Default ship mode</label>
                      <select
                        value={pick.default_ship_mode || ""}
                        onChange={(e) => updateField(pick.id, "default_ship_mode", e.target.value || null)}
                        className="w-full h-9 px-2 text-xs border border-input bg-background rounded-md"
                      >
                        <option value="">Auto (by destination)</option>
                        <option value="sea_lcl">Sea LCL</option>
                        <option value="sea_fcl">Sea FCL</option>
                        <option value="air">Air freight</option>
                        <option value="road">Road</option>
                        <option value="courier">Courier</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">Pickup country (ISO-2)</label>
                      <Input
                        value={pick.pickup_country || ""}
                        onChange={(e) => {
                          const v = e.target.value.toUpperCase().slice(0, 2).replace(/[^A-Z]/g, "");
                          updateField(pick.id, "pickup_country", v || null);
                        }}
                        placeholder="FR"
                        className="text-xs uppercase"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">Pickup postcode</label>
                      <Input
                        value={pick.pickup_postcode || ""}
                        onChange={(e) => updateField(pick.id, "pickup_postcode", e.target.value || null)}
                        placeholder="75011"
                        className="text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-[10px] text-muted-foreground">Pickup address <span className="italic">(internal, for carriers)</span></label>
                      <Input
                        value={pick.pickup_address || ""}
                        onChange={(e) => updateField(pick.id, "pickup_address", e.target.value || null)}
                        placeholder="Atelier, 12 rue de Charonne, Paris"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">HS code <span className="italic">(customs)</span></label>
                      <div className="flex gap-2">
                        <Input
                          value={(pick as any).hs_code || ""}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9.]/g, "").slice(0, 14);
                            updateField(pick.id, "hs_code" as any, v || null);
                          }}
                          placeholder="9405.10"
                          className="text-xs"
                          inputMode="numeric"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-[10px] h-8 whitespace-nowrap"
                          onClick={() => applyFieldToAll("hs_code" as any, (pick as any).hs_code || null)}
                          title="Copy this HS code to all picks for this designer"
                        >
                          Apply to all
                        </Button>
                      </div>
                    </div>
                  </div>

                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Currency</label>
                    <Input value={pick.currency} onChange={(e) => updateField(pick.id, "currency", e.target.value)} className="text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Price Type</label>
                    <select
                      value={pick.price_prefix === "From" ? "from" : "fixed"}
                      onChange={(e) => updateField(pick.id, "price_prefix", e.target.value === "from" ? "From" : null)}
                      className="w-full h-9 px-2 text-xs border border-input bg-background rounded-md"
                    >
                      <option value="fixed">Fixed</option>
                      <option value="from">From</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Default RRP ({pick.currency || "EUR"})</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pick.trade_price_cents != null ? (pick.trade_price_cents / 100).toString() : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { updateField(pick.id, "trade_price_cents", null); return; }
                        const num = parseFloat(v);
                        updateField(pick.id, "trade_price_cents", Number.isFinite(num) ? Math.round(num * 100) : null);
                      }}
                      placeholder="Used when no size variants"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">
                      Price / m² ({pick.currency || "EUR"}) <span className="italic">— rugs</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pick.price_per_sqm_cents != null ? (pick.price_per_sqm_cents / 100).toString() : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") { updateField(pick.id, "price_per_sqm_cents" as any, null); return; }
                        const num = parseFloat(v);
                        updateField(pick.id, "price_per_sqm_cents" as any, Number.isFinite(num) ? Math.round(num * 100) : null);
                      }}
                      placeholder="e.g. 600 → auto-prices variants by W×L"
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Sort Order</label>
                    <Input type="number" value={pick.sort_order} onChange={(e) => updateField(pick.id, "sort_order", parseInt(e.target.value) || 0)} className="text-xs" />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label className="text-[10px] text-muted-foreground">
                      Variant Dropdown Label <span className="italic">(optional — overrides default "Select your finish…")</span>
                    </label>
                    <Input
                      value={pick.variant_placeholder || ""}
                      onChange={(e) => updateField(pick.id, "variant_placeholder", e.target.value || null)}
                      placeholder='e.g. "Select your fabric", "Select your finish"'
                      className="text-xs"
                    />
                  </div>
                  <div className="col-span-2 md:col-span-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">
                        Base axis label <span className="italic">(e.g. "Plinth", "Frame", "Base")</span>
                      </label>
                      <Input
                        value={pick.base_axis_label || ""}
                        onChange={(e) => updateField(pick.id, "base_axis_label", e.target.value || null)}
                        placeholder="Base"
                        className="text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">
                        Top axis label <span className="italic">(e.g. "Fabric", "Upholstery", "Top")</span>
                      </label>
                      <Input
                        value={pick.top_axis_label || ""}
                        onChange={(e) => updateField(pick.id, "top_axis_label", e.target.value || null)}
                        placeholder="Top"
                        className="text-xs"
                      />
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label className="text-[10px] text-muted-foreground">
                      Wood swatch picker label <span className="italic">(optional — overrides default "Select the Wood Finish of the Frame")</span>
                    </label>
                    <Input
                      value={pick.wood_label_override || ""}
                      onChange={(e) => updateField(pick.id, "wood_label_override", e.target.value || null)}
                      placeholder='e.g. "Select the Wood Finish of the Base"'
                      className="text-xs"
                    />
                  </div>
                </div>


                {/* Variant pricing — supports single-axis (Size) and dual-axis (Base × Top) */}
                <div className="space-y-2 border border-dashed border-border rounded-md p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Variant Pricing (per Size, or {pick.base_axis_label || "Base"} × {pick.top_axis_label || "Top"})
                    </label>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        onClick={() => {
                          const current = pick.size_variants || [];
                          updateField(pick.id, "size_variants", [...current, { label: "", base: "", top: "", price_cents: 0 }] as any);
                        }}
                      >
                        + Add row
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        title="Copy one price to every variant row (use when finishes share the same price)"
                        onClick={() => {
                          const current = pick.size_variants || [];
                          if (current.length === 0) {
                            toast({ title: "No rows", description: "Add variant rows first.", variant: "destructive" });
                            return;
                          }
                          const firstPriced = current.find((v) => v.price_cents && v.price_cents > 0)?.price_cents || 0;
                          const seedUsd = firstPriced ? (firstPriced / 100).toString() : "";
                          const input = window.prompt("Apply this price (in major units, e.g. 5000) to all variant rows:", seedUsd);
                          if (input === null) return;
                          const num = parseFloat(input);
                          if (!Number.isFinite(num) || num < 0) {
                            toast({ title: "Invalid price", variant: "destructive" });
                            return;
                          }
                          const cents = Math.round(num * 100);
                          const next = current.map((v) => ({ ...v, price_cents: cents }));
                          updateField(pick.id, "size_variants", next as any);
                          toast({ title: "Price applied", description: `${current.length} rows set to ${num.toLocaleString()}` });
                        }}
                      >
                        Apply price to all
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        title="Auto-fill all Base × Top combinations from rows that have only Base or only Top set"
                        onClick={() => {
                          const current = pick.size_variants || [];
                          const bases = Array.from(new Set(current.map((v) => (v.base || "").trim()).filter(Boolean)));
                          const tops = Array.from(new Set(current.map((v) => (v.top || "").trim()).filter(Boolean)));
                          if (bases.length === 0 || tops.length === 0) {
                            toast({ title: "Need at least 1 Base and 1 Top", description: "Add some rows with Base and Top filled in, then click Build matrix.", variant: "destructive" });
                            return;
                          }
                          // Preserve any existing prices for matching combos
                          const priceMap = new Map<string, number>();
                          current.forEach((v) => {
                            if (v.base && v.top) priceMap.set(`${v.base}|${v.top}`, v.price_cents || 0);
                          });
                          const matrix = bases.flatMap((b) =>
                            tops.map((t) => ({ base: b, top: t, price_cents: priceMap.get(`${b}|${t}`) || 0 }))
                          );
                          updateField(pick.id, "size_variants", matrix as any);
                          toast({ title: "Matrix built", description: `${bases.length} bases × ${tops.length} tops = ${matrix.length} rows` });
                        }}
                      >
                        Build matrix
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        title="Match each variant against gallery image filenames and auto-assign Image #"
                        onClick={() => {
                          const variants = pick.size_variants || [];
                          const gallery = pick.gallery_images || [];
                          if (variants.length === 0 || gallery.length === 0) {
                            toast({ title: "Nothing to match", description: "Add gallery images and at least one variant row first.", variant: "destructive" });
                            return;
                          }
                          const normTokens = (s: string) =>
                            s.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((t) => t.length >= 3);
                          const galleryTokens = gallery.map((url) => {
                            const file = (url.split("/").pop() || "").replace(/\.[a-z0-9]+$/i, "");
                            return new Set(normTokens(file));
                          });
                          // Start fresh — drop stale keys (e.g. from when keys were derived from Base only)
                          const nextMap: Record<string, number> = {};
                          let assigned = 0;
                          let sequentialAssigned = 0;
                          for (const [variantIdx, v] of variants.entries()) {
                            const baseTrim = (v.base || "").trim();
                            const topTrim = (v.top || "").trim();
                            const labelTrim = (v.label || "").trim();
                            const key = variantImageKey(baseTrim, topTrim, labelTrim, labelTrim);
                            // Match against the full row identity so rows with the same
                            // Base × Top but different dimensions/concepts map separately.
                            const labelSrc = [baseTrim, topTrim, labelTrim].filter(Boolean).join(" ");
                            if (!key || !labelSrc) continue;
                            const tokens = normTokens(labelSrc);
                            if (tokens.length === 0) continue;
                            let bestIdx = -1;
                            let bestScore = 0;
                            galleryTokens.forEach((gset, i) => {
                              const score = tokens.reduce((acc, t) => acc + (gset.has(t) ? 1 : 0), 0);
                              if (score > bestScore) { bestScore = score; bestIdx = i; }
                            });
                            const fallbackIdx = variantIdx < gallery.length ? variantIdx : -1;
                            const resolvedIdx = bestIdx >= 0 && bestScore > 0 ? bestIdx : fallbackIdx;
                            if (resolvedIdx >= 0) {
                              nextMap[key] = resolvedIdx;
                              assigned++;
                              if (bestScore === 0) sequentialAssigned++;
                            }
                          }
                          updateField(pick.id, "variant_image_map", Object.keys(nextMap).length ? nextMap : null);
                          toast({
                            title: assigned > 0 ? "Images auto-filled" : "No matches found",
                            description: assigned > 0
                              ? `${assigned} variant(s) mapped${sequentialAssigned ? `, including ${sequentialAssigned} by row order` : " by filename token match"}.`
                              : "Couldn't map variants because there are more rows than gallery images.",
                            variant: assigned > 0 ? "default" : "destructive",
                          });
                        }}
                      >
                        Auto-fill Image #
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px]"
                        title="Pull Base axis options from Fabrics & Finishes library (matched by designer/brand name)"
                        onClick={() => setSyncPickId(pick.id)}
                      >
                        Sync Base from Library
                      </Button>
                    </div>
                  </div>
                  <SwatchSyncDialog
                    open={syncPickId === pick.id}
                    onOpenChange={(v) => setSyncPickId(v ? pick.id : null)}
                    designerName={designerName}
                    currentVariants={pick.size_variants || []}
                    currentBaseAxisLabel={pick.base_axis_label}
                    onApply={(merged, nextBaseLabel) => {
                      updateField(pick.id, "size_variants", merged as any);
                      if (nextBaseLabel !== pick.base_axis_label) {
                        updateField(pick.id, "base_axis_label", nextBaseLabel as any);
                      }
                      toast({ title: "Base axis synced", description: `${merged.length} variant row(s) generated.` });
                    }}
                  />
                  <p className="text-[10px] text-muted-foreground italic leading-snug">
                    For a single dropdown (size only), fill <em>Label</em> + <em>Price</em>. For two dropdowns (e.g. Base × Top finish), fill <em>Base</em> and <em>Top</em>; the product sheet will render two selectors and price by combination.
                  </p>
                  <p className="text-[10px] text-muted-foreground italic">
                    <strong>Image #</strong>: optional. Enter the gallery image number (1, 2, 3…) that should appear when this finish/size is selected. Leave blank to keep the current image.
                  </p>
                  {(pick.size_variants || []).length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">
                      No variants. The Default RRP above will be used.
                    </p>
                  )}
                  {(pick.size_variants || []).length > 0 && (
                    <div className="grid grid-cols-[2.25rem_1fr_1fr_1fr_7rem_4rem_1.75rem] gap-1.5 items-center text-[9px] uppercase tracking-wider text-muted-foreground/70">
                      <span className="text-center">Order</span>
                      <span>Label / Size</span>
                      <span>{pick.base_axis_label || "Base"}</span>
                      <span>{pick.top_axis_label || "Top"}</span>
                      <span>Price ({pick.currency || "EUR"})</span>
                      <span>Image #</span>
                      <span></span>
                    </div>
                  )}
                  {(pick.size_variants || []).map((variant, idx) => {
                    const galleryCount = (pick.gallery_images || []).length;
                    const baseTrim = variant.base?.trim() || "";
                    const topTrim = variant.top?.trim() || "";
                    const labelTrim = variant.label?.trim() || "";
                    // Prefer the full Base × Top × Label key so rows that share the
                    // same finishes but have different dimensions/concepts do not collide.
                    const isTriple = Boolean(baseTrim && topTrim && labelTrim);
                    const isComposite = Boolean(baseTrim && topTrim);
                    const keySource: "Base × Top × Label" | "Base × Top" | "Top" | "Base" | "Label" | null =
                      isTriple ? "Base × Top × Label"
                      : isComposite ? "Base × Top"
                      : topTrim ? "Top"
                      : baseTrim ? "Base"
                      : labelTrim ? "Label"
                      : null;
                    const mapKey = variantImageKey(baseTrim, topTrim, labelTrim, labelTrim);
                    const keyDisplay = isTriple
                      ? mapKey.replace(/\|/g, " | ")
                      : isComposite
                        ? mapKey.replace(/\|/g, " | ")
                      : mapKey;
                    const currentImageIdx = mapKey && pick.variant_image_map
                      ? pick.variant_image_map[mapKey]
                      : undefined;
                    const currentImageNum = typeof currentImageIdx === "number" ? currentImageIdx + 1 : "";
                    return (
                    <div key={idx} className="space-y-1">
                    <div className="grid grid-cols-[2.25rem_1fr_1fr_1fr_7rem_4rem_1.75rem] gap-1.5 items-center">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-3.5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === 0}
                          title="Move up"
                          onClick={() => {
                            const updated = [...(pick.size_variants || [])];
                            if (idx <= 0 || idx >= updated.length) return;
                            [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
                            updateField(pick.id, "size_variants", updated as any);
                          }}
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-3.5 w-5 p-0 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          disabled={idx === (pick.size_variants || []).length - 1}
                          title="Move down"
                          onClick={() => {
                            const updated = [...(pick.size_variants || [])];
                            if (idx < 0 || idx >= updated.length - 1) return;
                            [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
                            updateField(pick.id, "size_variants", updated as any);
                          }}
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <Input
                        value={variant.label || ""}
                        onChange={(e) => {
                          const updated = [...(pick.size_variants || [])];
                          updated[idx] = { ...variant, label: e.target.value };
                          updateField(pick.id, "size_variants", updated as any);
                        }}
                        placeholder="e.g. M 130"
                        className="text-xs h-8"
                      />
                      <Input
                        value={variant.base || ""}
                        onChange={(e) => {
                          const updated = [...(pick.size_variants || [])];
                          updated[idx] = { ...variant, base: e.target.value };
                          updateField(pick.id, "size_variants", updated as any);
                        }}
                        placeholder="e.g. Brass"
                        className="text-xs h-8"
                      />
                      <Input
                        value={variant.top || ""}
                        onChange={(e) => {
                          const updated = [...(pick.size_variants || [])];
                          updated[idx] = { ...variant, top: e.target.value };
                          updateField(pick.id, "size_variants", updated as any);
                        }}
                        placeholder="e.g. Carrara"
                        className="text-xs h-8"
                      />
                      {(() => {
                        const computedCents = (isRugCategory(pick.category) && pick.price_per_sqm_cents)
                          ? priceRugVariantFromLabel(variant.base || variant.label || "", pick.price_per_sqm_cents)
                          : null;
                        const placeholderText = computedCents
                          ? `${(computedCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })} (auto)`
                          : "0.00";
                        return (
                          <Input
                            type="number"
                            step="0.01"
                            value={variant.price_cents ? (variant.price_cents / 100).toString() : ""}
                            onChange={(e) => {
                              const updated = [...(pick.size_variants || [])];
                              const num = parseFloat(e.target.value);
                              updated[idx] = { ...variant, price_cents: Number.isFinite(num) ? Math.round(num * 100) : 0 };
                              updateField(pick.id, "size_variants", updated as any);
                            }}
                            placeholder={placeholderText}
                            title={computedCents ? "Auto-computed from Price / m² × size. Leave blank to use this value, or type to override." : undefined}
                            className={cn("text-xs h-8", computedCents && !variant.price_cents && "text-muted-foreground italic")}
                          />
                        );
                      })()}
                      <Input
                        type="number"
                        min={1}
                        max={galleryCount || undefined}
                        value={currentImageNum}
                        onChange={(e) => {
                          if (!mapKey) return;
                          const next = { ...(pick.variant_image_map || {}) };
                          const raw = e.target.value.trim();
                          if (raw === "") {
                            delete next[mapKey];
                          } else {
                            const n = parseInt(raw, 10);
                            if (Number.isFinite(n) && n >= 1) next[mapKey] = n - 1;
                          }
                          updateField(pick.id, "variant_image_map", Object.keys(next).length ? next : null);
                        }}
                        placeholder="—"
                        title={mapKey ? `Mapped key: ${mapKey}` : "Fill Base or Label first"}
                        disabled={!mapKey}
                        className="text-xs h-8"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                        title="Duplicate this row (then edit frame and/or size)"
                        onClick={() => {
                          const updated = [...(pick.size_variants || [])];
                          updated.splice(idx + 1, 0, { ...variant });
                          updateField(pick.id, "size_variants", updated as any);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive"
                        onClick={() => {
                          const updated = (pick.size_variants || []).filter((_, i) => i !== idx);
                          updateField(pick.id, "size_variants", updated as any);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Image key preview — shows which field drives the variant_image_map lookup */}
                    <div className="pl-1 text-[10px] flex flex-wrap items-center gap-1.5 text-muted-foreground/80">
                      <span className="uppercase tracking-wider">Image key:</span>
                      {keySource ? (
                        <>
                          <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground/80">
                            {keySource}
                          </span>
                          <span className="text-muted-foreground">→</span>
                          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">
                            {keyDisplay || "(empty)"}
                          </code>
                          {typeof currentImageIdx === "number" ? (
                            <span className="text-muted-foreground">
                              (image #{currentImageIdx + 1})
                            </span>
                          ) : (
                            <span className="italic text-muted-foreground/60">unmapped</span>
                          )}
                        </>
                      ) : (
                        <span className="italic text-muted-foreground/60">
                          Fill Top, Base, or Label to enable mapping
                        </span>
                      )}
                    </div>
                    </div>
                    );
                  })}
                </div>
                <ProductFabricsPanel pickId={pick.id} currency={pick.currency} />

                <div>
                  <label className="text-[10px] text-muted-foreground">Description</label>
                  <Textarea value={pick.description || ""} onChange={(e) => updateField(pick.id, "description", e.target.value || null)} className="text-xs min-h-[60px]" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground font-medium">Spec Sheets / PDFs</label>
                  {/* Legacy single PDF */}
                  {pick.pdf_url && !(pick.pdf_urls && pick.pdf_urls.length > 0) && (
                    <div className="flex items-center gap-2">
                      <Input value={pick.pdf_url} onChange={(e) => updateField(pick.id, "pdf_url", e.target.value || null)} placeholder="PDF URL" className="text-xs flex-1" />
                      <Input value={pick.pdf_filename || ""} onChange={(e) => updateField(pick.id, "pdf_filename", e.target.value || null)} placeholder="Filename" className="text-xs w-36" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
                        // Migrate to pdf_urls
                        const entries: PdfEntry[] = [{ label: pick.pdf_filename || "Spec Sheet", url: pick.pdf_url! }];
                        updateField(pick.id, "pdf_urls", entries);
                        updateField(pick.id, "pdf_url", null);
                        updateField(pick.id, "pdf_filename", null);
                      }}><span className="text-[9px]">→ multi</span></Button>
                    </div>
                  )}
                  {/* Multi-PDF list */}
                  {(pick.pdf_urls || []).map((entry: PdfEntry, idx: number) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input value={entry.label} onChange={(e) => {
                        const updated = [...(pick.pdf_urls || [])];
                        updated[idx] = { ...entry, label: e.target.value };
                        updateField(pick.id, "pdf_urls", updated);
                      }} placeholder="Label (e.g. Small Lamp)" className="text-xs w-32" />
                      <Input value={entry.url} onChange={(e) => {
                        const updated = [...(pick.pdf_urls || [])];
                        updated[idx] = { ...entry, url: e.target.value };
                        updateField(pick.id, "pdf_urls", updated);
                      }} placeholder="PDF URL" className="text-xs flex-1" />
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive" onClick={() => {
                        const updated = (pick.pdf_urls || []).filter((_: PdfEntry, i: number) => i !== idx);
                        updateField(pick.id, "pdf_urls", updated.length ? updated : null);
                      }}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="text-[10px] h-6" onClick={() => {
                    const current = pick.pdf_urls || [];
                    updateField(pick.id, "pdf_urls", [...current, { label: "", url: "" }]);
                  }}>
                    <Plus className="w-3 h-3 mr-1" /> Add PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={handleAdd}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Pick
        </Button>
        <CsvBulkUpload
          designerId={designerId}
          designerName={designerName}
          currentCount={picks.length}
          onComplete={() => {
            void loadPicks();
          }}
        />
      </div>
    </div>
  );
}

/** Inline Instagram post manager for each designer */
function InstagramPostManager({ designerId, instagramUrls = [] }: { designerId: string; instagramUrls?: string[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [posts, setPosts] = useState<{ id: string; post_url: string; caption: string | null; sort_order: number; image_url: string | null }[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const bulkTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Persist bulk-import draft per designer so navigating away (or a preview
  // refresh) doesn't wipe URLs the user is still collecting. Cleared on
  // successful import or explicit Cancel.
  const bulkDraftKey = `ig-bulk-draft:${designerId}`;
  const readBulkDraft = useCallback(() => {
    try {
      return localStorage.getItem(bulkDraftKey) || sessionStorage.getItem(bulkDraftKey) || "";
    } catch {
      return "";
    }
  }, [bulkDraftKey]);
  const writeBulkDraft = useCallback((value: string) => {
    try {
      if (value) {
        localStorage.setItem(bulkDraftKey, value);
        sessionStorage.setItem(bulkDraftKey, value);
      } else {
        localStorage.removeItem(bulkDraftKey);
        sessionStorage.removeItem(bulkDraftKey);
      }
    } catch { /* storage full / disabled */ }
  }, [bulkDraftKey]);
  const [bulkMode, setBulkMode] = useState(() => {
    try { return !!(localStorage.getItem(bulkDraftKey) || sessionStorage.getItem(bulkDraftKey)); } catch { return false; }
  });
  const [bulkText, setBulkText] = useState(() => readBulkDraft());
  const updateBulkText = useCallback((value: string) => {
    setBulkText(value);
    writeBulkDraft(value);
  }, [writeBulkDraft]);
  useEffect(() => {
    writeBulkDraft(bulkText);
  }, [bulkText, writeBulkDraft]);
  useEffect(() => {
    const persistFromDom = () => writeBulkDraft(bulkTextareaRef.current?.value || bulkText);
    window.addEventListener("pagehide", persistFromDom);
    window.addEventListener("beforeunload", persistFromDom);
    return () => {
      window.removeEventListener("pagehide", persistFromDom);
      window.removeEventListener("beforeunload", persistFromDom);
    };
  }, [bulkText, writeBulkDraft]);
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const [fetchingAll, setFetchingAll] = useState(false);

  const needsHostedImage = (imageUrl: string | null) =>
    !imageUrl || /cdninstagram\.com|fbcdn\.net/i.test(imageUrl) || imageUrl.includes("&amp;");

  const hostedImageTargets = posts.filter((p) => needsHostedImage(p.image_url));

  const extractImageForPost = async (postId: string, postUrl: string): Promise<string | null> => {
    setFetchingIds((prev) => new Set(prev).add(postId));
    try {
      const { data, error } = await supabase.functions.invoke("extract-instagram-image", {
        body: { url: postUrl, postId },
      });
      if (error || !data?.success) {
        toast({
          title: "Could not extract image",
          description: data?.error || error?.message || "Try pasting the URL manually",
          variant: "destructive",
        });
        return null;
      }
      const imageUrl = data.imageUrl as string;
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, image_url: imageUrl } : p)));
      queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
      return imageUrl;
    } finally {
      setFetchingIds((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
    }
  };

  const handleFetchAll = async () => {
    const targets = posts.filter((p) => needsHostedImage(p.image_url));
    if (!targets.length) {
      toast({ title: "All posts already use hosted images" });
      return;
    }
    setFetchingAll(true);
    let fetched = 0;
    for (const post of targets) {
      const result = await extractImageForPost(post.id, post.post_url);
      if (result) fetched++;
    }
    setFetchingAll(false);
    queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
    toast({ title: `Refreshed ${fetched} of ${targets.length} images` });
  };

  // Extract handles from Instagram URLs
  const handles = instagramUrls.map((url) => {
    const match = url.match(/instagram\.com\/([^/?]+)/);
    return match ? match[1] : null;
  }).filter(Boolean) as string[];

  useEffect(() => {
    supabase
      .from("designer_instagram_posts" as any)
      .select("*")
      .eq("designer_id", designerId)
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        setPosts((data as any[]) || []);
        setLoaded(true);
      });
  }, [designerId]);

  const handleAdd = async () => {
    const url = newUrl.trim();
    if (!url) return;
    const order = posts.length;
    const { data, error } = await (supabase.from("designer_instagram_posts" as any) as any)
      .insert({ designer_id: designerId, post_url: url, sort_order: order })
      .select()
      .single();
    if (error) {
      toast({ title: "Failed to add", description: error.message, variant: "destructive" });
    } else if (data) {
      setPosts((prev) => [...prev, data as any]);
      setNewUrl("");
      queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
    }
  };

  const [bulkImporting, setBulkImporting] = useState(false);

  const handleBulkAdd = async () => {
    const urls = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.includes("instagram.com"));
    if (!urls.length) {
      toast({ title: "No valid URLs found", description: "Paste Instagram post URLs, one per line.", variant: "destructive" });
      return;
    }
    setBulkImporting(true);
    let startOrder = posts.length;
    const rows = urls.map((url, i) => ({
      designer_id: designerId,
      post_url: url,
      sort_order: startOrder + i,
    }));
    const { data, error } = await (supabase.from("designer_instagram_posts" as any) as any)
      .insert(rows)
      .select();
    if (error) {
      toast({ title: "Bulk import failed", description: error.message, variant: "destructive" });
      setBulkImporting(false);
      return;
    }
    if (!data) {
      setBulkImporting(false);
      return;
    }
    const newPosts = data as any[];
    setPosts((prev) => [...prev, ...newPosts]);
    updateBulkText("");
    setBulkMode(false);
    queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
    toast({ title: `${newPosts.length} posts added — auto-fetching images…` });

    // Immediately auto-fetch images for all new posts
    let fetched = 0;
    for (const post of newPosts) {
      const result = await extractImageForPost(post.id, post.post_url);
      if (result) fetched++;
    }
    setBulkImporting(false);
    queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
    toast({ title: `Fetched ${fetched} of ${newPosts.length} images` });
  };
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Instagram post? This action cannot be undone.")) return;
    await (supabase.from("designer_instagram_posts" as any) as any).delete().eq("id", id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
    queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
  };

  const handleCaptionChange = async (id: string, caption: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, caption: caption || null } : p)));
    await (supabase.from("designer_instagram_posts" as any) as any).update({ caption: caption || null }).eq("id", id);
  };

  const handleImageUrlChange = async (id: string, imageUrl: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, image_url: imageUrl || null } : p)));
    await (supabase.from("designer_instagram_posts" as any) as any).update({ image_url: imageUrl || null }).eq("id", id);
  };

  const handlePostUrlChange = async (id: string, postUrl: string) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, post_url: postUrl } : p)));
    await (supabase.from("designer_instagram_posts" as any) as any).update({ post_url: postUrl }).eq("id", id);
  };

  const handleMovePost = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= posts.length) return;
    const updated = [...posts];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    const reordered = updated.map((p, i) => ({ ...p, sort_order: i }));
    setPosts(reordered);
    for (const p of reordered) {
      await (supabase.from("designer_instagram_posts" as any) as any)
        .update({ sort_order: p.sort_order })
        .eq("id", p.id);
    }
    queryClient.invalidateQueries({ queryKey: ["designer-instagram-posts", designerId] });
  };

  if (!loaded) return null;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Instagram className="w-3.5 h-3.5" />
        Instagram Posts
        {handles.length > 0 && (
          <span className="normal-case font-normal flex items-center gap-1.5 ml-1">
            —
            {handles.map((handle) => (
              <a
                key={handle}
                href={`https://www.instagram.com/${handle}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-normal"
              >
                @{handle}
              </a>
            ))}
          </span>
        )}
        {handles.length === 0 && (
          <span className="normal-case font-normal">(curated posts displayed on the designer profile)</span>
        )}
      </label>
      <div className="mt-2 mb-1 flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleFetchAll}
          disabled={fetchingAll || posts.length === 0}
          className="text-xs gap-1.5"
        >
          {fetchingAll ? <DotCircleLoader size="sm" /> : <Wand2 className="w-3 h-3" />}
          {fetchingAll
            ? "Refreshing\u2026"
            : posts.length === 0
              ? "Auto-fetch images"
              : hostedImageTargets.length > 0
                ? `Auto-fetch ${hostedImageTargets.length} image${hostedImageTargets.length > 1 ? "s" : ""}`
                : `Refresh all ${posts.length} image${posts.length > 1 ? "s" : ""}`}
        </Button>
        {posts.length === 0 && (
          <span className="text-xs text-muted-foreground">Add post URLs below (single or bulk), then click Auto-fetch to pull thumbnails automatically.</span>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {posts.map((post) => (
          <div key={post.id} className="flex flex-wrap items-start gap-2 rounded-md border border-border/60 p-2">
            <div className="flex flex-col gap-0.5 shrink-0 mt-1">
              <button
                onClick={() => handleMovePost(posts.indexOf(post), "up")}
                disabled={posts.indexOf(post) === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"
                title="Move up"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleMovePost(posts.indexOf(post), "down")}
                disabled={posts.indexOf(post) === posts.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors p-0.5"
                title="Move down"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
            {post.image_url && (
              <img src={post.image_url} alt="" className="w-10 h-10 object-cover rounded shrink-0 mt-0.5" />
            )}
            <div className="flex items-center gap-1 min-w-[120px] max-w-[300px] flex-1 mt-0.5">
              <Input
                value={post.post_url}
                onChange={(e) => handlePostUrlChange(post.id, e.target.value)}
                placeholder="https://www.instagram.com/p/..."
                className="text-[10px] flex-1"
              />
              <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <Input
              value={post.image_url || ""}
              onChange={(e) => handleImageUrlChange(post.id, e.target.value)}
              placeholder="Image URL"
              className="text-xs min-w-[220px] flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => extractImageForPost(post.id, post.post_url)}
              disabled={fetchingIds.has(post.id)}
              className="h-9 shrink-0 gap-1.5 text-xs"
              title={needsHostedImage(post.image_url) ? "Fetch hosted image" : "Refresh hosted image"}
            >
              {fetchingIds.has(post.id) ? <DotCircleLoader size="sm" className="w-3.5 h-3.5" /> : <Wand2 className="w-3.5 h-3.5" />}
              {needsHostedImage(post.image_url) ? "Auto-fetch" : "Refresh"}
            </Button>
            <Input
              value={post.caption || ""}
              onChange={(e) => handleCaptionChange(post.id, e.target.value)}
              placeholder="Caption"
              className="text-xs w-32 min-w-[140px]"
            />
            <button
              onClick={() => handleDelete(post.id)}
              className="text-muted-foreground hover:text-destructive transition-colors p-1 mt-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {bulkMode ? (
          <div className="space-y-2">
            <textarea
              ref={bulkTextareaRef}
              value={bulkText}
              onChange={(e) => updateBulkText(e.target.value)}
              onInput={(e) => writeBulkDraft(e.currentTarget.value)}
              placeholder={"Paste Instagram post URLs, one per line:\nhttps://www.instagram.com/p/ABC123/\nhttps://www.instagram.com/p/DEF456/"}
              className="w-full text-xs border rounded-md p-2 h-24 resize-y bg-background text-foreground"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkAdd} disabled={!bulkText.trim() || bulkImporting} className="text-xs h-8 gap-1.5">
                {bulkImporting ? <DotCircleLoader size="sm" /> : <Plus className="w-3 h-3" />}
                {bulkImporting ? "Importing & fetching images…" : "Import & Auto-fetch"}
              </Button>
              <button onClick={() => { setBulkMode(false); updateBulkText(""); }} className="text-xs text-muted-foreground hover:text-foreground" disabled={bulkImporting}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/..."
              className="text-xs flex-1"
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
            />
            <Button size="sm" variant="outline" onClick={handleAdd} disabled={!newUrl.trim()} className="text-xs h-8">
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
            <button onClick={() => setBulkMode(true)} className="text-xs text-muted-foreground hover:text-primary whitespace-nowrap">
              Bulk import
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
interface DesignerRow {
  id: string;
  slug: string;
  name: string;
  display_name: string | null;
  specialty: string;
  biography: string;
  philosophy: string;
  notable_works: string;
  image_url: string;
  hero_image_url: string | null;
  source: string;
  is_published: boolean;
  trade_only: boolean;
  biography_images: string[];
  links: Record<string, string> | null;
  instagram_handle: string | null;
  instagram_handle_2: string | null;
}

const DESIGNER_EDITOR_DRAFT_KEY = "ma-designer-editor-draft-v2";

type DesignerEditorDraft = {
  search: string;
  activeLetter: string | null;
  expandedId: string | null;
  editBuffer: Record<string, Partial<DesignerRow>>;
  previewId: string | null;
  previewMobile: boolean;
  previewDebug: boolean;
  updatedAt: number;
};

const readDesignerEditorDraft = (): Partial<DesignerEditorDraft> => {
  if (typeof window === "undefined") return {};
  try {
    // Prefer localStorage (survives tab close + hard reloads); fall back to
    // sessionStorage for drafts saved by older builds.
    const raw =
      localStorage.getItem(DESIGNER_EDITOR_DRAFT_KEY) ||
      sessionStorage.getItem(DESIGNER_EDITOR_DRAFT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};


const TradeDesignersAdmin = () => {
  const { isAdmin, isSuperAdmin, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [initialDraft] = useState<Partial<DesignerEditorDraft>>(() => readDesignerEditorDraft());

  const [search, setSearch] = useState(initialDraft.search ?? "");
  const [activeLetter, setActiveLetter] = useState<string | null>(initialDraft.activeLetter ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(initialDraft.expandedId ?? null);
  const [editBuffer, setEditBuffer] = useState<Record<string, Partial<DesignerRow>>>(initialDraft.editBuffer ?? {});
  const [previewId, setPreviewId] = useState<string | null>(initialDraft.previewId ?? null);
  const [previewMobile, setPreviewMobile] = useState(initialDraft.previewMobile ?? false);
  const [previewDebug, setPreviewDebug] = useState(initialDraft.previewDebug ?? false);

  useEffect(() => {
    const hasUnsaved = Object.keys(editBuffer).length > 0;

    const persistDraft = () => {
      if (typeof window === "undefined") return;
      const hasState =
        search.trim() !== "" ||
        activeLetter !== null ||
        expandedId !== null ||
        previewId !== null ||
        previewMobile ||
        previewDebug ||
        hasUnsaved;

      try {
        if (!hasState) {
          localStorage.removeItem(DESIGNER_EDITOR_DRAFT_KEY);
          sessionStorage.removeItem(DESIGNER_EDITOR_DRAFT_KEY);
          return;
        }

        const payload = JSON.stringify({
          search,
          activeLetter,
          expandedId,
          editBuffer,
          previewId,
          previewMobile,
          previewDebug,
          updatedAt: Date.now(),
        } satisfies DesignerEditorDraft);

        // Write to BOTH stores: localStorage survives reloads / new-build
        // banners / accidental tab closes; sessionStorage keeps per-tab
        // isolation for restoration when reopening the same tab.
        localStorage.setItem(DESIGNER_EDITOR_DRAFT_KEY, payload);
        sessionStorage.setItem(DESIGNER_EDITOR_DRAFT_KEY, payload);
      } catch {
        /* keep editing even if browser storage is unavailable */
      }
    };

    persistDraft();
    window.addEventListener("pagehide", persistDraft);

    // Warn the user before any reload / tab close / navigation away while
    // they have unsaved edits in the buffer. This catches the case where
    // the build-update banner, an OS-level refresh, or a stray Cmd+R would
    // otherwise wipe in-progress work (e.g. a bulk Instagram import).
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsaved) return;
      persistDraft();
      e.preventDefault();
      // Required for Chrome to actually show the prompt.
      e.returnValue = "";
    };
    if (hasUnsaved) {
      window.addEventListener("beforeunload", onBeforeUnload);
    }

    return () => {
      window.removeEventListener("pagehide", persistDraft);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [search, activeLetter, expandedId, editBuffer, previewId, previewMobile, previewDebug]);


  // After data loads on mount, scroll the previously expanded row back into view
  const didRestoreScrollRef = useRef(false);

  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["admin-designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, display_name, specialty, biography, philosophy, notable_works, image_url, hero_image_url, source, is_published, trade_only, biography_images, links, instagram_handle, instagram_handle_2")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DesignerRow[];
    },
    enabled: !!isAdmin,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // Once designers are loaded, scroll the previously expanded row into view
  // so returning from another page lands you exactly where you left off.
  useEffect(() => {
    if (didRestoreScrollRef.current) return;
    if (!expandedId || designers.length === 0) return;
    didRestoreScrollRef.current = true;
    // Wait a tick for the accordion content to render before scrolling.
    const t = window.setTimeout(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-designer-row-id="${expandedId}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });
        // Nudge up a bit so the row header isn't glued to the top edge.
        window.scrollBy({ top: -80, behavior: "instant" as ScrollBehavior });
      }
    }, 120);
    return () => window.clearTimeout(t);
  }, [designers.length, expandedId]);

  // Fetch public picks count per designer for debug counter
  const { data: picksCountMap = {} } = useQuery({
    queryKey: ["admin-public-picks-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks_public")
        .select("designer_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((row) => {
        if (row.designer_id) counts[row.designer_id] = (counts[row.designer_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!isAdmin,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: pickSearchMap = {} } = useQuery({
    queryKey: ["admin-pick-search-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select("designer_id, title, subtitle");
      if (error) throw error;
      return ((data || []) as { designer_id: string | null; title: string | null; subtitle: string | null }[]).reduce<Record<string, string>>(
        (acc, row) => {
          if (!row.designer_id) return acc;
          acc[row.designer_id] = [acc[row.designer_id], row.title, row.subtitle].filter(Boolean).join(" ");
          return acc;
        },
        {},
      );
    },
    enabled: !!isAdmin,
    staleTime: 5 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<DesignerRow> }) => {
      const payload = { ...updates, updated_at: new Date().toISOString() };
      // Filter out empty strings from biography_images before saving
      if (payload.biography_images) {
        payload.biography_images = payload.biography_images.filter((u: string) => u.trim() !== "");
      }
      const { error } = await supabase
        .from("designers")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
      return { id, payload };
    },
    onSuccess: async ({ id, payload }) => {
      // Optimistically patch the query cache so the UI never loses data
      queryClient.setQueryData<DesignerRow[]>(["admin-designers"], (old) =>
        old?.map((d) => (d.id === id ? { ...d, ...payload } : d))
      );
      toast({ title: "Saved", description: "Designer updated successfully." });
      // Wait for refetch to complete before clearing buffer, so fresh server
      // data is available and the UI never falls back to stale cached values
      await queryClient.invalidateQueries({ queryKey: ["admin-designers"] });
      // Clear the edit buffer only after the refetch has landed
      setEditBuffer((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = useMemo(() => {
    let list = designers;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          (d.display_name?.toLowerCase().includes(q)) ||
          d.specialty.toLowerCase().includes(q) ||
          (pickSearchMap[d.id]?.toLowerCase().includes(q) ?? false)
      );
    }
    if (activeLetter) {
      list = list.filter((d) => d.name[0]?.toUpperCase() === activeLetter);
    }
    return list;
  }, [designers, search, activeLetter, pickSearchMap]);

  const letterCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    designers.forEach((d) => {
      const letter = d.name[0]?.toUpperCase();
      if (letter) counts[letter] = (counts[letter] || 0) + 1;
    });
    return counts;
  }, [designers]);

  // Detect broken/missing/duplicate slugs (read-only audit, never auto-mutates)
  const slugHealthMap = useSlugHealthMap(designers);

  const getField = useCallback(
    (id: string, field: keyof DesignerRow) => {
      return (editBuffer[id]?.[field] ?? designers.find((d) => d.id === id)?.[field]) as string;
    },
    [editBuffer, designers]
  );

  const setField = useCallback(<K extends keyof DesignerRow>(id: string, field: K, value: DesignerRow[K]) => {
    setEditBuffer((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  const hasChanges = (id: string) => !!editBuffer[id] && Object.keys(editBuffer[id]).length > 0;

  /* ── Sub-component: Biography preview with duplicate-media warning ── */
  const PreviewWithDuplicateCheck = useCallback(
    ({ designer, editBuffer: eb, previewMobile: pm, previewDebug: pd, getField: gf }: {
      designer: DesignerRow;
      editBuffer: Record<string, Partial<DesignerRow>>;
      previewMobile: boolean;
      previewDebug: boolean;
      getField: (id: string, field: keyof DesignerRow) => string;
    }) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const { data: curatorPicks = [] } = useQuery({
        queryKey: ["admin-designer-picks", designer.id],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("designer_curator_picks")
            .select("id, image_url, title")
            .eq("designer_id", designer.id);
          if (error) throw error;
          return data || [];
        },
      });

      const bioText = gf(designer.id, "biography") || "";
      const bioImages = (eb[designer.id]?.biography_images ?? designer.biography_images) || [];

      // Collect all bio media URLs (manual + inline)
      const bioUrls = new Set<string>();
      bioImages.forEach((raw: string) => {
        const url = raw.split("|")[0].trim();
        if (url) bioUrls.add(url);
      });
      // Extract inline URLs from biography text
      bioText.split("\n").forEach((line: string) => {
        const trimmed = line.trim();
        if (/^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|mp4|mov)/i.test(trimmed)) {
          bioUrls.add(trimmed.split("|")[0].trim());
        }
      });

      // Find duplicates
      const duplicates = curatorPicks.filter((p) => bioUrls.has(p.image_url));

      return (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-background overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
              Editorial render preview
            </p>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                <button
                  onClick={() => setPreviewMobile(false)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    !pm ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Monitor className="w-3 h-3" /> Desktop
                </button>
                <button
                  onClick={() => setPreviewMobile(true)}
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                    pm ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Smartphone className="w-3 h-3" /> Mobile
                </button>
              </div>
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Debug media order
                <Switch checked={pd} onCheckedChange={setPreviewDebug} />
              </label>
            </div>
          </div>

          {duplicates.length > 0 && (
            <div className="mx-4 mb-2 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">{duplicates.length} image{duplicates.length > 1 ? "s" : ""} also used in Curators&apos; Picks</span>
                {" — "}these will be deprioritised in the grid.
                <ul className="mt-1 list-disc pl-4 text-[11px] opacity-80">
                  {duplicates.map((p) => (
                    <li key={p.id} className="truncate max-w-sm">
                      <a
                        href={`/designers/${designer.slug}?highlight=${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-amber-400 underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 transition-colors cursor-pointer"
                      >
                        {p.title} <ExternalLink className="w-2.5 h-2.5 inline-block ml-0.5" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className={cn(
            "mx-auto p-4 transition-all duration-300",
            pm ? "max-w-[375px] border-x border-border" : "max-w-none"
          )}>
            <Suspense fallback={<div className="h-20 flex items-center justify-center text-xs text-muted-foreground">Loading…</div>}>
              <EditorialBiography
                biography={bioText}
                biographyImages={bioImages}
                pickImages={[]}
                designerName={designer.name}
                debugMediaOrder={pd}
              />
            </Suspense>
          </div>
        </div>
      );
    },
    [setPreviewMobile, setPreviewDebug]
  );

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
            You're signed in but your account doesn't have the <code>admin</code> role,
            so the Designer Editor can't load. In production you'd be redirected to{" "}
            <code>/trade</code>; in the preview we show this message instead so the page
            isn't silently blank.
          </p>
        </div>
      );
    }
    return <Navigate to="/trade" replace />;
  }

  return (
    <>
      <Helmet>
        <title>Designer Editor — Trade Admin</title>
      </Helmet>

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl tracking-wide">Designer Editor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {designers.length} designers · Search, filter, and edit biographies inline.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(() => {
              const expanded = designers.find((d) => d.id === expandedId);
              if (!expanded) {
                return (
                  <span
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-border text-xs font-body text-muted-foreground/70"
                    title="Expand a designer accordion below to enable the biography PDF download"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Biography PDF
                  </span>
                );
              }
              const merged = { ...expanded, ...(editBuffer[expanded.id] ?? {}) } as DesignerRow;
              return (
                <BiographyPdfButton
                  designerName={merged.display_name || merged.name}
                  specialty={merged.specialty}
                  philosophy={merged.philosophy ?? ""}
                  biography={merged.biography ?? ""}
                  biographyImages={(merged.biography_images as string[] | null) ?? []}
                  heroImageUrl={merged.hero_image_url ?? merged.image_url ?? null}
                  heroImageFallbackUrl={
                    merged.hero_image_url && merged.image_url && merged.hero_image_url !== merged.image_url
                      ? merged.image_url
                      : null
                  }
                  profileUrl={`https://www.maisonaffluency.com/designers/${merged.slug}`}
                />
              );
            })()}
            <Link
              to="/trade/designers/instagram"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-body text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
            >
              <Instagram className="h-3.5 w-3.5" />
              IG Audit
            </Link>
          </div>
        </div>

        {/* Completeness Audit */}
        <DesignerCompletenessAudit />


        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or specialty…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveLetter(null);
              }}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setActiveLetter(null)}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                !activeLetter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {ALPHABET.map((letter) => {
              const count = letterCounts[letter] || 0;
              return (
                <button
                  key={letter}
                  onClick={() => {
                    setActiveLetter(letter === activeLetter ? null : letter);
                    setSearch("");
                  }}
                  disabled={count === 0}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    activeLetter === letter
                      ? "bg-primary text-primary-foreground"
                      : count > 0
                      ? "bg-muted text-muted-foreground hover:text-foreground"
                      : "bg-muted/50 text-muted-foreground/30 cursor-not-allowed"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No designers match your search.</p>
        ) : (
          <div className="space-y-1">
            {filtered.map((d) => {
              const isOpen = expandedId === d.id;
              const dirty = hasChanges(d.id);

              return (
                <div
                  key={d.id}
                  data-designer-row-id={d.id}
                  className="border border-border rounded-sm overflow-hidden"
                >
                  {/* Row header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : d.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    {(d.image_url || d.hero_image_url) && (
                      <img
                        src={d.image_url || d.hero_image_url || ""}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0 bg-muted"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const img = e.currentTarget;
                          if (d.hero_image_url && img.src !== d.hero_image_url) {
                            img.src = d.hero_image_url;
                          } else {
                            img.style.visibility = "hidden";
                          }
                        }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm truncate">{d.display_name || d.name}</span>
                        <Badge variant={d.is_published ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                          {d.is_published ? "Published" : "Draft"}
                        </Badge>
                        {(picksCountMap[d.id] ?? 0) > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                            {picksCountMap[d.id]} picks
                          </Badge>
                        )}
                        {dirty && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-secondary text-secondary">
                            Unsaved
                          </Badge>
                        )}
                        {slugHealthMap.get(d.id) && (
                          <SlugHealthBadge
                            designer={d}
                            issue={slugHealthMap.get(d.id)!}
                            allDesigners={designers}
                          />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{d.specialty}</p>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {/* Expanded editor */}
                  {isOpen && (
                    <div className="border-t border-border px-4 py-4 space-y-4 bg-muted/10">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Biography</label>
                        <BiographyToolbar
                          textareaId={`bio-editor-${d.id}`}
                          value={getField(d.id, "biography")}
                          onChange={(v) => setField(d.id, "biography", v)}
                        />
                        <Textarea
                          id={`bio-editor-${d.id}`}
                          value={getField(d.id, "biography")}
                          onChange={(e) => setField(d.id, "biography", e.target.value)}
                          rows={10}
                          className="font-body text-sm font-mono"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Philosophy / Pull-quote</label>
                        <Textarea
                          value={getField(d.id, "philosophy")}
                          onChange={(e) => setField(d.id, "philosophy", e.target.value)}
                          rows={3}
                          className="mt-1 font-body text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Specialty</label>
                        <Input
                          value={getField(d.id, "specialty")}
                          onChange={(e) => setField(d.id, "specialty", e.target.value)}
                          className="mt-1 text-sm"
                        />
                      </div>

                      {/* Hero Image Override */}
                      {(() => {
                        const currentHero = (editBuffer[d.id]?.hero_image_url ?? d.hero_image_url) || "";
                        return (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Hero Image <span className="normal-case font-normal">(optional — overrides card image for the profile hero)</span>
                            </label>
                            <div className="mt-2 flex items-start gap-3">
                              <div className="w-32 h-20 rounded border border-border bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                                {currentHero ? (
                                  <img src={currentHero} alt="Hero preview" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[10px] text-muted-foreground text-center px-2">No hero set — card image will be used</span>
                                )}
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <CloudUpload
                                    folder={`designers/${d.slug || d.id}/hero`}
                                    accept="image/*"
                                    label="Upload Hero"
                                    onUpload={(urls) => {
                                      if (urls[0]) setField(d.id, "hero_image_url", urls[0]);
                                    }}
                                  />
                                  {currentHero && (
                                    <button
                                      type="button"
                                      onClick={() => setField(d.id, "hero_image_url", null)}
                                      className="text-xs font-body text-destructive hover:text-destructive/80 transition-colors px-2 py-1"
                                    >
                                      Clear hero
                                    </button>
                                  )}
                                </div>
                                <Input
                                  value={currentHero}
                                  onChange={(e) => setField(d.id, "hero_image_url", e.target.value || null)}
                                  placeholder="Or paste an absolute Cloudinary/Supabase URL…"
                                  className="font-mono text-xs"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                  Remember to click <span className="font-medium">Save</span> at the top of the row to persist changes.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Editorial Media */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Editorial Media <span className="normal-case font-normal">(images, YouTube/Vimeo links, or MP4 URLs — shown between biography paragraphs)</span>
                        </label>
                        <div className="mt-2 space-y-3">
                          {((editBuffer[d.id]?.biography_images ?? d.biography_images) || []).map((entry: string, idx: number) => {
                            const { url: rawUrl, caption, metadata } = parseBiographyMediaEntry(entry);
                            const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(rawUrl) || /youtube|youtu\.be|vimeo|instagram\.com\/(reel|reels|p|tv)\//i.test(rawUrl) || /res\.cloudinary\.com\/.+\/video\/upload/i.test(rawUrl);

                            const posterMetaIdx = metadata.findIndex((m) => /^poster:/i.test(m));
                            const posterUrl = posterMetaIdx >= 0 ? metadata[posterMetaIdx].replace(/^poster:/i, "").trim() : "";

                            const writeEntry = (newUrl: string, newCaption: string, newPoster: string) => {
                              const nextMeta = [...metadata];
                              if (posterMetaIdx >= 0) nextMeta.splice(posterMetaIdx, 1);
                              if (newPoster.trim()) nextMeta.push(`poster:${newPoster.trim()}`);
                              const imgs = [...((editBuffer[d.id]?.biography_images ?? d.biography_images) || [])];
                              imgs[idx] = serializeBiographyMediaEntry(newUrl, newCaption, nextMeta);
                              setField(d.id, "biography_images", imgs);

                              // Sync inline biography token when caption changes
                              const bioVal = getField(d.id, "biography") || "";
                              if (bioVal && rawUrl) {
                                const escapedUrl = rawUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                const oldInlinePattern = new RegExp(
                                  `(^|\\n)(${escapedUrl})(?:\\s*\\|\\s*${caption.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?\\s*(?=\\n|$)`,
                                  "m"
                                );
                                const newInlineToken = newCaption ? `${newUrl} | ${newCaption}` : newUrl;
                                const updatedBio = bioVal.replace(oldInlinePattern, `$1${newInlineToken}`);
                                if (updatedBio !== bioVal) setField(d.id, "biography", updatedBio);
                              }
                            };

                            const updateEntry = (newUrl: string, newCaption: string) => writeEntry(newUrl, newCaption, posterUrl);
                            const updatePoster = (newPoster: string) => writeEntry(rawUrl, caption, newPoster);

                            return (
                              <div key={idx} className="flex items-start gap-2 border border-border/50 rounded-md p-2">
                                {posterUrl ? (
                                  <img src={posterUrl} alt="" className="w-16 h-16 object-cover rounded shrink-0 bg-muted" />
                                ) : isVideo ? (
                                  <div className="w-16 h-16 rounded shrink-0 bg-muted flex items-center justify-center text-muted-foreground text-[9px] font-medium">▶ Video</div>
                                ) : rawUrl.startsWith("http") ? (
                                  <img src={rawUrl} alt="" className="w-16 h-16 object-cover rounded shrink-0 bg-muted" />
                                ) : (
                                  <div className="w-16 h-16 rounded shrink-0 bg-muted" />
                                )}
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <Input
                                    value={rawUrl}
                                    onChange={(e) => updateEntry(e.target.value, caption)}
                                    placeholder="Media URL (https://...jpg or video link)"
                                    className="text-xs font-mono"
                                  />
                                  <input
                                    value={caption}
                                    onChange={(e) => updateEntry(rawUrl, e.target.value)}
                                    spellCheck={false}
                                    autoCorrect="off"
                                    autoCapitalize="words"
                                    className="w-full pb-1 border-b border-border bg-transparent font-body text-xs text-foreground outline-none focus:border-foreground transition-colors"
                                    placeholder="Caption (e.g. Designer Name, 'Title', 2025)"
                                  />
                                  {isVideo && (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        value={posterUrl}
                                        onChange={(e) => updatePoster(e.target.value)}
                                        placeholder="Cover image URL (Instagram/Vimeo/MP4 — shown before play)"
                                        className="text-[11px] font-mono flex-1"
                                      />
                                      <CloudUpload
                                        folder={`designers/${d.slug || d.id}/covers`}
                                        accept="image/*"
                                        label="Upload cover"
                                        onUpload={(urls) => { if (urls[0]) updatePoster(urls[0]); }}
                                      />
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    title="Insert this media into biography text at cursor position"
                                    className="font-body text-[10px] text-primary/70 hover:text-primary transition-colors"
                                    onClick={() => {
                                      const ta = document.getElementById(`bio-editor-${d.id}`) as HTMLTextAreaElement | null;
                                      if (!ta || !rawUrl) return;
                                      const pos = ta.selectionStart;
                                      const bioVal = getField(d.id, "biography") || "";
                                      const insertion = caption ? `\n${rawUrl} | ${caption}\n` : `\n${rawUrl}\n`;
                                      const newBio = bioVal.substring(0, pos) + insertion + bioVal.substring(pos);
                                      setField(d.id, "biography", newBio);
                                      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(pos + insertion.length, pos + insertion.length); });
                                    }}
                                  >
                                    ↳ Insert in biography
                                  </button>
                                </div>
                                <button
                                  onClick={() => {
                                    const imgs = [...((editBuffer[d.id]?.biography_images ?? d.biography_images) || [])];
                                    imgs.splice(idx, 1);
                                    setField(d.id, "biography_images", imgs);
                                  }}
                                  className="text-muted-foreground hover:text-destructive transition-colors p-1 mt-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const imgs = [...((editBuffer[d.id]?.biography_images ?? d.biography_images) || []), ""];
                              setField(d.id, "biography_images", imgs);
                            }}
                          >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add Media
                          </Button>
                        </div>
                      </div>

                      {/* Heritage Slides */}
                      <HeritageSlideManager designerId={d.id} />

                      {/* Instagram Handle */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Instagram className="w-3.5 h-3.5" />
                          Instagram Handle
                        </label>
                        <Input
                          value={(editBuffer[d.id]?.instagram_handle ?? d.instagram_handle) || ""}
                          onChange={(e) => setField(d.id, "instagram_handle", e.target.value || null)}
                          placeholder="@handle (e.g. @achille_salvagni)"
                          className="mt-1 text-sm font-mono"
                        />
                        <Input
                          value={(editBuffer[d.id]?.instagram_handle_2 ?? d.instagram_handle_2) || ""}
                          onChange={(e) => setField(d.id, "instagram_handle_2", e.target.value || null)}
                          placeholder="Second handle (optional)"
                          className="mt-1 text-sm font-mono"
                        />
                      </div>

                      {/* Instagram Posts */}
                      <InstagramPostManager
                        designerId={d.id}
                        instagramUrls={
                          (() => {
                            const urls: string[] = [];
                            const handle = (editBuffer[d.id]?.instagram_handle ?? d.instagram_handle);
                            if (handle) {
                              const clean = handle.replace(/^@/, "").trim();
                              if (clean) urls.push(`https://www.instagram.com/${clean}/`);
                            }
                            const handle2 = (editBuffer[d.id]?.instagram_handle_2 ?? d.instagram_handle_2);
                            if (handle2) {
                              const clean2 = handle2.replace(/^@/, "").trim();
                              if (clean2) urls.push(`https://www.instagram.com/${clean2}/`);
                            }
                            if (d.links) {
                              Object.values(d.links).forEach((v) => {
                                if (typeof v === "string" && v.includes("instagram.com")) urls.push(v);
                              });
                            }
                            return urls;
                          })()
                        }
                      />

                      {/* Curator Picks */}
                      <CuratorPicksManager designerId={d.id} designerName={d.name} />

                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={getField(d.id, "is_published") as unknown as boolean}
                            onCheckedChange={(checked) => setField(d.id, "is_published", checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {getField(d.id, "is_published") ? (
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Published</span>
                            ) : (
                              <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Draft</span>
                            )}
                          </span>
                        </div>

                        <div
                          className="flex items-center gap-2 pl-3 border-l border-border/60"
                          title="When ON, this designer appears only inside the Trade Program and is hidden from every public page."
                        >
                          <Switch
                            checked={getField(d.id, "trade_only") as unknown as boolean}
                            onCheckedChange={(checked) => setField(d.id, "trade_only", checked)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {getField(d.id, "trade_only") ? (
                              <span className="flex items-center gap-1 text-primary">🔒 Trade-only</span>
                            ) : (
                              <span className="flex items-center gap-1">Public + Trade</span>
                            )}
                          </span>
                        </div>


                        <div className="flex items-center gap-2 ml-auto">
                          {dirty && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setEditBuffer((prev) => {
                                  const next = { ...prev };
                                  delete next[d.id];
                                  return next;
                                })
                              }
                            >
                              Discard
                            </Button>
                          )}
                          <Button
                            size="sm"
                            disabled={!dirty || saveMutation.isPending}
                            onClick={() => saveMutation.mutate({ id: d.id, updates: editBuffer[d.id] })}
                          >
                            <Save className="w-3.5 h-3.5 mr-1.5" />
                            Save
                          </Button>
                          <a
                            href={`/designers/${d.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            Preview <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>

                      {/* Biography Preview Toggle */}
                      <div className="border-t border-border pt-4">
                        <button
                          onClick={() => setPreviewId(previewId === d.id ? null : d.id)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          {previewId === d.id ? "Hide" : "Show"} Biography Preview
                        </button>

                        {previewId === d.id && (
                          <PreviewWithDuplicateCheck designer={d} editBuffer={editBuffer} previewMobile={previewMobile} previewDebug={previewDebug} getField={getField} />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default TradeDesignersAdmin;

