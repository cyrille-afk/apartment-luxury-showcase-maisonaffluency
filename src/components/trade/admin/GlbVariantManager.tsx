import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Loader2, Trash2, ExternalLink, Star, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import Product3DViewer from "@/components/trade/Product3DViewer";
import { classifyObjBundle, convertObjBundleToGlb } from "@/lib/objToGlb";
import { inspectGlbFile, UPHOLSTERY_KEYWORDS } from "@/lib/glbInspect";
import GlbMaterialRolesEditor from "@/components/trade/admin/GlbMaterialRolesEditor";


const MAX_MB = 50;

type MaterialRole = "fabric" | "base" | "ignore";

interface GlbVariantRow {
  id: string;
  variant_label: string;
  glb_url: string;
  is_default: boolean;
  file_size_bytes: number | null;
  updated_at?: string | null;
  material_roles?: Record<string, MaterialRole> | null;
}


interface Props {
  productId: string;
  productName: string;
  posterImageUrl?: string | null;
  onChange?: () => void;
}

interface SizeVariantEntry {
  label: string;
  meters?: number | null;
}

const DIM_RE = /\b(?:cm|mm|in|inches?|")\b|[×xX]\s*\d|Ø\s*\d|\bW\s*\d|\bD\s*\d|\bH\s*\d|\bSH\s*\d/i;
const looksDimensional = (s: unknown) => typeof s === "string" && DIM_RE.test(s);

/**
 * Normalise a size_variants[].label / .base / .top pairing into a single
 * human-readable label used as the variant key in trade_product_glb_variants.
 *
 * GLBs describe geometry only, so when a dual-axis pick pairs a dimensional
 * `base` with a material/finish `top` (e.g. size × fabric), we key by size
 * alone. Fabric is swapped at runtime by the viewer.
 */
function pickSizeLabel(v: {
  label?: string;
  base?: string;
  top?: string;
  meters?: number | null;
}): string | null {
  const label = v?.label?.trim() || "";
  const base = v?.base?.trim() || "";
  const top = v?.top?.trim() || "";
  const labelDim = looksDimensional(label);
  const baseDim = looksDimensional(base);
  const topDim = looksDimensional(top);

  // GLBs are geometry-only. Return a label ONLY when at least one axis (or
  // the explicit `label` field) carries dimensions. When neither axis is
  // dimensional (e.g. wood × fabric), every entry collapses to null and the
  // manager falls back to a single "Default" slot.
  if (labelDim) return label;
  if (baseDim && !topDim) return base;
  if (topDim && !baseDim) return top;
  if (baseDim && topDim) return [base, top].filter(Boolean).join(" × ");
  return null;
}

export function GlbVariantManager({ productId, productName, posterImageUrl, onChange }: Props) {
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<GlbVariantRow[]>([]);
  const [sizeLabels, setSizeLabels] = useState<SizeVariantEntry[]>([]);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState<string | null>(null); // label being uploaded
  const [customOpen, setCustomOpen] = useState(false);
  const [customLabel, setCustomLabel] = useState("");
  const [preview, setPreview] = useState<GlbVariantRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    setLoading(true);
    // 1) existing GLB variants
    const { data: vrows, error: vErr } = await supabase
      .from("trade_product_glb_variants")
      .select("id, variant_label, glb_url, is_default, file_size_bytes, updated_at, material_roles")
      .eq("product_id", productId)
      .order("is_default", { ascending: false })
      .order("variant_label", { ascending: true });
    if (vErr) toast.error(vErr.message);
    setVariants((vrows as GlbVariantRow[]) || []);

    // 2) size_variants from the source curator pick (if any)
    const { data: tp } = await supabase
      .from("trade_products")
      .select("source_pick_id")
      .eq("id", productId)
      .maybeSingle();
    const pickId = (tp as any)?.source_pick_id as string | null;
    if (pickId) {
      const { data: pick } = await supabase
        .from("designer_curator_picks")
        .select("size_variants")
        .eq("id", pickId)
        .maybeSingle();
      const raw = Array.isArray((pick as any)?.size_variants) ? (pick as any).size_variants : [];
      const labels: SizeVariantEntry[] = [];
      const seen = new Set<string>();
      for (const v of raw) {
        const lbl = pickSizeLabel(v);
        if (lbl && !seen.has(lbl.toLowerCase())) {
          labels.push({ label: lbl, meters: v?.meters ?? null });
          seen.add(lbl.toLowerCase());
        }
      }
      setSizeLabels(labels);
    } else {
      setSizeLabels([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!productId) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Union of size-variant labels + already-uploaded labels + a "Default" fallback if empty.
  const rows = useMemo(() => {
    const byLabel = new Map<string, { label: string; variant: GlbVariantRow | null }>();

    const add = (label: string) => {
      const key = label.toLowerCase();
      if (byLabel.has(key)) return;
      const existing = variants.find((v) => v.variant_label.toLowerCase() === key) || null;
      byLabel.set(key, { label: existing?.variant_label || label, variant: existing });
    };

    // 1. Structured size variants first (in declared order).
    sizeLabels.forEach((sl) => add(sl.label));
    // 2. Every uploaded variant (keeps free-text / legacy entries visible).
    variants.forEach((v) => add(v.variant_label));
    // 3. If nothing at all, expose a "Default" slot so the admin can upload.
    if (byLabel.size === 0) add("Default");

    return Array.from(byLabel.values());
  }, [sizeLabels, variants]);

  const triggerFilePicker = (label: string) => {
    setPendingLabel(label);
    setTimeout(() => inputRef.current?.click(), 0);
  };

  const handleFiles = async (files: File[]) => {
    const label = pendingLabel;
    setPendingLabel(null);
    if (!label || files.length === 0) return;

    let fileToUpload: File | null = null;
    let ext: "glb" | "gltf" = "glb";

    if (files.length === 1) {
      const f = files[0];
      const n = f.name.toLowerCase();
      if (n.endsWith(".glb") || n.endsWith(".gltf")) {
        fileToUpload = f;
        ext = n.endsWith(".gltf") ? "gltf" : "glb";
      }
    }

    if (!fileToUpload) {
      const bundle = classifyObjBundle(files);
      if (bundle) {
        setUploading(label);
        setUploadProgress(0);
        try {
          toast.message(`Converting OBJ to GLB for "${label}"…`);
          const outName = bundle.objFile.name.replace(/\.obj$/i, "") + ".glb";
          fileToUpload = await convertObjBundleToGlb(bundle, outName);
          ext = "glb";
        } catch (e: any) {
          setUploading(null);
          toast.error(`OBJ→GLB conversion failed: ${e?.message || e}`);
          return;
        }
      }
    }

    if (!fileToUpload) {
      toast.error("Please upload a .glb/.gltf or an .obj (+ .mtl + textures).");
      return;
    }
    if (fileToUpload.size > MAX_MB * 1024 * 1024) {
      setUploading(null);
      toast.error(`${(fileToUpload.size / 1024 / 1024).toFixed(1)} MB exceeds the ${MAX_MB} MB limit.`);
      return;
    }

    // Fabric-convention validator: warn (but don't block) if no material/mesh
    // name matches the upholstery keyword list expected by Product3DViewer.
    try {
      const report = await inspectGlbFile(fileToUpload);
      if (report.parseError) {
        toast.warning(
          `Couldn't inspect GLB material names (${report.parseError}). Upload will continue.`,
        );
      } else if (!report.hasUpholsteryConvention) {
        const preview = [...report.materialNames, ...report.meshNames]
          .slice(0, 4)
          .join(", ") || "(no named materials/meshes)";
        toast.warning(
          `No upholstery material detected in this GLB. Fabric swaps will fall back to every material. Rename your seat/cushion material to include one of: ${UPHOLSTERY_KEYWORDS.join(", ")}. Found: ${preview}`,
          { duration: 10000 },
        );
      } else {
        toast.success(
          `Fabric convention detected on: ${report.matchedNames.slice(0, 3).join(", ")}${report.matchedNames.length > 3 ? "…" : ""}`,
        );
      }
    } catch {
      /* non-fatal */
    }

    setUploading(label);
    setUploadProgress(0);
    try {
      const safeLabel = label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
      const path = `glb-models/${productId}/${safeLabel}-${Date.now()}.${ext}`;
      const contentType = ext === "glb" ? "model/gltf-binary" : "model/gltf+json";
      const { error: upErr } = await supabase.storage.from("assets").upload(path, fileToUpload, {
        contentType,
        cacheControl: "31536000",
        upsert: false,
        onUploadProgress: (evt: { loaded?: number; total?: number }) => {
          const pct = Math.round(((evt.loaded || 0) / (evt.total || fileToUpload!.size)) * 100);
          setUploadProgress(pct);
        },
      } as any);
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const existing = variants.find(
        (v) => v.variant_label.toLowerCase() === label.toLowerCase(),
      );
      const shouldBeDefault = variants.length === 0 || (existing?.is_default ?? false);

      if (existing) {
        const { error } = await supabase
          .from("trade_product_glb_variants")
          .update({ glb_url: publicUrl, file_size_bytes: fileToUpload.size })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("trade_product_glb_variants").insert({
          product_id: productId,
          variant_label: label,
          glb_url: publicUrl,
          file_size_bytes: fileToUpload.size,
          is_default: shouldBeDefault,
        });
        if (error) throw error;
      }
      toast.success(`Saved 3D model for "${label}"`);
      await reload();
      onChange?.();
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploading(null);
      setUploadProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleDelete = async (row: GlbVariantRow) => {
    if (!confirm(`Remove the "${row.variant_label}" 3D model?`)) return;
    const { error } = await supabase
      .from("trade_product_glb_variants")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("3D model removed");
    setPreview((p) => (p?.id === row.id ? null : p));
    await reload();
    onChange?.();
  };

  const handleSetDefault = async (row: GlbVariantRow) => {
    if (row.is_default) return;
    // Clear existing default, then set the new one.
    const { error: e1 } = await supabase
      .from("trade_product_glb_variants")
      .update({ is_default: false })
      .eq("product_id", productId)
      .eq("is_default", true);
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const { error: e2 } = await supabase
      .from("trade_product_glb_variants")
      .update({ is_default: true })
      .eq("id", row.id);
    if (e2) {
      toast.error(e2.message);
      return;
    }
    toast.success(`"${row.variant_label}" is now the default 3D model`);
    await reload();
    onChange?.();
  };

  const handleAddCustom = () => {
    const l = customLabel.trim();
    if (!l) return;
    if (rows.some((r) => r.label.toLowerCase() === l.toLowerCase())) {
      toast.error("That label already exists.");
      return;
    }
    // Just triggers the file picker — the row is created when the file lands.
    setCustomLabel("");
    setCustomOpen(false);
    triggerFilePicker(l);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <div className="font-display text-xl">{productName}</div>
          <div className="font-body text-[11px] text-muted-foreground">
            {sizeLabels.length > 0
              ? `${sizeLabels.length} size variant${sizeLabels.length === 1 ? "" : "s"} detected from the source pick.`
              : "No structured size variants on the source pick — using a single Default slot."}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCustomOpen((s) => !s)}
          className="inline-flex items-center gap-1.5 border border-border rounded-md px-2.5 py-1.5 font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
        >
          {customOpen ? <X size={12} /> : <Plus size={12} />}
          {customOpen ? "Cancel" : "Add custom label"}
        </button>
      </div>

      {customOpen && (
        <div className="flex items-center gap-2 border border-dashed border-border rounded-md p-3">
          <input
            type="text"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder='e.g. "2-seater", "Sofa 220", "Ottoman"'
            className="flex-1 px-2 py-1.5 border border-border rounded bg-background font-body text-sm focus:outline-none focus:border-foreground/40"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCustom();
            }}
          />
          <button
            type="button"
            onClick={handleAddCustom}
            className="px-3 py-1.5 border border-foreground rounded font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground hover:text-background transition-colors"
          >
            Upload
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-6 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading variants…
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border">
          {rows.map((r) => {
            const v = r.variant;
            const isThisUploading = uploading?.toLowerCase() === r.label.toLowerCase();
            return (
              <div key={r.label} className="flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm truncate">{r.label}</span>
                    {v?.is_default && (
                      <span className="inline-flex items-center gap-1 font-body text-[9px] uppercase tracking-[0.14em] bg-foreground text-background px-1.5 py-0.5 rounded">
                        <Star size={9} /> Default
                      </span>
                    )}
                    {v && (
                      <span className="font-body text-[10px] uppercase tracking-[0.12em] text-emerald-600">
                        3D
                      </span>
                    )}
                  </div>
                  {v && (
                    <div className="font-body text-[10px] text-muted-foreground truncate">
                      {v.file_size_bytes
                        ? `${(v.file_size_bytes / 1024 / 1024).toFixed(1)} MB · `
                        : ""}
                      {v.updated_at
                        ? new Date(v.updated_at).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : ""}
                    </div>
                  )}
                  {isThisUploading && (
                    <div className="mt-1.5 max-w-[240px]">
                      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-foreground transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="font-body text-[9px] text-muted-foreground mt-0.5">
                        {uploadProgress}%
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {v && !v.is_default && (
                    <button
                      onClick={() => handleSetDefault(v)}
                      title="Set as default"
                      className="p-1.5 rounded border border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Star size={12} />
                    </button>
                  )}
                  {v && (
                    <>
                      <button
                        onClick={() => setPreview(preview?.id === v.id ? null : v)}
                        className="font-body text-[10px] uppercase tracking-[0.12em] px-2 py-1 border border-border rounded hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {preview?.id === v.id ? "Hide" : "Preview"}
                      </button>
                      <a
                        href={v.glb_url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded border border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-colors"
                        title="Open GLB"
                      >
                        <ExternalLink size={12} />
                      </a>
                      <button
                        onClick={() => handleDelete(v)}
                        className="p-1.5 rounded border border-border text-destructive hover:border-destructive transition-colors"
                        title="Remove"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => triggerFilePicker(r.label)}
                    disabled={!!uploading}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded font-body text-[11px] uppercase tracking-[0.12em] transition-colors ${
                      v
                        ? "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    } ${uploading ? "opacity-50 cursor-wait" : ""}`}
                  >
                    {isThisUploading ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : (
                      <Upload size={11} />
                    )}
                    {v ? "Replace" : "Upload"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <PreviewPanel
          key={preview.id}
          variant={preview}
          productName={productName}
          posterImageUrl={posterImageUrl || null}
          onRolesSaved={(roles) => {
            setVariants((prev) =>
              prev.map((v) => (v.id === preview.id ? { ...v, material_roles: roles } : v)),
            );
            setPreview((p) => (p && p.id === preview.id ? { ...p, material_roles: roles } : p));
          }}
        />
      )}


      <p className="font-body text-[10px] text-muted-foreground leading-relaxed max-w-[520px]">
        Accepted files per variant: <b>.glb</b>, <b>.gltf</b>, or an <b>.obj</b> with its <b>.mtl</b> and texture images (⌘/Ctrl to multi-select — converted to GLB in your browser). Max {MAX_MB} MB per file. The default variant is what shows on public product pages and inside the concierge tearsheet drawer when no size is selected.
      </p>

      {/* Hidden shared file picker */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".glb,.gltf,.obj,.mtl,.png,.jpg,.jpeg,.webp,.bmp,.tga,.tif,.tiff,model/gltf-binary,model/gltf+json,image/*"
        className="hidden"
        onChange={(e) => {
          const fs = e.target.files ? Array.from(e.target.files) : [];
          if (fs.length) handleFiles(fs);
        }}
      />
    </div>
  );
}

/**
 * Preview + material-role editor for a single GLB variant. Owns the
 * discovered material names, the working role map, and passes both into
 * the viewer so the fabric/base swatch preview updates live as the admin
 * toggles roles.
 */
function PreviewPanel({
  variant,
  productName,
  posterImageUrl,
  onRolesSaved,
}: {
  variant: GlbVariantRow;
  productName: string;
  posterImageUrl: string | null;
  onRolesSaved: (roles: Record<string, MaterialRole>) => void;
}) {
  const [materialNames, setMaterialNames] = useState<string[]>([]);
  const [liveRoles, setLiveRoles] = useState<Record<string, MaterialRole>>(
    () => (variant.material_roles as Record<string, MaterialRole>) || {},
  );
  // When set, we temporarily override the viewer's material_roles to isolate
  // this single material as "fabric" and pass a bright magenta 1×1 PNG as the
  // fabric texture — makes it obvious which mesh the opaque UUID name maps to.
  const [identifying, setIdentifying] = useState<string | null>(null);

  useEffect(() => {
    setLiveRoles((variant.material_roles as Record<string, MaterialRole>) || {});
    setMaterialNames([]);
    setIdentifying(null);
  }, [variant.id]);

  // Bright magenta 1×1 PNG (data URI) used as the identify highlight texture.
  const HIGHLIGHT_PNG =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  // Magenta 1×1 built via canvas so it's actually pink at runtime; the base64
  // above is a placeholder. Use a colored data URI:
  const MAGENTA_DATA_URI =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      "<svg xmlns='http://www.w3.org/2000/svg' width='2' height='2'><rect width='2' height='2' fill='%23ff00aa'/></svg>",
    );

  const viewerRoles: Record<string, MaterialRole> = identifying
    ? Object.fromEntries(
        materialNames.map((n) => [n, n === identifying ? "fabric" : "ignore"]),
      )
    : liveRoles;

  return (
    <div className="max-w-[420px] space-y-2">
      <div className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        Preview · {variant.variant_label}
        {identifying && (
          <span className="ml-2 text-fuchsia-600 normal-case tracking-normal">
            · highlighting {identifying.slice(0, 12)}…
          </span>
        )}
      </div>
      <Product3DViewer
        url={variant.glb_url}
        alt={`${productName} — ${variant.variant_label}`}
        poster={posterImageUrl || null}
        autoOpen
        debug
        materialRoles={viewerRoles}
        fabricTextureUrl={identifying ? MAGENTA_DATA_URI : null}
        baseTextureUrl={null}
        onMaterialsDiscovered={(names) => setMaterialNames(names)}
      />
      <GlbMaterialRolesEditor
        variantId={variant.id}
        materialNames={materialNames}
        initialRoles={variant.material_roles}
        onChange={setLiveRoles}
        onSaved={onRolesSaved}
        identifying={identifying}
        onIdentifyChange={setIdentifying}
      />
    </div>
  );
}


export default GlbVariantManager;
