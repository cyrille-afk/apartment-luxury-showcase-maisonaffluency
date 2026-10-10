import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Loader2, X, CheckCircle2, AlertCircle, FileBox, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { prepareGlbFile, uploadGlbForProduct, GLB_MAX_MB } from "@/lib/glbUpload";

interface ProductRow {
  id: string;
  product_name: string;
  brand_name: string | null;
}

type FileStatus = "pending" | "converting" | "uploading" | "done" | "error";

interface BulkFile {
  key: string;
  file: File;
  /** Companion files attached to an .obj entry (.mtl + textures). */
  companions: File[];
  productId: string | null;
  /** Variant label — distinct labels save as separate selectable 3D models. */
  label: string;
  status: FileStatus;
  progress: number;
  message?: string;
}

/** A companion file (.mtl / texture) not yet attached to an .obj entry. */
interface OrphanFile {
  key: string;
  file: File;
  /** BulkFile.key of the .obj entry it belongs to. */
  attachTo: string | null;
}

interface Props {
  onChange?: () => void;
}

const MODEL_RE = /\.(glb|gltf|3ds|obj)$/i;
const COMPANION_RE = /\.(mtl|png|jpe?g|webp|bmp|gif|tga|tiff?)$/i;

const newKey = (name: string) =>
  `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Normalize a string for filename↔product matching. */
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stem = (name: string) => norm(name);

/** Score how well a filename matches a product name (0 = no match). */
/** Guess a size label from a filename like "bob_95x77.obj" → "W 95 × D 77". */
export function guessVariantLabel(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, "");
  const m = stem.match(/(\d{2,4})\s*[x×*]\s*(\d{2,4})(?:\s*[x×*]\s*(\d{2,4}))?/i);
  if (m) return m[3] ? `W ${m[1]} × D ${m[2]} × H ${m[3]}` : `W ${m[1]} × D ${m[2]}`;
  return "Default";
}

function matchScore(fileStem: string, productName: string): number {
  const f = norm(fileStem);
  const p = norm(productName);
  if (!f || !p) return 0;
  if (f === p) return 100;
  if (f.includes(p) || p.includes(f)) return 80;
  const fTokens = new Set(f.split(" "));
  const pTokens = p.split(" ").filter((t) => t.length > 2);
  if (pTokens.length === 0) return 0;
  const hits = pTokens.filter((t) => fTokens.has(t)).length;
  return Math.round((hits / pTokens.length) * 60);
}

/**
 * Bulk 3D upload for a single designer/brand: pick the brand, select several
 * of its products, drop many model files at once — including OBJ bundles
 * (.obj + .mtl + textures, grouped by filename). Files are auto-matched to
 * products by filename (editable per file), then uploaded sequentially with
 * per-file progress. Each file lands under its own variant label.
 */
export function GlbBulkUpload({ onChange }: Props) {
  const [brands, setBrands] = useState<string[]>([]);
  const [brand, setBrand] = useState("");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<BulkFile[]>([]);
  const [orphans, setOrphans] = useState<OrphanFile[]>([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Brand list: distinct brand_name across active products.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("brand_name")
        .eq("is_active", true)
        .not("brand_name", "is", null)
        .limit(3000);
      const uniq = Array.from(
        new Set(((data as { brand_name: string | null }[]) || []).map((r) => r.brand_name!).filter(Boolean)),
      ).sort((a, b) => a.localeCompare(b));
      setBrands(uniq);
    })();
  }, []);

  // Products for the chosen brand.
  useEffect(() => {
    if (!brand) {
      setProducts([]);
      setSelectedIds(new Set());
      return;
    }
    (async () => {
      setLoadingProducts(true);
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name")
        .eq("is_active", true)
        .ilike("brand_name", brand)
        .order("product_name", { ascending: true })
        .limit(500);
      setProducts((data as ProductRow[]) || []);
      setSelectedIds(new Set());
      setLoadingProducts(false);
    })();
  }, [brand]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedIds.has(p.id)),
    [products, selectedIds],
  );

  const objEntries = useMemo(
    () => files.filter((f) => /\.obj$/i.test(f.file.name) && f.status !== "done"),
    [files],
  );

  const toggleProduct = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bestProductMatch = (fileName: string): string | null => {
    // Auto-match against the selected products (or all brand products if
    // none selected yet — selection still required before starting).
    const pool = selectedProducts.length > 0 ? selectedProducts : products;
    let best: ProductRow | null = null;
    let bestScore = 0;
    for (const p of pool) {
      const s = matchScore(fileName, p.product_name);
      if (s > bestScore) {
        bestScore = s;
        best = p;
      }
    }
    return bestScore >= 40 && best ? best.id : null;
  };

  const addFiles = (picked: File[]) => {
    const models = picked.filter((f) => MODEL_RE.test(f.name));
    const companions = picked.filter((f) => !MODEL_RE.test(f.name) && COMPANION_RE.test(f.name));
    const ignored = picked.length - models.length - companions.length;
    if (ignored > 0) {
      toast.message(`${ignored} file${ignored === 1 ? "" : "s"} skipped — only .glb/.gltf/.3ds/.obj models and .mtl/texture companions are accepted.`);
    }
    if (models.length === 0 && companions.length === 0) return;

    // New model entries.
    const newEntries: BulkFile[] = models.map((f) => ({
      key: newKey(f.name),
      file: f,
      companions: [],
      productId: bestProductMatch(f.name),
      label: guessVariantLabel(f.name),
      status: "pending" as FileStatus,
      progress: 0,
    }));

    // Attach companions to an .obj entry whose stem matches (existing entries
    // first, then this batch). Anything unmatched becomes an orphan the user
    // can attach manually.
    const allObjEntries = [
      ...files.filter((f) => /\.obj$/i.test(f.file.name)),
      ...newEntries.filter((f) => /\.obj$/i.test(f.file.name)),
    ];
    const attachToExisting: Record<string, File[]> = {};
    const newOrphans: OrphanFile[] = [];
    for (const c of companions) {
      const cStem = stem(c.name);
      const matches = allObjEntries.filter((e) => {
        const eStem = stem(e.file.name);
        return eStem && (cStem === eStem || cStem.startsWith(eStem) || eStem.startsWith(cStem));
      });
      if (matches.length === 1) {
        const k = matches[0].key;
        attachToExisting[k] = [...(attachToExisting[k] || []), c];
      } else {
        newOrphans.push({ key: newKey(c.name), file: c, attachTo: null });
      }
    }

    setFiles((prev) => [
      ...prev.map((f) =>
        attachToExisting[f.key]
          ? { ...f, companions: [...f.companions, ...attachToExisting[f.key]] }
          : f,
      ),
      ...newEntries.map((e) =>
        attachToExisting[e.key]
          ? { ...e, companions: [...e.companions, ...attachToExisting[e.key]] }
          : e,
      ),
    ]);
    if (newOrphans.length > 0) {
      setOrphans((prev) => [...prev, ...newOrphans]);
      toast.message(
        `${newOrphans.length} companion file${newOrphans.length === 1 ? "" : "s"} need${newOrphans.length === 1 ? "s" : ""} an .obj to attach to — use the dropdown below.`,
      );
    }
  };

  const setFile = (key: string, patch: Partial<BulkFile>) =>
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const removeFile = (key: string) => {
    // Companions of a removed .obj go back to the orphan pool.
    const removed = files.find((f) => f.key === key);
    setFiles((prev) => prev.filter((f) => f.key !== key));
    setOrphans((prev) => [
      ...prev.filter((o) => o.attachTo !== key),
      ...(removed?.companions || []).map((c) => ({ key: newKey(c.name), file: c, attachTo: null })),
    ]);
  };

  const removeCompanion = (entryKey: string, idx: number) => {
    const entry = files.find((f) => f.key === entryKey);
    const c = entry?.companions[idx];
    if (!c) return;
    setFile(entryKey, { companions: entry!.companions.filter((_, i) => i !== idx) });
    setOrphans((prev) => [...prev, { key: newKey(c.name), file: c, attachTo: null }]);
  };

  const setOrphan = (key: string, patch: Partial<OrphanFile>) =>
    setOrphans((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));

  const readyCount = files.filter((f) => f.productId && f.status === "pending").length;

  const start = async () => {
    if (running) return;
    const queue = files.filter((f) => f.productId && f.status === "pending");
    if (queue.length === 0) {
      toast.error("Assign a product to at least one file first.");
      return;
    }
    const seen = new Set<string>();
    for (const f of queue) {
      const k = `${f.productId}::${(f.label.trim() || "Default").toLowerCase()}`;
      if (seen.has(k)) {
        toast.error(`Two files share the label "${f.label.trim() || "Default"}" for the same product — give each dimension its own label.`);
        return;
      }
      seen.add(k);
    }
    setRunning(true);
    let done = 0;
    let failed = 0;
    for (const item of queue) {
      try {
        setFile(item.key, { status: "converting", progress: 0, message: undefined });
        const attached = orphans
          .filter((o) => o.attachTo === item.key)
          .map((o) => o.file);
        const prepared = await prepareGlbFile([item.file, ...item.companions, ...attached]);
        setFile(item.key, { status: "uploading", progress: 0 });
        // Fresh variant list per product for replace/default logic.
        const { data: vrows } = await supabase
          .from("trade_product_glb_variants")
          .select("id, variant_label, is_default")
          .eq("product_id", item.productId!);
        await uploadGlbForProduct({
          productId: item.productId!,
          label: item.label.trim() || "Default",
          prepared,
          existingVariants: (vrows as any[]) || [],
          onProgress: (pct) => setFile(item.key, { progress: pct }),
        });
        setFile(item.key, { status: "done", progress: 100 });
        // Consumed orphans leave the pool.
        setOrphans((prev) => prev.filter((o) => o.attachTo !== item.key));
        done++;
      } catch (e: any) {
        setFile(item.key, { status: "error", message: e?.message || "Upload failed" });
        failed++;
      }
    }
    setRunning(false);
    if (failed === 0) toast.success(`${done} model${done === 1 ? "" : "s"} uploaded.`);
    else toast.warning(`${done} uploaded, ${failed} failed — see messages below.`);
    onChange?.();
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="font-display text-xl">Bulk upload — one designer</div>
        <div className="font-body text-[11px] text-muted-foreground">
          Pick a brand, select the products, then drop all the model files at once — including each product's .obj with its .mtl and texture files. Files are matched to products by filename — adjust any match before starting. Give each dimension its own variant label (sizes like 95x77 in the filename are detected) — distinct labels save as separate selectable 3D models; a repeated label replaces that model.
        </div>
      </div>

      {/* 1. Brand */}
      <div>
        <label className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground block mb-1.5">
          1 · Designer / brand
        </label>
        <select
          value={brand}
          onChange={(e) => {
            setBrand(e.target.value);
            setFiles([]);
            setOrphans([]);
          }}
          disabled={running}
          className="w-full px-3 py-2 border border-border rounded-md bg-background font-body text-sm focus:outline-none focus:border-foreground/40 appearance-none"
        >
          <option value="">Choose a brand…</option>
          {brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {/* 2. Products */}
      {brand && (
        <div>
          <label className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground block mb-1.5">
            2 · Products ({selectedIds.size} selected)
          </label>
          {loadingProducts ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-3">
              <Loader2 size={14} className="animate-spin" /> Loading products…
            </div>
          ) : (
            <div className="border border-border rounded-md divide-y divide-border max-h-[28vh] overflow-y-auto">
              {products.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2.5 px-3 py-2 hover:bg-muted/40 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleProduct(p.id)}
                    disabled={running}
                    className="accent-foreground"
                  />
                  <span className="font-body text-sm truncate">{p.product_name}</span>
                </label>
              ))}
              {products.length === 0 && (
                <div className="px-3 py-4 text-muted-foreground text-sm text-center">No active products for this brand.</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. Files */}
      {brand && selectedIds.size > 0 && (
        <div>
          <label className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground block mb-1.5">
            3 · Model files (.glb, .gltf, .3ds, .obj + .mtl + textures — max {GLB_MAX_MB} MB each)
          </label>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={running}
            className="w-full border border-dashed border-border rounded-md p-6 text-center font-body text-sm text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
          >
            <Upload size={16} className="inline mr-2 -mt-0.5" />
            Click to choose files — select as many as you like, OBJ companions included
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".glb,.gltf,.3ds,.obj,.mtl,.png,.jpg,.jpeg,.webp,.bmp,.gif,.tga,.tif,.tiff,model/gltf-binary,model/gltf+json"
            className="hidden"
            onChange={(e) => {
              const fs = e.target.files ? Array.from(e.target.files) : [];
              if (fs.length) addFiles(fs);
              e.target.value = "";
            }}
          />

          {files.length > 0 && (
            <div className="mt-3 border border-border rounded-md divide-y divide-border">
              {files.map((f) => (
                <div key={f.key} className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <FileBox size={14} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-body text-sm truncate">{f.file.name}</div>
                      {f.status === "uploading" && (
                        <div className="mt-1 max-w-[220px]">
                          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-foreground transition-all duration-200" style={{ width: `${f.progress}%` }} />
                          </div>
                        </div>
                      )}
                      {f.status === "error" && (
                        <div className="font-body text-[11px] text-destructive truncate">{f.message}</div>
                      )}
                    </div>
                    <select
                      value={f.productId || ""}
                      onChange={(e) => setFile(f.key, { productId: e.target.value || null })}
                      disabled={running || f.status === "done"}
                      className="max-w-[220px] px-2 py-1.5 border border-border rounded bg-background font-body text-xs focus:outline-none focus:border-foreground/40"
                      aria-label="Assign product"
                    >
                      <option value="">Assign product…</option>
                      {selectedProducts.map((p) => (
                        <option key={p.id} value={p.id}>{p.product_name}</option>
                      ))}
                    </select>
                    <input
                      value={f.label}
                      onChange={(e) => setFile(f.key, { label: e.target.value })}
                      disabled={running || f.status === "done"}
                      placeholder="Variant label"
                      className="w-[130px] px-2 py-1.5 border border-border rounded bg-background font-body text-xs focus:outline-none focus:border-foreground/40"
                      aria-label="Variant label"
                    />
                    {f.status === "done" ? (
                      <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                    ) : f.status === "error" ? (
                      <AlertCircle size={15} className="text-destructive shrink-0" />
                    ) : f.status === "converting" || f.status === "uploading" ? (
                      <Loader2 size={15} className="animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <button
                        onClick={() => removeFile(f.key)}
                        disabled={running}
                        className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                        title="Remove file"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {f.companions.length > 0 && (
                    <div className="mt-1.5 ml-7 flex flex-wrap gap-1.5">
                      {f.companions.map((c, i) => (
                        <span
                          key={`${c.name}-${i}`}
                          className="inline-flex items-center gap-1 border border-border rounded px-1.5 py-0.5 font-body text-[10px] text-muted-foreground"
                        >
                          <Paperclip size={10} />
                          {c.name}
                          {f.status === "pending" && !running && (
                            <button
                              onClick={() => removeCompanion(f.key, i)}
                              className="text-muted-foreground hover:text-foreground"
                              title="Detach"
                            >
                              <X size={10} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {orphans.length > 0 && (
            <div className="mt-3 border border-dashed border-border rounded-md">
              <div className="px-3 py-2 font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                Companion files — attach each to its .obj
              </div>
              <div className="divide-y divide-border">
                {orphans.map((o) => (
                  <div key={o.key} className="flex items-center gap-3 px-3 py-2">
                    <Paperclip size={13} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0 font-body text-sm truncate">{o.file.name}</div>
                    <select
                      value={o.attachTo || ""}
                      onChange={(e) => setOrphan(o.key, { attachTo: e.target.value || null })}
                      disabled={running}
                      className="max-w-[220px] px-2 py-1.5 border border-border rounded bg-background font-body text-xs focus:outline-none focus:border-foreground/40"
                      aria-label="Attach to OBJ"
                    >
                      <option value="">Attach to .obj…</option>
                      {objEntries.map((e) => (
                        <option key={e.key} value={e.key}>{e.file.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => setOrphans((prev) => prev.filter((x) => x.key !== o.key))}
                      disabled={running}
                      className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                      title="Remove file"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {files.length > 0 && (
            <button
              type="button"
              onClick={start}
              disabled={running || readyCount === 0}
              className="mt-4 inline-flex items-center gap-2 bg-foreground text-background font-body text-[12px] uppercase tracking-[0.14em] px-5 py-3 rounded-md hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {running ? "Uploading…" : `Upload ${readyCount} model${readyCount === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default GlbBulkUpload;
