import { Helmet } from "react-helmet-async";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { replacementCandidates, type ReplacementProduct } from "@/lib/specSheetReplacement";
import { retainedSpecItems, specRemovalKey } from "@/lib/specSheetRemoval";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cleanSpecDescription, specClientPriceCents, specDimensions, specFinishes, SPEC_DIMENSIONS_PLACEHOLDER } from "@/lib/specSheetCard";
import { materialSwatchTone } from "@/lib/materialSwatch";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Check, FileDown, ImageIcon, Search, Upload, X, Replace } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface SpecItem {
  item_id: string;
  source_product_id: string;
  replacement_id: string | null;
  product_name: string;
  brand_name: string;
  category: string;
  dimensions: string;
  finish: string;
  finishes: string[];
  description: string;
  image_url: string;
  quantity: number;
  client_price_cents: number | null;
  currency: string;
  project_name: string | null;
  client_name: string | null;
}

type ThemeKey = "mono" | "warm" | "corporate";

const THEMES: Record<ThemeKey, {
  label: string;
  ink: string;
  muted: string;
  accent: string;
  rule: string;
  paper: string;
  heading: string;
  body: string;
  swatch: string[];
}> = {
  mono: {
    label: "Minimalist Monochrome",
    ink: "#111111", muted: "#6b6b6b", accent: "#111111", rule: "#e2e2e2", paper: "#ffffff",
    heading: "'Times New Roman', Georgia, serif",
    body: "Helvetica, Arial, sans-serif",
    swatch: ["#111111", "#6b6b6b", "#e2e2e2"],
  },
  warm: {
    label: "Warm Luxury",
    ink: "#2b241c", muted: "#8a7a66", accent: "#9a7b4f", rule: "#e6ddd0", paper: "#fdfbf7",
    heading: "Georgia, 'Times New Roman', serif",
    body: "Georgia, 'Times New Roman', serif",
    swatch: ["#2b241c", "#9a7b4f", "#e6ddd0"],
  },
  corporate: {
    label: "Corporate Sleek",
    ink: "#0f1f2e", muted: "#5b6b7a", accent: "#1c5d99", rule: "#dde5ec", paper: "#ffffff",
    heading: "Helvetica, Arial, sans-serif",
    body: "Helvetica, Arial, sans-serif",
    swatch: ["#0f1f2e", "#1c5d99", "#dde5ec"],
  },
};

type FieldKey = "brand" | "category" | "dimensions" | "finish" | "description" | "price" | "quantity";

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "dimensions", label: "Dimensions" },
  { key: "finish", label: "Finish" },
  { key: "description", label: "Description" },
  { key: "quantity", label: "Quantity" },
  { key: "price", label: "Client price" },
];

interface DeckSettings {
  logoUrl: string;
  projectName: string;
  proposalTitle: string;
  theme: ThemeKey;
  fields: Record<FieldKey, boolean>;
}

const SETTINGS_KEY = "trade-spec-generator-settings-v1";
const DEFAULT_LOGO = "/logo.png";

const DEFAULT_SETTINGS: DeckSettings = {
  logoUrl: DEFAULT_LOGO,
  projectName: "",
  proposalTitle: "Specification Proposal",
  theme: "mono",
  fields: { brand: true, category: true, dimensions: true, finish: true, description: true, quantity: true, price: true },
};

