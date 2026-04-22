import { useState, useMemo, useCallback, Fragment, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Search, Save, ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Plus, Trash2, GripVertical, BookOpen, Monitor, Smartphone, AlertTriangle, Instagram, Wand2, Loader2, X, FileDown } from "lucide-react";
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

const EditorialBiography = lazy(() => import("@/components/EditorialBiography"));

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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
    materials: string | null; dimensions: string | null; description: string | null;
    edition: string | null; photo_credit: string | null; pdf_url: string | null;
    pdf_filename: string | null; pdf_urls: PdfEntry[] | null; currency: string; trade_price_cents: number | null;
    price_prefix: string | null; sort_order: number; created_at: string;
    size_variants: { label?: string; base?: string; top?: string; price_cents: number }[] | null;
    variant_placeholder: string | null;
    base_axis_label: string | null;
    top_axis_label: string | null;
  };
  const [picks, setPicks] = useState<Pick[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedPickId, setExpandedPickId] = useState<string | null>(null);

  const loadPicks = useCallback(async () => {
    const { data, error } = await supabase
      .from("designer_curator_picks")
      .select("*")
      .eq("designer_id", designerId)
      .order("sort_order", { ascending: true });

    if (error) {
      toast({ title: "Failed to load picks", description: error.message, variant: "destructive" });
      setLoaded(true);
      return;
    }

    setPicks((data as any[]) || []);
    setLoaded(true);
  }, [designerId, toast]);

  useEffect(() => {
    void loadPicks();
  }, [loadPicks]);

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

  const updateField = async (id: string, field: string, value: any) => {
    setPicks((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    await supabase.from("designer_curator_picks").update({ [field]: value } as any).eq("id", id);
  };

  if (!loaded) return null;

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
        Curators&apos; Picks ({picks.length})
      </label>
      <div className="mt-2 space-y-2">
        {picks.map((pick) => (
          <div key={pick.id} className="rounded-md border border-border/60 p-2">
            <div className="flex items-center gap-2">
              {pick.image_url && (
                <img src={pick.image_url} alt="" className="w-10 h-10 object-cover rounded shrink-0" />
              )}
              <span className="text-xs font-medium flex-1 truncate">{pick.title || "Untitled"}</span>
              {(pick.pdf_url || (pick.pdf_urls && pick.pdf_urls.length > 0)) && (
                <Badge variant="outline" className="text-[10px] border-[hsl(var(--pdf-red))]/40 text-[hsl(var(--pdf-red))]">
                  <FileDown className="w-2.5 h-2.5 mr-0.5" />
                  PDF{pick.pdf_urls && pick.pdf_urls.length > 1 ? ` ×${pick.pdf_urls.length}` : ''}
                </Badge>
              )}
              {pick.category && <Badge variant="outline" className="text-[10px]">{pick.category}</Badge>}
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
                    <label className="text-[10px] text-muted-foreground">Materials</label>
                    <Input value={pick.materials || ""} onChange={(e) => updateField(pick.id, "materials", e.target.value || null)} className="text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground">Dimensions</label>
                    <Input value={pick.dimensions || ""} onChange={(e) => updateField(pick.id, "dimensions", e.target.value || null)} className="text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground">Edition</label>
                    <Input value={pick.edition || ""} onChange={(e) => updateField(pick.id, "edition", e.target.value || null)} className="text-xs" />
                  </div>
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
                  <Input value={(pick as any).origin || ""} onChange={(e) => updateField(pick.id, "origin", e.target.value || null)} className="text-xs" placeholder="e.g. Handmade in Europe" />
                </div>
                <div className="grid grid-cols-4 gap-2">
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
                    <label className="text-[10px] text-muted-foreground">Sort Order</label>
                    <Input type="number" value={pick.sort_order} onChange={(e) => updateField(pick.id, "sort_order", parseInt(e.target.value) || 0)} className="text-xs" />
                  </div>
                  <div className="col-span-2 md:col-span-3">
                    <label className="text-[10px] text-muted-foreground">
                      Variant Dropdown Label <span className="italic">(optional — overrides default "Select your material choice…")</span>
                    </label>
                    <Input
                      value={pick.variant_placeholder || ""}
                      onChange={(e) => updateField(pick.id, "variant_placeholder", e.target.value || null)}
                      placeholder='e.g. "Select your fabric choice", "Select your finish"'
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
                </div>

                {/* Variant pricing — supports single-axis (Size) and dual-axis (Base × Top) */}
                <div className="space-y-2 border border-dashed border-border rounded-md p-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Variant Pricing (per Size, or Base × Top)
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
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic leading-snug">
                    For a single dropdown (size only), fill <em>Label</em> + <em>Price</em>. For two dropdowns (e.g. Base × Top finish), fill <em>Base</em> and <em>Top</em>; the product sheet will render two selectors and price by combination.
                  </p>
                  {(pick.size_variants || []).length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">
                      No variants. The Default RRP above will be used.
                    </p>
                  )}
                  {(pick.size_variants || []).length > 0 && (
                    <div className="grid grid-cols-[1fr_1fr_1fr_7rem_1.75rem] gap-1.5 items-center text-[9px] uppercase tracking-wider text-muted-foreground/70">
                      <span>Label / Size</span>
                      <span>Base</span>
                      <span>Top</span>
                      <span>Price ({pick.currency || "EUR"})</span>
                      <span></span>
                    </div>
                  )}
                  {(pick.size_variants || []).map((variant, idx) => (
                    <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_7rem_1.75rem] gap-1.5 items-center">
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
                        placeholder="0.00"
                        className="text-xs h-8"
                      />
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
                  ))}
                </div>
                <VariantPreviewPanel
                  sizeVariants={pick.size_variants}
                  variantPlaceholder={pick.variant_placeholder}
                  dimensions={pick.dimensions}
                  materials={pick.materials}
                  currency={pick.currency}
                  baseAxisLabel={pick.base_axis_label}
                  topAxisLabel={pick.top_axis_label}
                />
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
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
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
    setBulkText("");
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
          {fetchingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
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
              {fetchingIds.has(post.id) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
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
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"Paste Instagram post URLs, one per line:\nhttps://www.instagram.com/p/ABC123/\nhttps://www.instagram.com/p/DEF456/"}
              className="w-full text-xs border rounded-md p-2 h-24 resize-y bg-background text-foreground"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkAdd} disabled={!bulkText.trim() || bulkImporting} className="text-xs h-8 gap-1.5">
                {bulkImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                {bulkImporting ? "Importing & fetching images…" : "Import & Auto-fetch"}
              </Button>
              <button onClick={() => { setBulkMode(false); setBulkText(""); }} className="text-xs text-muted-foreground hover:text-foreground" disabled={bulkImporting}>
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
  biography_images: string[];
  links: Record<string, string> | null;
  instagram_handle: string | null;
  instagram_handle_2: string | null;
}

const TradeDesignersAdmin = () => {
  const { isAdmin, isSuperAdmin, loading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<Record<string, Partial<DesignerRow>>>({});
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [previewDebug, setPreviewDebug] = useState(false);

  const { data: designers = [], isLoading } = useQuery({
    queryKey: ["admin-designers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designers")
        .select("id, slug, name, display_name, specialty, biography, philosophy, notable_works, image_url, hero_image_url, source, is_published, biography_images, links, instagram_handle, instagram_handle_2")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as DesignerRow[];
    },
    enabled: !!isAdmin,
  });

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
          d.specialty.toLowerCase().includes(q)
      );
    }
    if (activeLetter) {
      list = list.filter((d) => d.name[0]?.toUpperCase() === activeLetter);
    }
    return list;
  }, [designers, search, activeLetter]);

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

  const setField = useCallback((id: string, field: keyof DesignerRow, value: string) => {
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

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

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
          <Link
            to="/trade/designers/instagram"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-body text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all"
          >
            <Instagram className="h-3.5 w-3.5" />
            IG Audit
          </Link>
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
                <div key={d.id} className="border border-border rounded-sm overflow-hidden">
                  {/* Row header */}
                  <button
                    onClick={() => setExpandedId(isOpen ? null : d.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                  >
                    {d.image_url && (
                      <img
                        src={d.image_url}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover shrink-0"
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
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Hero Image URL <span className="normal-case font-normal">(optional — overrides card image for the profile hero)</span>
                        </label>
                        <Input
                          value={(editBuffer[d.id]?.hero_image_url ?? d.hero_image_url) || ""}
                          onChange={(e) => setField(d.id, "hero_image_url" as keyof DesignerRow, e.target.value || null)}
                          placeholder="Leave empty to use card image"
                          className="mt-1 font-mono text-xs"
                        />
                      </div>

                      {/* Editorial Media */}
                      <div>
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          Editorial Media <span className="normal-case font-normal">(images, YouTube/Vimeo links, or MP4 URLs — shown between biography paragraphs)</span>
                        </label>
                        <div className="mt-2 space-y-3">
                          {((editBuffer[d.id]?.biography_images ?? d.biography_images) || []).map((entry: string, idx: number) => {
                            const { url: rawUrl, caption, metadata } = parseBiographyMediaEntry(entry);
                            const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(rawUrl) || /youtube|youtu\.be|vimeo/i.test(rawUrl) || /res\.cloudinary\.com\/.+\/video\/upload/i.test(rawUrl);

                            const updateEntry = (newUrl: string, newCaption: string) => {
                              const imgs = [...((editBuffer[d.id]?.biography_images ?? d.biography_images) || [])];
                              const oldSerialized = imgs[idx];
                              imgs[idx] = serializeBiographyMediaEntry(newUrl, newCaption, metadata);
                              setField(d.id, "biography_images" as keyof DesignerRow, imgs as any);

                              // Sync inline biography token when caption changes
                              const bioVal = getField(d.id, "biography") || "";
                              if (bioVal && rawUrl) {
                                // Build old inline token pattern: URL alone or URL | old caption
                                const escapedUrl = rawUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                const oldInlinePattern = new RegExp(
                                  `(^|\\n)(${escapedUrl})(?:\\s*\\|\\s*${caption.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?\\s*(?=\\n|$)`,
                                  "m"
                                );
                                const newInlineToken = newCaption
                                  ? `${newUrl} | ${newCaption}`
                                  : newUrl;
                                const updatedBio = bioVal.replace(oldInlinePattern, `$1${newInlineToken}`);
                                if (updatedBio !== bioVal) {
                                  setField(d.id, "biography", updatedBio);
                                }
                              }
                            };

                            return (
                              <div key={idx} className="flex items-start gap-2 border border-border/50 rounded-md p-2">
                                {isVideo ? (
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
                                    setField(d.id, "biography_images" as keyof DesignerRow, imgs as any);
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
                              setField(d.id, "biography_images" as keyof DesignerRow, imgs as any);
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
                          onChange={(e) => setField(d.id, "instagram_handle" as keyof DesignerRow, e.target.value || null as any)}
                          placeholder="@handle (e.g. @achille_salvagni)"
                          className="mt-1 text-sm font-mono"
                        />
                        <Input
                          value={(editBuffer[d.id]?.instagram_handle_2 ?? d.instagram_handle_2) || ""}
                          onChange={(e) => setField(d.id, "instagram_handle_2" as keyof DesignerRow, e.target.value || null as any)}
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
                            onCheckedChange={(checked) => setField(d.id, "is_published", checked as unknown as string)}
                          />
                          <span className="text-xs text-muted-foreground">
                            {getField(d.id, "is_published") ? (
                              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> Published</span>
                            ) : (
                              <span className="flex items-center gap-1"><EyeOff className="w-3 h-3" /> Draft</span>
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

