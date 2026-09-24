import { useEffect, useState } from "react";
import { Check, ImageOff, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type VisualThemeDna = {
  aesthetic_label: string | null;
  aesthetic_summary: string | null;
  dominant_tones: string[] | null;
  historical_affinities: string[] | null;
  materials: string[] | null;
  image_urls: string[] | null;
};

const paletteClasses = ["bg-foreground", "bg-primary", "bg-secondary", "bg-accent"];

function cleanList(value: string[] | null | undefined, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean).slice(0, limit);
}

function toneClass(tone: string, index: number) {
  const value = tone.toLowerCase();
  if (/black|charcoal|ebony|walnut|oxblood|deep|dark|ink/.test(value)) return "bg-foreground";
  if (/green|jade|olive|sage|forest/.test(value)) return "bg-primary";
  if (/red|rust|clay|terracotta|coral|rose/.test(value)) return "bg-secondary";
  if (/gold|brass|ochre|yellow|amber/.test(value)) return "bg-accent";
  if (/white|ivory|cream|sand|beige|stone|grey|gray|taupe/.test(value)) return "bg-muted";
  return paletteClasses[index % paletteClasses.length];
}

export type ChipKind = "affinity" | "material" | "neutral";

const chipStyles: Record<ChipKind, string> = {
  affinity: "border-chip-affinity bg-chip-affinity text-chip-affinity-foreground",
  material: "border-chip-material-border bg-chip-material text-chip-material-foreground",
  neutral: "border-border bg-background text-foreground",
};

function chipClass(kind: ChipKind, editable: boolean) {
  return editable
    ? `inline-flex items-center gap-1.5 border py-1 pl-2.5 pr-1.5 font-body text-[11px] antialiased ${chipStyles[kind]}`
    : `border px-2.5 py-1 font-body text-[11px] antialiased ${chipStyles[kind]}`;
}

function chipCloseClass(kind: ChipKind) {
  return kind === "neutral" ? "text-muted-foreground hover:text-destructive" : "text-current opacity-70 hover:opacity-100";
}

