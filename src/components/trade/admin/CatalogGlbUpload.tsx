import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, FileBox, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  uploadCatalogGlb,
  type CatalogItemDetails,
  type CatalogItemRecord,
  type CatalogUploadStage,
  type UploadedCatalogGlb,
} from "@/lib/catalogGlbUpload";

interface Props {
  onChange?: () => void;
}

interface FormFields {
  sku: string;
  name: string;
  designer: string;
  category_role: string;
  room_type: string;
  width_m: string;
  depth_m: string;
  height_m: string;
  base_price_sgd: string;
  base_lead_time_weeks: string;
}

const EMPTY_FIELDS: FormFields = {
  sku: "",
  name: "",
  designer: "",
  category_role: "",
  room_type: "",
  width_m: "",
  depth_m: "",
  height_m: "",
  base_price_sgd: "",
  base_lead_time_weeks: "",
};

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:border-foreground/40 focus:outline-hidden disabled:opacity-50";

function detailsFromFields(fields: FormFields): CatalogItemDetails {
  return {
    sku: fields.sku.trim(),
    name: fields.name.trim(),
    designer: fields.designer.trim() || null,
    category_role: fields.category_role.trim(),
    room_type: fields.room_type.split(",").map((room) => room.trim()).filter(Boolean),
    width_m: Number(fields.width_m),
    depth_m: Number(fields.depth_m),
    height_m: Number(fields.height_m),
    base_price_sgd: Number(fields.base_price_sgd),
    base_lead_time_weeks: Number(fields.base_lead_time_weeks),
  };
}

function detailsFromRecord(record: CatalogItemRecord): CatalogItemDetails {
  return {
    sku: record.sku,
    name: record.name,
    designer: record.designer,
    category_role: record.category_role,
    room_type: record.room_type,
    width_m: Number(record.width_m),
    depth_m: Number(record.depth_m),
    height_m: Number(record.height_m),
    base_price_sgd: Number(record.base_price_sgd),
    base_lead_time_weeks: Number(record.base_lead_time_weeks),
  };
}

