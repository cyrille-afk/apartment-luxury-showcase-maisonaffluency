import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Sparkles, Copy, Check, Save, RefreshCw, Layers, Square, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import AlphabetProductPicker, { type PickerItem } from "@/components/trade/AlphabetProductPicker";
import AlphabetGroupPicker from "@/components/trade/AlphabetGroupPicker";

type Tone = "editorial" | "technical" | "seo";
type Source = "curator_picks" | "trade_products";
type Mode = "single" | "bulk";
type RowStatus = "pending" | "generating" | "saved" | "skipped" | "failed";

interface BulkRow {
  id: string;
  label: string;
  hasExisting: boolean;
  status: RowStatus;
  error?: string;
  warning?: string;
}

const TONES: { value: Tone; label: string; desc: string }[] = [
  { value: "editorial", label: "Editorial", desc: "Evocative storytelling for journals & social" },
  { value: "technical", label: "Technical", desc: "Precise specs for trade sheets & quotes" },
  { value: "seo", label: "SEO", desc: "Keyword-rich copy for product pages" },
];

async function callDescriptionWriter(productId: string, source: Source, tone: Tone): Promise<{ description: string; length: number; seoWarning: string | null }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const resp = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-description-writer`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ product_id: productId, source, tone }),
    }
  );
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error || `Error ${resp.status}`);
  }
  const data = await resp.json();
  return {
    description: data.description || "",
    length: typeof data.length === "number" ? data.length : (data.description || "").length,
    seoWarning: data.seo_warning || null,
  };
}

async function saveDescription(productId: string, source: Source, description: string) {
  const table = source === "curator_picks" ? "designer_curator_picks" : "trade_products";
  const { error } = await supabase.from(table).update({ description }).eq("id", productId);
  if (error) throw error;
}

const PERSIST_KEY = "trade-description-writer:v1";

type PersistedState = {
  mode: Mode;
  source: Source;
  tone: Tone;
  bulkDesigner: string;
  skipExisting: boolean;
  bulkRows: BulkRow[];
  bulkProgress: { done: number; total: number };
};

function loadPersisted(): Partial<PersistedState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedState;
  } catch {
    return {};
  }
}

export default function TradeDescriptionWriter() {
  const { isAdmin, loading } = useAuth();
  const persisted = useRef<Partial<PersistedState>>(loadPersisted()).current;

  const [mode, setMode] = useState<Mode>(persisted.mode ?? "single");
  const [source, setSource] = useState<Source>(persisted.source ?? "curator_picks");
  const [productId, setProductId] = useState("");
  const [tone, setTone] = useState<Tone>(persisted.tone ?? "editorial");
  const [result, setResult] = useState("");
  const [resultLength, setResultLength] = useState(0);
  const [seoWarning, setSeoWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Bulk state
  const [bulkDesigner, setBulkDesigner] = useState<string>(persisted.bulkDesigner ?? "");
  const [skipExisting, setSkipExisting] = useState(persisted.skipExisting ?? true);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => {
    // Any rows mid-flight when we left are considered failed (interrupted)
    return (persisted.bulkRows ?? []).map((r) =>
      r.status === "generating" ? { ...r, status: "pending" as RowStatus } : r,
    );
  });
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(persisted.bulkProgress ?? { done: 0, total: 0 });
  const [cancelRequested, setCancelRequested] = useState(false);

  // Persist bulk session so navigating away & back doesn't wipe progress
  useEffect(() => {
    try {
      const payload: PersistedState = {
        mode, source, tone, bulkDesigner, skipExisting, bulkRows, bulkProgress,
      };
      sessionStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
    } catch { /* quota — ignore */ }
  }, [mode, source, tone, bulkDesigner, skipExisting, bulkRows, bulkProgress]);

  // Warn if the user tries to close/reload while a bulk run is active
  useEffect(() => {
    if (!bulkRunning) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [bulkRunning]);

  // Fetch curator picks
  const { data: curatorPicks = [] } = useQuery({
    queryKey: ["desc-writer-curator-picks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("designer_curator_picks")
        .select("id, title, description, designer_id, designers(display_name, name, founder)")
        .order("title")
        .limit(2000);
      return (data || []) as any[];
    },
    enabled: source === "curator_picks",
  });

  // Fetch trade products
  const { data: tradeProducts = [] } = useQuery({
    queryKey: ["desc-writer-trade-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, description")
        .eq("is_active", true)
        .order("product_name")
        .limit(2000);
      return (data || []) as any[];
    },
    enabled: source === "trade_products",
  });

  const items = source === "curator_picks" ? curatorPicks : tradeProducts;

  // Build designer/brand groups for bulk picker.
  // For curator_picks we also synthesise "parent brand" groups that aggregate
  // every pick whose designer.founder == <parent name> (e.g. Ecart bundles
  // Jean-Michel Frank + Paul László + …; Ozone bundles Michel Boyer + …).
  const designerGroups = useMemo(() => {
    const map = new Map<string, { name: string; items: any[] }>();
    const parentMap = new Map<string, any[]>(); // founder -> picks

    for (const p of items) {
      let name: string;
      let founder: string | null = null;
      if (source === "curator_picks") {
        name = p.designers?.name || p.designers?.display_name || "Unknown";
        founder = (p.designers?.founder || "").trim() || null;
      } else {
        name = p.brand_name || "Unknown";
      }
      if (!map.has(name)) map.set(name, { name, items: [] });
      map.get(name)!.items.push(p);

      // Aggregate under parent brand when the designer has a different founder.
      if (founder && founder.toLowerCase() !== name.toLowerCase()) {
        if (!parentMap.has(founder)) parentMap.set(founder, []);
        parentMap.get(founder)!.push(p);
      }
    }

    // Merge parent aggregates into the map (label them clearly).
    for (const [founder, picks] of parentMap) {
      // Include the parent's own picks if any
      const ownGroup = map.get(founder);
      const combined = ownGroup ? [...ownGroup.items, ...picks] : picks;
      // Deduplicate by id
      const seen = new Set<string>();
      const deduped = combined.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
      const label = `${founder} — all designers`;
      map.set(label, { name: label, items: deduped });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, source]);

  const generateMutation = useMutation({
    mutationFn: () => callDescriptionWriter(productId, source, tone),
    onSuccess: ({ description, length, seoWarning }) => {
      setResult(description);
      setResultLength(length);
      setSeoWarning(seoWarning);
      toast.success("Description generated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveMutation = useMutation({
    mutationFn: () => saveDescription(productId, source, result),
    onSuccess: () => toast.success("Description saved to catalog"),
    onError: () => toast.error("Failed to save — check permissions"),
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const prepareBulk = () => {
    const group = designerGroups.find((g) => g.name === bulkDesigner);
    if (!group) return;
    const rows: BulkRow[] = group.items.map((p) => ({
      id: p.id,
      label: source === "curator_picks" ? p.title : p.product_name,
      hasExisting: !!(p.description && String(p.description).trim().length > 0),
      status: "pending",
    }));
    setBulkRows(rows);
    setBulkProgress({ done: 0, total: rows.length });
  };

  const runBulk = async () => {
    if (bulkRows.length === 0) return;
    setBulkRunning(true);
    setCancelRequested(false);
    let done = 0;
    const total = bulkRows.length;
    setBulkProgress({ done, total });

    for (let i = 0; i < bulkRows.length; i++) {
      if (cancelRequested) break;
      const row = bulkRows[i];

      if (skipExisting && row.hasExisting) {
        setBulkRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, status: "skipped" } : r)));
        done++;
        setBulkProgress({ done, total });
        continue;
      }

      setBulkRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, status: "generating" } : r)));

      try {
        const { description, seoWarning } = await callDescriptionWriter(row.id, source, tone);
        await saveDescription(row.id, source, description);
        setBulkRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, status: "saved", warning: seoWarning || undefined } : r)));
      } catch (err: any) {
        const msg = err?.message || "Failed";
        setBulkRows((rows) => rows.map((r, idx) => (idx === i ? { ...r, status: "failed", error: msg } : r)));
        if (/429/.test(msg)) {
          // Rate-limited: pause briefly to recover.
          await new Promise((r) => setTimeout(r, 4000));
        }
      }

      done++;
      setBulkProgress({ done, total });
      // small spacing to be polite to the gateway
      await new Promise((r) => setTimeout(r, 400));
    }

    setBulkRunning(false);
    const saved = bulkRows.filter((r) => r.status === "saved").length;
    toast.success(`Bulk run complete — ${done}/${total} processed`);
  };

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Description Writer — Admin — Maison Affluency</title></Helmet>

      <div className="max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-foreground">Product Description Writer</h1>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              AI-powered copy grounded in your catalog data
            </p>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            onClick={() => setMode("single")}
            className={`flex items-center gap-1.5 px-4 py-2 font-body text-xs transition-colors ${
              mode === "single" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Square className="h-3.5 w-3.5" /> Single product
          </button>
          <button
            onClick={() => setMode("bulk")}
            className={`flex items-center gap-1.5 px-4 py-2 font-body text-xs transition-colors border-l border-border ${
              mode === "bulk" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="h-3.5 w-3.5" /> Bulk by designer
          </button>
        </div>

        {/* Shared: Source + Tone */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Source</label>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as Source);
                setProductId("");
                setResult("");
                setBulkDesigner("");
                setBulkRows([]);
              }}
              className="w-full rounded-md border border-border bg-background px-3 py-2 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
            >
              <option value="curator_picks">Curator Picks (Gallery)</option>
              <option value="trade_products">Trade Products (Showroom)</option>
            </select>
          </div>

          {mode === "single" ? (
            <div className="space-y-1.5">
              <label className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Product</label>
              {(() => {
                const pickerItems: PickerItem[] = source === "curator_picks"
                  ? items.map((p: any) => ({
                      id: p.id,
                      label: p.title,
                      group: p.designers?.name || p.designers?.display_name || "Unknown",
                    }))
                  : items.map((p: any) => ({
                      id: p.id,
                      label: p.product_name,
                      group: p.brand_name || "Unknown",
                    }));
                return (
                  <AlphabetProductPicker
                    items={pickerItems}
                    value={productId}
                    onChange={(id) => { setProductId(id); setResult(""); }}
                    placeholder="Select a product…"
                  />
                );
              })()}
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {source === "curator_picks" ? "Designer" : "Brand"}
              </label>
              <AlphabetGroupPicker
                items={designerGroups.map((g) => ({ name: g.name, count: g.items.length }))}
                value={bulkDesigner}
                onChange={(name) => { setBulkDesigner(name); setBulkRows([]); }}
                placeholder={`Select ${source === "curator_picks" ? "a designer" : "a brand"}…`}
              />

            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Tone</label>
            <div className="flex gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setTone(t.value); setResult(""); }}
                  title={t.desc}
                  className={`flex-1 rounded-md border px-2 py-2 font-body text-xs transition-colors ${
                    tone === t.value
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/30"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* SINGLE mode */}
        {mode === "single" && (
          <>
            <button
              onClick={() => generateMutation.mutate()}
              disabled={!productId || generateMutation.isPending}
              className="flex items-center gap-2 rounded-md bg-foreground text-background px-5 py-2.5 font-body text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {generateMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generateMutation.isPending ? "Generating…" : "Generate Description"}
            </button>

            {result && (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                  <textarea
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    rows={Math.min(20, Math.max(6, result.split("\n").length + 2))}
                    className="w-full resize-y rounded-md border border-border bg-background p-3 font-body text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/20"
                    placeholder="Edit the generated description…"
                  />
                  <details className="group">
                    <summary className="cursor-pointer font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground">
                      Preview
                    </summary>
                    <div className="prose prose-sm max-w-none font-body text-foreground mt-3 pt-3 border-t border-border">
                      <ReactMarkdown>{result}</ReactMarkdown>
                    </div>
                  </details>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <Save className="h-3.5 w-3.5" />
                    {saveMutation.isPending ? "Saving…" : "Save to Catalog"}
                  </button>
                  <button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                    Regenerate
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* BULK mode */}
        {mode === "bulk" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={prepareBulk}
                disabled={!bulkDesigner || bulkRunning}
                className="rounded-md border border-border px-4 py-2 font-body text-xs text-foreground hover:border-foreground/40 transition-colors disabled:opacity-40"
              >
                Load products
              </button>

              <label className="flex items-center gap-2 font-body text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  className="rounded border-border"
                />
                Skip products that already have a description
              </label>

              {bulkRows.length > 0 && (
                <button
                  onClick={runBulk}
                  disabled={bulkRunning}
                  className="ml-auto flex items-center gap-2 rounded-md bg-foreground text-background px-5 py-2.5 font-body text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {bulkRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {bulkRunning
                    ? `Generating… ${bulkProgress.done}/${bulkProgress.total}`
                    : `Generate & save all (${bulkRows.length})`}
                </button>
              )}

              {bulkRunning && (
                <button
                  onClick={() => setCancelRequested(true)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-body text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" /> Stop after current
                </button>
              )}
            </div>

            {bulkRunning && bulkProgress.total > 0 && (
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all duration-300"
                  style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }}
                />
              </div>
            )}

            {bulkRows.length > 0 && (
              <div className="rounded-lg border border-border divide-y divide-border max-h-[60vh] overflow-y-auto">
                {bulkRows.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 font-body text-sm">
                    <div className="shrink-0 w-5 flex items-center justify-center">
                      {row.status === "pending" && <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />}
                      {row.status === "generating" && <Loader2 className="h-4 w-4 animate-spin text-foreground" />}
                      {row.status === "saved" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                      {row.status === "skipped" && <Check className="h-4 w-4 text-muted-foreground/60" />}
                      {row.status === "failed" && <AlertCircle className="h-4 w-4 text-red-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-foreground">{row.label}</p>
                      {row.status === "failed" && row.error && (
                        <p className="text-[11px] text-red-600/80 truncate">{row.error}</p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/80">
                      {row.status === "saved" && "Saved"}
                      {row.status === "skipped" && "Skipped (has description)"}
                      {row.status === "generating" && "Generating…"}
                      {row.status === "pending" && (row.hasExisting ? "Has description" : "Empty")}
                      {row.status === "failed" && "Failed"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {bulkRows.length === 0 && bulkDesigner && (
              <p className="font-body text-xs text-muted-foreground italic">
                Click "Load products" to preview the list before generating.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