function loadSettings(): DeckSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      fields: { ...DEFAULT_SETTINGS.fields, ...(parsed?.fields || {}) },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function money(cents: number | null, currency = "EUR") {
  if (cents == null || cents <= 0) return "Price upon Request";
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "SGD" ? "S$" : "€";
  return `${symbol}${(cents / 100).toLocaleString("en", { maximumFractionDigits: 0 })}`;
}

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TradeSpecSheetGenerator() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [replacementItem, setReplacementItem] = useState<SpecItem | null>(null);
  const [savingReplacement, setSavingReplacement] = useState(false);
  const [replacementError, setReplacementError] = useState("");
  const { projectFilter, clearProjectFilter } = useProjectFilter();

  const [settings, setSettings] = useState<DeckSettings>(() => loadSettings());
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [initialised, setInitialised] = useState(false);
  const [removals, setRemovals] = useState<{ key: string; ids: string[] }>({ key: "", ids: [] });
  const removalKey = user ? specRemovalKey(user.id, projectFilter) : "";
  const removedIds = removals.key === removalKey ? removals.ids : [];
  useEffect(() => {
    if (!removalKey) return;
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(removalKey) || "[]");
      setRemovals({ key: removalKey, ids: Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [] });
    } catch { setRemovals({ key: removalKey, ids: [] }); }
  }, [removalKey]);
  const saveRemovals = (ids: string[]) => {
    setRemovals({ key: removalKey, ids });
    try { localStorage.setItem(removalKey, JSON.stringify(ids)); } catch { /* current page still updates */ }
  };

  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
  }, [settings]);

  const patch = (next: Partial<DeckSettings>) => setSettings((s) => ({ ...s, ...next }));
  const toggleField = (key: FieldKey) =>
    setSettings((s) => ({ ...s, fields: { ...s.fields, [key]: !s.fields[key] } }));

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["spec-generator-items", user?.id, projectFilter],
    queryFn: async (): Promise<SpecItem[]> => {
      if (!user) return [];
      let qq = supabase
        .from("trade_quotes")
        .select("id, client_name, status, project_id")
        .eq("user_id", user.id)
        .in("status", ["draft", "confirmed", "submitted", "responded", "priced", "deposit_paid", "paid"]);
      if (projectFilter) qq = qq.eq("project_id", projectFilter);
      const { data: quotes } = await qq;
      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q: any) => q.id);
      const { data: qItems } = await supabase
        .from("trade_quote_items")
        .select("id, product_id, quantity, unit_price_cents, quote_id")
        .in("quote_id", quoteIds);
      if (!qItems?.length) return [];

      const { data: replacements, error: replacementReadError } = await supabase.from("spec_sheet_catalogue_replacements")
        .select("source_product_id, replacement_product_id").eq("user_id", user.id);
      if (replacementReadError) throw replacementReadError;
      const replacementMap = Object.fromEntries((replacements || []).map(r => [r.source_product_id, r.replacement_product_id]));
      const productIds = [...new Set([...qItems.map(i => i.product_id), ...Object.values(replacementMap)])];
      const { data: products } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, category, currency, dimensions, width_mm, depth_mm, height_mm, size_variants, default_variant_label, description, materials_description, meta_description, materials, image_url, gallery_images, available_finishes, rrp_price_cents")
        .in("id", productIds);

      const projectIds = [...new Set(quotes.map((q: any) => q.project_id).filter(Boolean))] as string[];
      const { data: projects } = projectIds.length
        ? await supabase.from("projects" as any).select("id, name").in("id", projectIds)
        : { data: [] as any[] };

      const productMap = Object.fromEntries(((products as any[]) || []).map((p: any) => [p.id, p]));
      const quoteMap = Object.fromEntries((quotes as any[]).map((q: any) => [q.id, q]));
      const projectMap = Object.fromEntries((((projects as any[]) || [])).map((p: any) => [p.id, p.name]));

      const seen = new Set<string>();
      const rows: SpecItem[] = [];
      for (const item of qItems as any[]) {
        const replacementId = replacementMap[item.product_id];
        const p: any = productMap[replacementId] || productMap[item.product_id];
        if (!p) continue;
        if (seen.has(item.product_id)) continue;
        seen.add(item.product_id);
        const q: any = quoteMap[item.quote_id];
        rows.push({
          item_id: item.id,
          source_product_id: item.product_id,
          replacement_id: replacementId && productMap[replacementId] ? replacementId : null,
          product_name: p.product_name || "Unknown item",
          brand_name: p.brand_name || "",
          category: p.category || "",
          dimensions: specDimensions(p),
          finishes: specFinishes(p),
          finish: specFinishes(p).join(" / "),
          description: cleanSpecDescription(p),
          image_url: p.image_url || p.gallery_images?.[0] || "",
          quantity: item.quantity || 1,
          client_price_cents: specClientPriceCents(p, replacementId ? null : item.unit_price_cents),
          currency: p.currency || "EUR",
          project_name: q?.project_id ? projectMap[q.project_id] || null : null,
          client_name: q?.client_name || null,
        });
      }
      return rows;
    },
    enabled: !!user,
  });

  const { data: candidates = [], isFetching: loadingCandidates, error: candidateError } = useQuery({
    queryKey: ["spec-replacement-candidates", user?.id, replacementItem?.source_product_id],
    enabled: !!user && !!replacementItem,
    queryFn: async () => {
      if (!replacementItem) return [];
      const { data, error } = await supabase.from("trade_products")
        .select("id, product_name, brand_name, category, currency, description, materials_description, meta_description, materials, size_variants, default_variant_label, available_finishes, rrp_price_cents, is_active, is_hidden")
        .ilike("product_name", `%${replacementItem.product_name.trim().replace(/[%_]/g, '')}%`);
      if (error) throw error;
      const products: ReplacementProduct[] = (data || []).map(p => ({
        ...p,
        size_variants: Array.isArray(p.size_variants) ? p.size_variants.flatMap(v => {
          if (!v || typeof v !== "object" || Array.isArray(v)) return [];
          return [{ label: typeof v.label === "string" ? v.label : null,
            base: typeof v.base === "string" ? v.base : null, top: typeof v.top === "string" ? v.top : null,
            price_cents: typeof v.price_cents === "number" ? v.price_cents : null }];
        }) : [],
      }));
      return replacementCandidates({ id: replacementItem.source_product_id, product_name: replacementItem.product_name, category: replacementItem.category }, products);
    },
  });

  const saveReplacement = async (candidate: ReplacementProduct | null) => {
    if (!user || !replacementItem || savingReplacement) return;
    setSavingReplacement(true);
    setReplacementError("");
    try {
      const result = candidate
        ? await supabase.from("spec_sheet_catalogue_replacements").upsert({ user_id: user.id, source_product_id: replacementItem.source_product_id, replacement_product_id: candidate.id })
        : await supabase.from("spec_sheet_catalogue_replacements").delete().eq("user_id", user.id).eq("source_product_id", replacementItem.source_product_id);
      if (result.error) throw result.error;
      await queryClient.invalidateQueries({ queryKey: ["spec-generator-items", user.id] });
      setReplacementItem(null);
      toast({ title: candidate ? "Complete catalogue record saved" : "Original record restored" });
    } catch {
      setReplacementError("The replacement could not be saved. Please try again.");
    } finally {
      setSavingReplacement(false);
    }
  };

  // Select every item the first time the catalog loads.
  useEffect(() => {
    if (initialised || !items.length) return;
    setSelected(Object.fromEntries(items.map((i) => [i.item_id, true])));
    setInitialised(true);
  }, [items, initialised]);

  const sheetItems = useMemo(() => retainedSpecItems(items, removedIds), [items, removedIds]);
  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sheetItems;
    return sheetItems.filter((i) =>
      [i.product_name, i.brand_name, i.category, i.dimensions, i.finish, i.project_name, i.client_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [sheetItems, search]);

  const chosen = useMemo(() => sheetItems.filter((i) => selected[i.item_id]), [sheetItems, selected]);
  const currency = items[0]?.currency || "EUR";

  const toggleItem = (id: string) => setSelected((s) => ({ ...s, [id]: !s[id] }));
  const selectAll = () => setSelected(Object.fromEntries(visibleItems.map((i) => [i.item_id, true])));
  const clearAll = () => setSelected({});

  const onLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > 1_500_000) {
      toast({ title: "Logo too large", description: "Please use an image under 1.5 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => patch({ logoUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  };

  /* ---------------- PDF / print export ---------------- */

  const exportPdf = () => {
    if (!chosen.length) {
      toast({ title: "Nothing selected", description: "Tick at least one item to include in the deck." });
      return;
    }
    const t = THEMES[settings.theme];
    const f = settings.fields;
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const title = settings.proposalTitle.trim() || "Specification Proposal";
    const project = settings.projectName.trim() || chosen[0]?.project_name || "";

    const row = (label: string, value: string) =>
      value
        ? `<tr><th>${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
        : "";

    const sheets = chosen.map((i) => `
      <section class="sheet">
        <div class="sheet-img">${
          i.image_url
            ? `<img src="${escapeHtml(i.image_url)}" alt="${escapeHtml(i.product_name)}" />`
            : `<div class="noimg">No image</div>`
        }</div>
        <div class="sheet-body">
          <h2>${escapeHtml(i.product_name)}</h2>
          ${f.brand && i.brand_name ? `<p class="brand">${escapeHtml(i.brand_name)}</p>` : ""}
          <table class="meta">
            ${f.category ? row("Category", i.category) : ""}
            ${f.dimensions ? row("Dimensions", i.dimensions) : ""}
            ${f.finish ? row("Finish", i.finish) : ""}
            ${f.quantity ? row("Quantity", String(i.quantity)) : ""}
            ${f.price ? row("Client price", money(i.client_price_cents, i.currency)) : ""}
          </table>
          ${f.description && i.description ? `<p class="desc">${escapeHtml(i.description)}</p>` : ""}
        </div>
      </section>`).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin:0; background:${t.paper}; color:${t.ink}; font-family:${t.body}; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .cover { height: 247mm; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; page-break-after:always; break-after:page; }
  .cover img { max-height: 26mm; max-width: 70mm; object-fit:contain; margin-bottom: 18mm; }
  .cover h1 { font-family:${t.heading}; font-size: 30pt; font-weight:400; letter-spacing:.02em; margin:0 0 6mm; }
  .cover .project { font-size: 12pt; letter-spacing:.28em; text-transform:uppercase; color:${t.accent}; margin:0 0 14mm; }
  .cover .rule { width: 40mm; height:1px; background:${t.accent}; margin: 0 0 14mm; }
  .cover .date { font-size: 9pt; letter-spacing:.2em; text-transform:uppercase; color:${t.muted}; }
  .sheet { display:flex; gap: 10mm; align-items:flex-start; padding: 8mm 0; border-bottom:1px solid ${t.rule};
           page-break-inside: avoid; break-inside: avoid; }
  .sheet-img { width: 74mm; flex: 0 0 74mm; }
  .sheet-img img { width:100%; height: 62mm; object-fit:cover; display:block; background:#f3f3f3; }
  .noimg { width:100%; height:62mm; background:#f3f3f3; color:${t.muted}; font-size:8pt; letter-spacing:.2em;
           text-transform:uppercase; display:flex; align-items:center; justify-content:center; }
  .sheet-body { flex:1 1 auto; }
  .sheet-body h2 { font-family:${t.heading}; font-weight:400; font-size: 16pt; margin:0 0 2mm; }
  .brand { margin:0 0 4mm; font-size: 8pt; letter-spacing:.26em; text-transform:uppercase; color:${t.accent}; }
  table.meta { width:100%; border-collapse:collapse; margin-bottom: 4mm; }
  table.meta th { text-align:left; width: 30mm; padding: 1.4mm 0; font-size: 7.5pt; font-weight:400;
                  letter-spacing:.18em; text-transform:uppercase; color:${t.muted}; vertical-align:top; }
  table.meta td { padding: 1.4mm 0; font-size: 9.5pt; color:${t.ink}; }
  .desc { font-size: 9pt; line-height: 1.55; color:${t.ink}; text-align: justify; margin: 0; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 7pt; letter-spacing:.2em;
           text-transform:uppercase; color:${t.muted}; text-align:center; }
</style></head><body>
  <div class="cover">
    ${settings.logoUrl ? `<img src="${escapeHtml(settings.logoUrl)}" alt="Logo" />` : ""}
    <h1>${escapeHtml(title)}</h1>
    ${project ? `<p class="project">${escapeHtml(project)}</p>` : ""}
    <div class="rule"></div>
    <p class="date">${escapeHtml(today)}</p>
  </div>
  ${sheets}
</body></html>`;

    const frame = window.document.createElement("iframe");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
    window.document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    const run = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      window.setTimeout(() => frame.remove(), 1500);
    };
    if (frame.contentWindow?.document.readyState === "complete") window.setTimeout(run, 500);
    else frame.onload = () => window.setTimeout(run, 500);
  };

  /* ---------------- Render ---------------- */

  return (
    <div className="mx-auto w-[92%] max-w-[1800px] space-y-6">
      <Helmet>
        <title>Specification Sheet Generator | Maison Affluency</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <TradeBreadcrumb />

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl tracking-wide text-foreground">Specification Sheet Generator</h1>
          <p className="mt-1 font-body text-sm text-muted-foreground">
            Curate project items and export a branded client pitch — supplier costs never leave the studio.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {projectFilter && (
            <Button variant="ghost" size="sm" className="font-body text-xs" onClick={clearProjectFilter}>
              <X className="mr-1 h-3 w-3" /> Clear project filter
            </Button>
          )}
          <Button onClick={exportPdf} className="font-body text-xs uppercase tracking-widest">
            <FileDown className="mr-2 h-4 w-4" />
            Export Branded Pitch PDF ({chosen.length})
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* -------- Catalog grid -------- */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items, brands, categories…"
                className="pl-9 font-body text-sm"
              />
            </div>
            <Button variant="outline" size="sm" className="font-body text-xs" onClick={selectAll}>Select all</Button>
            <Button variant="ghost" size="sm" className="font-body text-xs" onClick={clearAll}>Clear</Button>
            {removedIds.length > 0 && <Button variant="ghost" size="sm" onClick={() => saveRemovals([])}>Restore removed ({removedIds.length})</Button>}
            <span className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              {chosen.length} of {sheetItems.length} selected
            </span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-20"><DotCircleLoader /></div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-12 text-center font-body text-sm text-muted-foreground">
              No project items found. Add products to a quote to build a presentation deck.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visibleItems.map((i) => {
                const isOn = !!selected[i.item_id];
                return (
                  <div key={i.item_id} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleItem(i.item_id)}
                    aria-pressed={isOn}
                    className={cn(
                      "group relative flex h-full w-full flex-col overflow-hidden rounded-lg border bg-card text-left transition-all duration-200",
                      isOn ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border transition-colors duration-200",
                        isOn ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background/90 text-transparent",
                      )}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                    <div className="aspect-[4/3] w-full shrink-0 overflow-hidden bg-muted">
                      {i.image_url ? (
                        <img
                          src={i.image_url}
                          alt={i.product_name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      {settings.fields.brand && <p className="h-4 truncate font-body text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{i.brand_name || "\u00a0"}</p>}
                      <p className="mt-1.5 h-5 truncate font-display text-sm text-foreground">{i.product_name}</p>
                      {settings.fields.category && <p className="mt-1 h-4 truncate font-body text-xs text-muted-foreground">{i.category || "\u00a0"}</p>}
                      {settings.fields.dimensions && (
                        <p className={cn("mt-1.5 h-4 truncate font-body text-xs", i.dimensions === SPEC_DIMENSIONS_PLACEHOLDER ? "italic text-muted-foreground/60" : "text-muted-foreground")}>{i.dimensions}</p>
                      )}
                      {settings.fields.finish && (
                        <div className="mt-1.5 flex h-4 min-w-0 items-center gap-1.5">
                          {i.finishes.slice(0, 3).map((f) => (
                            <span key={f} className="h-3 w-3 shrink-0 rounded-full border border-border" style={{ background: materialSwatchTone(f).css }} aria-hidden />
                          ))}
                          <span className={cn("truncate font-body text-xs", i.finish ? "text-muted-foreground" : "italic text-muted-foreground/60")}>{i.finish || "Finish on request"}</span>
                        </div>
                      )}
                      {settings.fields.description && (
                        <p className="mt-1.5 line-clamp-2 h-8 font-body text-xs leading-4 text-muted-foreground">{i.description}</p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-3">
                        {settings.fields.quantity ? (
                          <span className="font-body text-[11px] uppercase tracking-widest text-muted-foreground">Qty {i.quantity}</span>
                        ) : <span />}
                        {settings.fields.price && (
                          <span className="font-body text-sm text-foreground">{money(i.client_price_cents, i.currency)}</span>
                        )}
                      </div>
                    </div>
                  </button>
                  <Button variant="outline" size="icon" title="Replace catalogue record" aria-label={`Replace catalogue record for ${i.product_name.trim()}`}
                    className="absolute left-2 top-2 z-10 h-7 w-7 bg-background/90"
                    onClick={() => { setReplacementError(""); setReplacementItem(i); }}>
                    <Replace className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="icon" title="Remove from sheet" aria-label={`Remove ${i.product_name.trim()} from sheet`}
                    className="absolute right-10 top-2 z-10 h-7 w-7 bg-background/90"
                    onClick={() => saveRemovals([...removedIds, i.item_id])}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* -------- Customizer sidebar -------- */}
        <aside className="h-fit space-y-6 rounded-lg border border-border bg-card p-5 xl:sticky xl:top-6">
          <div>
            <h2 className="font-body text-xs uppercase tracking-[0.22em] text-muted-foreground">Header &amp; branding</h2>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-20 items-center justify-center overflow-hidden rounded border border-border bg-background">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Deck logo" className="max-h-12 max-w-[72px] object-contain" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="logo-upload" className="inline-flex cursor-pointer items-center gap-2 rounded border border-border px-3 py-1.5 font-body text-xs hover:bg-muted">
                    <Upload className="h-3.5 w-3.5" /> Upload logo
                  </Label>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onLogoFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => patch({ logoUrl: DEFAULT_LOGO })}
                    className="block font-body text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  >
                    Use Maison Affluency logo
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-name" className="font-body text-xs text-muted-foreground">Project name</Label>
                <Input
                  id="project-name"
                  value={settings.projectName}
                  onChange={(e) => patch({ projectName: e.target.value })}
                  placeholder="e.g. Villa Alix — Ground Floor"
                  className="font-body text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proposal-title" className="font-body text-xs text-muted-foreground">Proposal title</Label>
                <Input
                  id="proposal-title"
                  value={settings.proposalTitle}
                  onChange={(e) => patch({ proposalTitle: e.target.value })}
                  placeholder="Specification Proposal"
                  className="font-body text-sm"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="font-body text-xs uppercase tracking-[0.22em] text-muted-foreground">Typography &amp; theme</h2>
            <div className="mt-3 space-y-3">
              <Select value={settings.theme} onValueChange={(v) => patch({ theme: v as ThemeKey })}>
                <SelectTrigger className="font-body text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                    <SelectItem key={k} value={k} className="font-body text-sm">{THEMES[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                {THEMES[settings.theme].swatch.map((c) => (
                  <span key={c} className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: c }} />
                ))}
                <span className="font-body text-[11px] text-muted-foreground">Deck palette</span>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <h2 className="font-body text-xs uppercase tracking-[0.22em] text-muted-foreground">Information shown</h2>
            <div className="mt-3 space-y-2.5">
              {FIELDS.map((field) => (
                <label key={field.key} className="flex cursor-pointer items-center gap-2.5 font-body text-sm text-foreground">
                  <Checkbox checked={settings.fields[field.key]} onCheckedChange={() => toggleField(field.key)} />
                  {field.label}
                </label>
              ))}
            </div>
            <p className="mt-3 font-body text-[11px] leading-relaxed text-muted-foreground">
              Supplier costs and studio margins are never included in the exported deck.
            </p>
          </div>

          <Button onClick={exportPdf} className="w-full font-body text-xs uppercase tracking-widest">
            <FileDown className="mr-2 h-4 w-4" /> Export Branded Pitch PDF
          </Button>
          <p className="text-center font-body text-[11px] text-muted-foreground">
            {chosen.length} item{chosen.length === 1 ? "" : "s"} · {money(
              chosen.reduce((s, i) => s + (i.client_price_cents || 0) * i.quantity, 0),
              currency,
            )}
          </p>
        </aside>
      </div>
      <Dialog open={!!replacementItem} onOpenChange={(open) => { if (!open && !savingReplacement) setReplacementItem(null); }}>
        <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Replace catalogue record</DialogTitle>
            <DialogDescription>{replacementItem?.product_name} — use complete specifications and catalogue prices in this sheet and its PDF. Saved quotes and quantities remain unchanged.</DialogDescription>
          </DialogHeader>
          {loadingCandidates ? <DotCircleLoader /> : candidateError ? <p className="text-sm text-destructive">Catalogue records could not be loaded. Close and try again.</p> : candidates.length === 0 ? <p className="text-sm text-muted-foreground">No complete matching catalogue record is available.</p> : candidates.map(p => (
            <div key={p.id} className="space-y-3 border-t border-border pt-4">
              <p className="font-display text-lg">{p.brand_name}</p>
              <p className="text-sm text-muted-foreground">{specDimensions(p)}</p>
              <p className="text-sm">{specFinishes(p).join(" / ")}</p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{cleanSpecDescription(p)}</p>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span>{money(specClientPriceCents(p), p.currency || "EUR")}</span>
                <Button disabled={savingReplacement || replacementItem?.replacement_id === p.id} onClick={() => saveReplacement(p)}>
                  <Replace className="mr-2 h-4 w-4" />{replacementItem?.replacement_id === p.id ? "Current record" : "Use this record"}
                </Button>
              </div>
            </div>
          ))}
          {replacementItem?.replacement_id && <Button variant="outline" disabled={savingReplacement} onClick={() => saveReplacement(null)}>Restore original record</Button>}
          <p role="alert" className="min-h-5 text-sm text-destructive">{replacementError}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