function formatSize(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1.5 block font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function CatalogGlbUpload({ onChange }: Props) {
  const [items, setItems] = useState<CatalogItemRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [selectedId, setSelectedId] = useState("");
  const [fields, setFields] = useState<FormFields>(EMPTY_FIELDS);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<CatalogUploadStage | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<UploadedCatalogGlb | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    void supabase.from("catalog_items").select("*").order("name", { ascending: true }).then(({ data, error: readError }) => {
      if (!active) return;
      if (readError) setLoadError(readError.message);
      const records = (data as CatalogItemRecord[] | null) ?? [];
      setItems(records);
      if (records.length > 0) {
        setSelectedId(records[0].id);
        setMode("existing");
      }
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) ?? null, [items, selectedId]);
  const busy = stage !== null;

  const setField = (key: keyof FormFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
  };

  const handleFile = (picked: File | undefined) => {
    if (!picked) return;
    setResult(null);
    if (!/\.glb$/i.test(picked.name)) {
      setError("Choose a raw .glb file. Other model formats are not accepted by this catalog compressor.");
      return;
    }
    setError("");
    setFile(picked);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || busy || (mode === "existing" && !selected)) return;
    setError("");
    setResult(null);
    try {
      const details = mode === "existing" && selected ? detailsFromRecord(selected) : detailsFromFields(fields);
      const uploaded = await uploadCatalogGlb({
        file,
        details,
        itemId: mode === "existing" ? selected?.id : undefined,
        onStage: setStage,
      });
      setResult(uploaded);
      setItems((current) => {
        const without = current.filter((item) => item.id !== uploaded.record.id);
        return [...without, uploaded.record].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSelectedId(uploaded.record.id);
      setMode("existing");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`Compressed model saved for ${uploaded.record.name}.`);
      onChange?.();
    } catch (cause: any) {
      setError(cause?.message || "The compressed model could not be saved. Your file and catalog details are unchanged; try again.");
    } finally {
      setStage(null);
    }
  };

  const stageLabel = stage === "compressing"
    ? "Compressing meshes and converting textures…"
    : stage === "uploading"
      ? "Uploading the optimized GLB…"
      : stage === "saving"
        ? "Saving the compressed model URL…"
        : "";

  return (
    <section aria-labelledby="catalog-upload-title" className="rounded-lg border border-border p-5 md:p-7">
      <div className="mb-6 max-w-3xl">
        <h2 id="catalog-upload-title" className="font-display text-2xl">Catalog GLB upload</h2>
        <p className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          Select a raw .glb and the browser compresses its meshes with Draco, resizes oversized textures to 1024 × 1024, and converts textures to WebP before anything is uploaded.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 font-body text-sm text-muted-foreground" role="status">
          <Loader2 size={16} className="animate-spin" /> Loading catalog items…
        </div>
      ) : loadError ? (
        <div role="alert" className="rounded-md border border-destructive/40 p-4 font-body text-sm text-destructive">{loadError}</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Catalog item destination">
            <button
              type="button"
              onClick={() => { setMode("new"); setResult(null); setError(""); }}
              disabled={busy}
              aria-pressed={mode === "new"}
              className={`rounded-md border px-4 py-2 font-body text-xs uppercase tracking-[0.12em] ${mode === "new" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              New catalog item
            </button>
            <button
              type="button"
              onClick={() => { setMode("existing"); setResult(null); setError(""); }}
              disabled={busy || items.length === 0}
              aria-pressed={mode === "existing"}
              className={`rounded-md border px-4 py-2 font-body text-xs uppercase tracking-[0.12em] disabled:opacity-40 ${mode === "existing" ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              Existing catalog item ({items.length})
            </button>
          </div>

          {mode === "existing" ? (
            <div className="space-y-3">
              <Field label="Catalog item" htmlFor="catalog-item-select">
                <select id="catalog-item-select" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setResult(null); }} disabled={busy} className={inputClass}>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku}</option>)}
                </select>
              </Field>
              {selected && (
                <div className="rounded-md bg-muted/40 p-4 font-body text-sm">
                  <div>{selected.designer || "Designer not recorded"} · {selected.category_role}</div>
                  <div className="mt-1 text-muted-foreground">{selected.room_type.join(", ")} · {selected.width_m} × {selected.depth_m} × {selected.height_m} m</div>
                  {selected.glb_url_compressed && (
                    <a href={selected.glb_url_compressed} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs underline underline-offset-4">
                      Current compressed GLB <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Field label="SKU" htmlFor="catalog-sku"><input id="catalog-sku" required value={fields.sku} onChange={(event) => setField("sku", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Item name" htmlFor="catalog-name"><input id="catalog-name" required value={fields.name} onChange={(event) => setField("name", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Designer (optional)" htmlFor="catalog-designer"><input id="catalog-designer" value={fields.designer} onChange={(event) => setField("designer", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Category / role" htmlFor="catalog-role"><input id="catalog-role" required placeholder="e.g. sofa or coffee_table" value={fields.category_role} onChange={(event) => setField("category_role", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Room types (comma separated)" htmlFor="catalog-rooms"><input id="catalog-rooms" required placeholder="Living, Study" value={fields.room_type} onChange={(event) => setField("room_type", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Base price (SGD)" htmlFor="catalog-price"><input id="catalog-price" required type="number" min="0" step="0.01" value={fields.base_price_sgd} onChange={(event) => setField("base_price_sgd", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Width (metres)" htmlFor="catalog-width"><input id="catalog-width" required type="number" min="0.001" step="any" value={fields.width_m} onChange={(event) => setField("width_m", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Depth (metres)" htmlFor="catalog-depth"><input id="catalog-depth" required type="number" min="0.001" step="any" value={fields.depth_m} onChange={(event) => setField("depth_m", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Height (metres)" htmlFor="catalog-height"><input id="catalog-height" required type="number" min="0.001" step="any" value={fields.height_m} onChange={(event) => setField("height_m", event.target.value)} disabled={busy} className={inputClass} /></Field>
              <Field label="Lead time (whole weeks)" htmlFor="catalog-lead"><input id="catalog-lead" required type="number" min="0" step="1" value={fields.base_lead_time_weeks} onChange={(event) => setField("base_lead_time_weeks", event.target.value)} disabled={busy} className={inputClass} /></Field>
            </div>
          )}

          <div>
            <input ref={inputRef} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-3 rounded-md border border-dashed border-border px-5 py-7 text-left font-body text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50"
            >
              {file ? <FileBox size={18} className="shrink-0" /> : <Upload size={18} className="shrink-0" />}
              <span className="min-w-0">
                <span className="block truncate text-foreground">{file ? file.name : "Choose raw .glb file"}</span>
                <span className="mt-1 block text-xs">{file ? `${formatSize(file.size)} · compression runs before upload` : "Only the optimized .glb leaves your browser"}</span>
              </span>
            </button>
          </div>

          {stage && (
            <div role="status" className="flex items-center gap-2 rounded-md bg-muted/40 p-3 font-body text-sm text-muted-foreground">
              <Loader2 size={15} className="animate-spin" /> {stageLabel}
            </div>
          )}
          {error && <div role="alert" className="rounded-md border border-destructive/40 p-3 font-body text-sm text-destructive">{error}</div>}
          {result && (
            <div role="status" className="rounded-md border border-border p-4 font-body text-sm">
              <div className="flex items-center gap-2"><CheckCircle2 size={16} /> Compressed catalog model saved</div>
              <div className="mt-2 text-muted-foreground">
                {formatSize(result.compression.originalBytes)} → {formatSize(result.compression.compressedBytes)} · {result.compression.textureCount} WebP texture{result.compression.textureCount === 1 ? "" : "s"}
              </div>
              <a href={result.publicUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs underline underline-offset-4">Open optimized GLB <ExternalLink size={12} /></a>
            </div>
          )}

          <button
            type="submit"
            disabled={!file || busy || (mode === "existing" && !selected)}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-3 font-body text-xs uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {busy ? "Processing…" : mode === "existing" ? "Compress & replace model" : "Compress & create item"}
          </button>
        </form>
      )}
    </section>
  );
}

export default CatalogGlbUpload;