function InsightBlock({ title, values, kind = "neutral" }: { title: string; values: string[]; kind?: ChipKind }) {
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">{title}</h4>
      {values.length ? (
        <div className="mt-3 flex flex-wrap gap-x-2 gap-y-1.5">
          {values.map((value, index) => (
            <span key={`${value}-${index}`} className={chipClass(kind, false)}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 font-body text-xs text-muted-foreground">Not identified</p>
      )}
    </div>
  );
}

function EvidenceImage({ src, index }: { src?: string; index: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-square overflow-hidden bg-visual-evidence">
      {src && !failed ? (
        <img
          src={src}
          alt={`Scraped studio portfolio evidence ${index + 1}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center border border-border/60 text-muted-foreground/50">
          <ImageOff className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Portfolio image unavailable</span>
        </div>
      )}
    </div>
  );
}

let catalogDesignersCache: Promise<string[]> | null = null;
function loadCatalogDesigners() {
  if (!catalogDesignersCache) {
    catalogDesignersCache = (async () => {
      const [d, p] = await Promise.all([
        supabase.from("designers").select("name, display_name").limit(2000),
        supabase.from("trade_products").select("brand_name").not("brand_name", "is", null).limit(5000),
      ]);
      const map = new Map<string, string>();
      const push = (v?: string | null) => { const t = v?.trim(); if (t && !map.has(t.toLowerCase())) map.set(t.toLowerCase(), t); };
      (d.data ?? []).forEach((r: any) => { push(r.display_name || r.name); });
      (p.data ?? []).forEach((r: any) => push(r.brand_name));
      return [...map.values()].sort((a, b) => a.localeCompare(b));
    })().catch(() => { catalogDesignersCache = null; return []; });
  }
  return catalogDesignersCache;
}

let catalogMaterialsCache: Promise<string[]> | null = null;
function loadCatalogMaterials() {
  if (!catalogMaterialsCache) {
    catalogMaterialsCache = (async () => {
      const { data, error } = await (supabase.rpc as any)("catalog_material_terms");
      if (error) throw error;
      return ((data ?? []) as { term: string }[]).map((r) => r.term).filter(Boolean);
    })().catch(() => { catalogMaterialsCache = null; return []; });
  }
  return catalogMaterialsCache;
}

function EditableBlock({ title, values, onChange, placeholder, suggestions, onPick, kind = "neutral" }: { title: string; values: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[]; onPick?: (next: string[]) => void; kind?: ChipKind }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const q = draft.trim().toLowerCase();
  const matches = suggestions && q
    ? suggestions.filter((s) => s.toLowerCase().includes(q) && !values.some((v) => v.toLowerCase() === s.toLowerCase())).slice(0, 8)
    : [];
  const showList = open && matches.length > 0;
  const add = () => {
    const v = draft.trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v].slice(0, 12));
    setDraft("");
  };
  const pick = (name: string) => {
    const next = values.some((x) => x.toLowerCase() === name.toLowerCase()) ? values : [...values, name].slice(0, 12);
    onChange(next);
    onPick?.(next);
    setDraft(""); setOpen(false); setHi(0);
  };
  return (
    <div className="border-t border-border pt-4 first:border-t-0 first:pt-0">
      <h4 className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">{title}</h4>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {values.map((value, index) => (
          <span key={`${value}-${index}`} className={chipClass(kind, true)}>
            {value}
            <button type="button" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((_, i) => i !== index))} className={chipCloseClass(kind)}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="relative min-w-[8rem] flex-1">
          <input
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setOpen(true); setHi(0); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (showList && e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % matches.length); return; }
              if (showList && e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h - 1 + matches.length) % matches.length); return; }
              if (showList && e.key === "Escape") { setOpen(false); return; }
              if (e.key === "Enter" && showList) { e.preventDefault(); pick(matches[Math.min(hi, matches.length - 1)]); return; }
              if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
            }}
            onBlur={() => { setOpen(false); add(); }}
            maxLength={60}
            placeholder={`+ Add ${placeholder}`}
            role={suggestions ? "combobox" : undefined}
            aria-expanded={suggestions ? showList : undefined}
            className="w-full border-b border-dashed border-border bg-transparent px-1 py-1 font-body text-[11px] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
          />
          {showList && (
            <ul role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-auto border border-border bg-visual-evidence text-xs shadow-md">
              {matches.map((m, i) => (
                <li
                  key={m}
                  role="option"
                  aria-selected={i === hi}
                  onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                  onMouseEnter={() => setHi(i)}
                  className={`flex cursor-pointer items-center space-x-3 px-3 py-1.5 font-body text-foreground ${i === hi ? "bg-muted" : ""}`}
                >
                  <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-sm border ${kind === "material" ? "border-chip-material-border bg-suggestion-material" : kind === "affinity" ? "border-chip-affinity bg-chip-affinity" : "border-border bg-muted-foreground/40"}`} />
                  <span className="truncate">{m}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VisualThemeAnalysis({ dna, accountId, onSaved }: { dna: VisualThemeDna; accountId?: string; onSaved?: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ tones: [] as string[], affinities: [] as string[], materials: [] as string[] });
  const dialect = cleanList(dna.dominant_tones);
  const affinities = cleanList(dna.historical_affinities);
  const materials = cleanList(dna.materials);
  const images = cleanList(dna.image_urls, 6);
  const palette = (editing ? draft.tones : dialect).slice(0, 4);

  while (palette.length < 4) palette.push(["Deep Ink", "Jade", "Terracotta", "Warm Gold"][palette.length]);

  const [catalog, setCatalog] = useState<string[]>([]);
  useEffect(() => { if (editing && !catalog.length) loadCatalogDesigners().then(setCatalog); }, [editing, catalog.length]);

  const [materialCatalog, setMaterialCatalog] = useState<string[]>([]);
  useEffect(() => { if (editing && !materialCatalog.length) loadCatalogMaterials().then(setMaterialCatalog); }, [editing, materialCatalog.length]);

  const persistField = (field: "historical_affinities" | "materials", label: string) => async (next: string[]) => {
    if (!accountId) return;
    const { data, error } = await supabase
      .from("studio_aesthetic_dna")
      .update({ [field]: next, status: "complete", error: null } as any)
      .eq("trade_account_id", accountId)
      .select("trade_account_id");
    if (error || !data?.length) toast.error(error?.message ?? `Could not save ${label}.`);
    else toast.success(`${label[0].toUpperCase()}${label.slice(1)} added to profile.`);
  };
  const persistAffinities = persistField("historical_affinities", "designer");
  const persistMaterials = persistField("materials", "material");

  const toggle = async () => {
    if (!editing) {
      setDraft({ tones: cleanList(dna.dominant_tones, 12), affinities: cleanList(dna.historical_affinities, 12), materials: cleanList(dna.materials, 12) });
      setEditing(true);
      return;
    }
    if (!accountId) { setEditing(false); return; }
    setSaving(true);
    const hasTags = draft.tones.length + draft.affinities.length + draft.materials.length > 0;
    const { data, error } = await supabase
      .from("studio_aesthetic_dna")
      .update({
        dominant_tones: draft.tones,
        historical_affinities: draft.affinities,
        materials: draft.materials,
        ...(hasTags ? { status: "complete", error: null } : {}),
      })
      .eq("trade_account_id", accountId)
      .select("trade_account_id");
    setSaving(false);
    if (error || !data?.length) { toast.error(error?.message ?? "Could not save tags."); return; }
    toast.success("Tags saved.");
    setEditing(false);
    onSaved?.();
  };

  return (
    <section className="border-t border-border bg-card" aria-label="Visual theme analysis">
      <div className="grid min-w-0 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <div className="min-w-0 space-y-6 border-b border-border p-5 md:p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Curatorial Insights</p>
              <h3 className="mt-2 font-serif text-xl text-foreground">{dna.aesthetic_label || "Studio Visual Language"}</h3>
            </div>
            {accountId && (
              <div className="flex shrink-0 items-center gap-3">
                {editing && (
                  <button type="button" onClick={() => setEditing(false)} disabled={saving} className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={toggle}
                  disabled={saving}
                  aria-pressed={editing}
                  className="inline-flex items-center gap-1.5 font-body text-[10px] uppercase tracking-[0.2em] text-foreground hover:text-primary disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : editing ? <Check className="h-3 w-3" /> : <Pencil className="h-3 w-3" />}
                  {editing ? "[ Save Tags ]" : "[ Edit Tags ]"}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <>
              <EditableBlock title="Design Dialect" placeholder="Tag" values={draft.tones} onChange={(tones) => setDraft((d) => ({ ...d, tones }))} />
              <EditableBlock title="Historical Affinities" placeholder="Tag" values={draft.affinities} onChange={(affinities) => setDraft((d) => ({ ...d, affinities }))} suggestions={catalog} onPick={persistAffinities} kind="affinity" />
              <EditableBlock title="Materiality Profile" placeholder="Tag" values={draft.materials} onChange={(materials) => setDraft((d) => ({ ...d, materials }))} suggestions={materialCatalog} onPick={persistMaterials} kind="material" />
            </>
          ) : (
            <>
              <InsightBlock title="Design Dialect" values={dialect} />
              <InsightBlock title="Historical Affinities" values={affinities} kind="affinity" />
              <InsightBlock title="Materiality Profile" values={materials} kind="material" />
            </>
          )}

          <div className="border-t border-border pt-4">
            <h4 className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">AI Summary Notes</h4>
            <div className="mt-3 min-h-24 border-l-2 border-primary/60 pl-4">
              <p className="font-serif text-sm leading-6 text-foreground/80">
                {dna.aesthetic_summary || "No summary notes were returned for this analysis."}
              </p>
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-hidden p-5 md:p-7">
          <div className="flex min-w-0 flex-col gap-2 xs:flex-row xs:items-end xs:justify-between xs:gap-4">
            <div>
              <p className="font-body text-[9px] uppercase tracking-[0.3em] text-muted-foreground">Source Review</p>
              <h3 className="mt-2 font-serif text-xl text-foreground">Visual Evidence Matrix</h3>
            </div>
            <span className="shrink-0 font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{images.length}/6 assets</span>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-1.5 md:gap-2">
            {Array.from({ length: 6 }, (_, index) => (
              <EvidenceImage key={images[index] ?? `empty-${index}`} src={images[index]} index={index} />
            ))}
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="font-body text-[10px] font-semibold uppercase tracking-[0.24em] text-foreground">Derived Palette</p>
            <div className="mt-3 flex min-w-0">
              {palette.map((tone, index) => (
                <div key={`${tone}-${index}`} className="min-w-0 flex-1">
                  <div className={`h-7 w-full ${toneClass(tone, index)}`} aria-label={tone} />
                  <p className="mt-2 truncate pr-2 font-body text-[9px] uppercase tracking-[0.12em] text-muted-foreground" title={tone}>
                    {tone}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}