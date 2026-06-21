import { useEffect, useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Ruler, ExternalLink } from "lucide-react";

type QaStatus = "match" | "mismatch" | "no_cad" | "cad_unparsed";
type QaRow = {
  id: string;
  created_at: string;
  mode: string;
  product_id: string;
  product_name: string | null;
  brand_name: string | null;
  status: QaStatus;
  expected_dim_text: string | null;
  applied_dim_text: string | null;
  original_dim_text: string | null;
  delta_cm: { w: number | null; d: number | null; h: number | null } | null;
  tolerance_cm: number;
};

type RenderItem = {
  id: string;
  user_id: string;
  result_image_url: string;
  project_name: string | null;
  created_at: string;
  linked_favorite_product_ids: string[];
};

type RunResult = {
  request_id: string;
  status: "pending" | "running" | "done" | "error";
  error?: string;
  overlayUrl?: string;
  counts?: Record<QaStatus, number>;
};

const STATUS_VARIANT: Record<QaStatus, "default" | "destructive" | "secondary" | "outline"> = {
  match: "secondary",
  mismatch: "destructive",
  no_cad: "outline",
  cad_unparsed: "outline",
};

export default function TradeAdminAxonometricCadQa() {
  const { toast } = useToast();
  const [rows, setRows] = useState<QaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<QaStatus | "all" | "bulk">("mismatch");

  // Bulk-run state
  const [renders, setRenders] = useState<RenderItem[]>([]);
  const [rendersLoading, setRendersLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const [results, setResults] = useState<Record<string, RunResult>>({});

  // Product lookup for the linked product IDs in the loaded renders.
  // Keyed by product_id, used for category + name filtering.
  const [productMeta, setProductMeta] = useState<Record<string, { product_name: string | null; brand_name: string | null; category: string | null }>>({});

  // Filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [productQuery, setProductQuery] = useState<string>("");
  const [pinnedProductIds, setPinnedProductIds] = useState<Set<string>>(new Set());
  // Pinned-product picker: search + lazy "load more" window (keeps DOM small for large catalogs)
  const [pinnedQuery, setPinnedQuery] = useState<string>("");
  const [pinnedVisibleCount, setPinnedVisibleCount] = useState<number>(50);
  const PINNED_PAGE_SIZE = 50;
  const pinnedScrollRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("axonometric_cad_qa")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows(((data || []) as unknown) as QaRow[]);
    setLoading(false);
  };

  const loadRenders = async () => {
    setRendersLoading(true);
    const { data } = await supabase
      .from("axonometric_requests")
      .select("id,user_id,result_image_url,project_name,created_at,linked_favorite_product_ids")
      .not("result_image_url", "is", null)
      .not("linked_favorite_product_ids", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);
    const cleaned = (data || [])
      .map((r: any) => ({
        ...r,
        linked_favorite_product_ids: Array.isArray(r.linked_favorite_product_ids)
          ? r.linked_favorite_product_ids.filter((id: any) => typeof id === "string")
          : [],
      }))
      .filter((r: RenderItem) => r.result_image_url && r.linked_favorite_product_ids.length > 0);
    setRenders(cleaned as RenderItem[]);

    // Hydrate product metadata for category + name filtering
    const allIds = Array.from(new Set(cleaned.flatMap((r: RenderItem) => r.linked_favorite_product_ids)));
    if (allIds.length > 0) {
      const { data: prods } = await supabase
        .from("trade_products")
        .select("id,product_name,brand_name,category")
        .in("id", allIds);
      const map: Record<string, { product_name: string | null; brand_name: string | null; category: string | null }> = {};
      for (const p of (prods || []) as any[]) {
        map[p.id] = {
          product_name: p.product_name ?? null,
          brand_name: p.brand_name ?? null,
          category: (p.category || "").trim() || null,
        };
      }
      setProductMeta(map);
    } else {
      setProductMeta({});
    }
    setRendersLoading(false);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { if (tab === "bulk" && renders.length === 0) loadRenders(); }, [tab]);

  const counts = useMemo(() => {
    const c: Record<QaStatus, number> = { match: 0, mismatch: 0, no_cad: 0, cad_unparsed: 0 };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = tab === "all" ? rows : tab === "bulk" ? [] : rows.filter((r) => r.status === tab);

  // Category options derived from the products actually linked to loaded renders.
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const meta of Object.values(productMeta)) if (meta.category) set.add(meta.category);
    return Array.from(set).sort();
  }, [productMeta]);

  // Apply filters to the renders list. A render passes if:
  //   - created_at is within the date range (if set)
  //   - AND at least one of its linked products matches the category filter (if any selected)
  //   - AND at least one of its linked products matches the text query (if non-empty)
  //   - AND if a "pinned product" set is active, the render must contain at least one of those product IDs
  const filteredRenders = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom + "T00:00:00").getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : Infinity;
    const q = productQuery.trim().toLowerCase();
    return renders.filter((r) => {
      const t = new Date(r.created_at).getTime();
      if (t < fromTs || t > toTs) return false;

      if (pinnedProductIds.size > 0) {
        if (!r.linked_favorite_product_ids.some((id) => pinnedProductIds.has(id))) return false;
      }

      if (categoryFilter.size > 0) {
        const hasCat = r.linked_favorite_product_ids.some((id) => {
          const c = productMeta[id]?.category;
          return c ? categoryFilter.has(c) : false;
        });
        if (!hasCat) return false;
      }

      if (q) {
        const hasMatch = r.linked_favorite_product_ids.some((id) => {
          const m = productMeta[id];
          if (!m) return false;
          return (
            (m.product_name && m.product_name.toLowerCase().includes(q)) ||
            (m.brand_name && m.brand_name.toLowerCase().includes(q))
          );
        });
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [renders, productMeta, dateFrom, dateTo, categoryFilter, productQuery, pinnedProductIds]);

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(filteredRenders.map((r) => r.id)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const toggleCategory = (cat: string) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };
  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setCategoryFilter(new Set());
    setProductQuery("");
    setPinnedProductIds(new Set());
  };
  // Use the union of all pinned product IDs across renders as the picker source
  const allPinnedProductOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const r of renders) for (const id of r.linked_favorite_product_ids) ids.add(id);
    return Array.from(ids)
      .map((id) => ({ id, ...(productMeta[id] || { product_name: null, brand_name: null, category: null }) }))
      .sort((a, b) => (a.product_name || "").localeCompare(b.product_name || ""));
  }, [renders, productMeta]);

  // Search-filter the picker, but always keep already-selected ones visible (pinned to top)
  const filteredPinnedOptions = useMemo(() => {
    const q = pinnedQuery.trim().toLowerCase();
    const base = q
      ? allPinnedProductOptions.filter((p) => {
          const hay = `${p.product_name || ""} ${p.brand_name || ""} ${p.category || ""}`.toLowerCase();
          return hay.includes(q);
        })
      : allPinnedProductOptions;
    const selected = base.filter((p) => pinnedProductIds.has(p.id));
    const unselected = base.filter((p) => !pinnedProductIds.has(p.id));
    return { combined: [...selected, ...unselected], selectedCount: selected.length, total: base.length };
  }, [allPinnedProductOptions, pinnedQuery, pinnedProductIds]);

  // Reset the lazy window whenever the underlying filtered list changes
  useEffect(() => {
    setPinnedVisibleCount(PINNED_PAGE_SIZE);
    if (pinnedScrollRef.current) pinnedScrollRef.current.scrollTop = 0;
  }, [pinnedQuery, allPinnedProductOptions.length]);

  const visiblePinnedOptions = useMemo(
    () => filteredPinnedOptions.combined.slice(0, pinnedVisibleCount),
    [filteredPinnedOptions, pinnedVisibleCount]
  );

  const onPinnedScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setPinnedVisibleCount((c) =>
        c >= filteredPinnedOptions.combined.length ? c : c + PINNED_PAGE_SIZE
      );
    }
  };

  const runBulkAudit = async () => {
    if (selectedIds.size === 0) return;
    setBulkRunning(true);
    const queue = renders.filter((r) => selectedIds.has(r.id));

    // Seed pending state
    setResults((prev) => {
      const next = { ...prev };
      for (const r of queue) next[r.id] = { request_id: r.id, status: "pending" };
      return next;
    });

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      toast({ title: "Session expired", variant: "destructive" });
      setBulkRunning(false);
      return;
    }

    for (const item of queue) {
      setResults((prev) => ({ ...prev, [item.id]: { ...prev[item.id], status: "running" } }));
      try {
        // Resolve placements from linked product ids
        const { data: prods } = await supabase
          .from("trade_products")
          .select("id,product_name,brand_name,image_url,dimensions")
          .in("id", item.linked_favorite_product_ids);
        const placements = (prods || []).map((p: any) => ({
          product_id: p.id,
          product_name: p.product_name,
          brand_name: p.brand_name,
          image_url: p.image_url,
          dimensions: p.dimensions || null,
        }));
        if (placements.length === 0) {
          setResults((prev) => ({ ...prev, [item.id]: { request_id: item.id, status: "error", error: "No resolvable products" } }));
          continue;
        }

        const { data, error } = await supabase.functions.invoke("axonometric-generate", {
          body: {
            imageUrl: item.result_image_url,
            mode: "cad_dimension_overlay",
            qualityTier: "draft",
            placements,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);

        const qa = (data?.cadQa || []) as Array<{ status: QaStatus }>;
        const c: Record<QaStatus, number> = { match: 0, mismatch: 0, no_cad: 0, cad_unparsed: 0 };
        for (const q of qa) c[q.status] = (c[q.status] || 0) + 1;

        setResults((prev) => ({
          ...prev,
          [item.id]: {
            request_id: item.id,
            status: "done",
            overlayUrl: data?.storedUrl || data?.imageUrl,
            counts: c,
          },
        }));
      } catch (e: any) {
        setResults((prev) => ({
          ...prev,
          [item.id]: { request_id: item.id, status: "error", error: e?.message || "Unknown error" },
        }));
      }
    }

    setBulkRunning(false);
    // Refresh the QA rows so the other tabs reflect newly logged data
    load();
    toast({ title: "Bulk audit complete", description: `${queue.length} render(s) processed.` });
  };

  const bulkSummary = useMemo(() => {
    const total: Record<QaStatus, number> = { match: 0, mismatch: 0, no_cad: 0, cad_unparsed: 0 };
    let renders = 0;
    let mismatchRenders = 0;
    for (const r of Object.values(results)) {
      if (r.status !== "done" || !r.counts) continue;
      renders++;
      if (r.counts.mismatch > 0) mismatchRenders++;
      for (const k of Object.keys(total) as QaStatus[]) total[k] += r.counts[k];
    }
    return { total, renders, mismatchRenders };
  }, [results]);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Helmet>
        <title>Axonometric CAD QA — Admin</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-light">Axonometric CAD QA</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each row records whether the dimensions injected into the AI prompt matched the
            parsed CAD bounding box. Tolerance: ±1 cm per axis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          {loading ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as QaStatus | "all" | "bulk")}>
        <TabsList>
          <TabsTrigger value="mismatch">Mismatch ({counts.mismatch})</TabsTrigger>
          <TabsTrigger value="cad_unparsed">CAD unparsed ({counts.cad_unparsed})</TabsTrigger>
          <TabsTrigger value="no_cad">No CAD ({counts.no_cad})</TabsTrigger>
          <TabsTrigger value="match">Match ({counts.match})</TabsTrigger>
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
          <TabsTrigger value="bulk" className="gap-1.5"><Ruler className="w-3 h-3" /> Bulk Run</TabsTrigger>
        </TabsList>

        {tab !== "bulk" && (
          <TabsContent value={tab} className="mt-4 space-y-3">
            {filtered.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                {loading ? "Loading…" : "No rows."}
              </CardContent></Card>
            ) : filtered.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                    <Badge variant={STATUS_VARIANT[r.status]}>{r.status}</Badge>
                    <span className="font-medium">{r.product_name || r.product_id}</span>
                    {r.brand_name && <span className="text-muted-foreground font-normal">· {r.brand_name}</span>}
                    <span className="ml-auto text-xs text-muted-foreground font-normal">
                      {new Date(r.created_at).toLocaleString()} · {r.mode}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-xs grid sm:grid-cols-2 gap-2">
                  <div>
                    <div className="text-muted-foreground">Expected (CAD)</div>
                    <div className="font-mono">{r.expected_dim_text || "—"}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Applied in prompt</div>
                    <div className="font-mono">{r.applied_dim_text || "—"}</div>
                  </div>
                  {r.original_dim_text && r.original_dim_text !== r.applied_dim_text && (
                    <div className="sm:col-span-2">
                      <div className="text-muted-foreground">Originally supplied</div>
                      <div className="font-mono">{r.original_dim_text}</div>
                    </div>
                  )}
                  {r.delta_cm && (
                    <div className="sm:col-span-2">
                      <div className="text-muted-foreground">Δ cm (applied − CAD)</div>
                      <div className="font-mono">
                        W:{r.delta_cm.w ?? "—"}  D:{r.delta_cm.d ?? "—"}  H:{r.delta_cm.h ?? "—"}
                        <span className="text-muted-foreground"> (tol ±{r.tolerance_cm})</span>
                      </div>
                    </div>
                  )}
                  <div className="sm:col-span-2 text-muted-foreground">
                    product_id: <span className="font-mono">{r.product_id}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}

        <TabsContent value="bulk" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Ruler className="w-4 h-4" /> Bulk CAD Scale Audit
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <p className="text-muted-foreground">
                Pick saved proposal renders with pinned products. For each, the system regenerates a
                transparent CAD-dimension overlay and records per-product QA rows.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 p-3 rounded border border-border bg-muted/20">
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Date range</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="text-xs border border-input rounded px-2 py-1 bg-background flex-1"
                    />
                    <span className="text-muted-foreground">→</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="text-xs border border-input rounded px-2 py-1 bg-background flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">Product / brand search</label>
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Filter renders by product or brand name"
                    className="text-xs border border-input rounded px-2 py-1 bg-background w-full"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Category {categoryFilter.size > 0 && <span className="normal-case text-foreground">({categoryFilter.size} selected)</span>}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {categoryOptions.length === 0 ? (
                      <span className="text-muted-foreground">No categories — load renders first.</span>
                    ) : categoryOptions.map((cat) => {
                      const active = categoryFilter.has(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => toggleCategory(cat)}
                          className={`text-[11px] px-2 py-0.5 rounded border ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input text-muted-foreground hover:text-foreground"}`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Pinned products {pinnedProductIds.size > 0 && <span className="normal-case text-foreground">({pinnedProductIds.size} selected)</span>}
                  </label>
                  <div className="max-h-32 overflow-y-auto border border-input rounded p-2 bg-background">
                    {allPinnedProductOptions.length === 0 ? (
                      <span className="text-muted-foreground">No pinned products — load renders first.</span>
                    ) : allPinnedProductOptions.map((p) => {
                      const active = pinnedProductIds.has(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-1.5 py-0.5 cursor-pointer hover:bg-muted/40 px-1 rounded">
                          <Checkbox
                            checked={active}
                            onCheckedChange={(v) => {
                              setPinnedProductIds((prev) => {
                                const next = new Set(prev);
                                if (v) next.add(p.id); else next.delete(p.id);
                                return next;
                              });
                            }}
                          />
                          <span className="truncate">
                            {p.product_name || "(unnamed)"}
                            {p.brand_name && <span className="text-muted-foreground"> · {p.brand_name}</span>}
                            {p.category && <span className="text-muted-foreground"> · {p.category}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-muted-foreground">
                  Showing <span className="font-mono text-foreground">{filteredRenders.length}</span> of <span className="font-mono">{renders.length}</span> renders.
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters} disabled={bulkRunning}>
                  Clear filters
                </Button>
                <Button variant="outline" size="sm" onClick={loadRenders} disabled={rendersLoading || bulkRunning}>
                  {rendersLoading ? "Loading…" : "Reload renders"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(selectedIds.size !== filteredRenders.length)}
                  disabled={filteredRenders.length === 0 || bulkRunning}
                >
                  {selectedIds.size === filteredRenders.length && filteredRenders.length > 0 ? "Clear selection" : "Select all filtered"}
                </Button>
                <Button
                  size="sm"
                  onClick={runBulkAudit}
                  disabled={selectedIds.size === 0 || bulkRunning}
                  className="gap-1.5"
                >
                  {bulkRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ruler className="w-3.5 h-3.5" />}
                  Run audit on {selectedIds.size} render(s)
                </Button>
              </div>

              {bulkSummary.renders > 0 && (
                <div className="rounded border border-border p-3 bg-muted/30 text-xs">
                  <div className="font-medium mb-1">Run summary</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>Renders processed: <span className="font-mono">{bulkSummary.renders}</span></div>
                    <div>With mismatches: <span className="font-mono text-red-600">{bulkSummary.mismatchRenders}</span></div>
                    <div>Total mismatches: <span className="font-mono text-red-600">{bulkSummary.total.mismatch}</span></div>
                    <div>Matches: <span className="font-mono text-emerald-600">{bulkSummary.total.match}</span></div>
                    <div>No CAD: <span className="font-mono text-amber-600">{bulkSummary.total.no_cad}</span></div>
                    <div>CAD unparsed: <span className="font-mono text-amber-600">{bulkSummary.total.cad_unparsed}</span></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {filteredRenders.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                {rendersLoading ? "Loading renders…" : renders.length === 0 ? "No saved renders with pinned products were found." : "No renders match the current filters."}
              </CardContent></Card>
            ) : filteredRenders.map((r) => {
              const result = results[r.id];
              const checked = selectedIds.has(r.id);
              return (
                <Card key={r.id}>
                  <CardContent className="py-3 flex items-start gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => toggleOne(r.id, Boolean(v))}
                      disabled={bulkRunning}
                      className="mt-1"
                    />
                    <img
                      src={r.result_image_url}
                      alt=""
                      loading="lazy"
                      className="w-20 h-20 object-cover rounded border border-border flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-xs space-y-1">
                      <div className="font-medium truncate">{r.project_name || "(untitled project)"}</div>
                      <div className="text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()} · {r.linked_favorite_product_ids.length} product(s)
                      </div>
                      {result && (
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {result.status === "pending" && <Badge variant="outline">Queued</Badge>}
                          {result.status === "running" && <Badge variant="secondary" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" />Running</Badge>}
                          {result.status === "error" && <Badge variant="destructive">Error: {result.error}</Badge>}
                          {result.status === "done" && result.counts && (
                            <>
                              {result.counts.mismatch > 0 && <Badge variant="destructive">{result.counts.mismatch} mismatch</Badge>}
                              {result.counts.match > 0 && <Badge variant="secondary">{result.counts.match} match</Badge>}
                              {result.counts.no_cad > 0 && <Badge variant="outline">{result.counts.no_cad} no CAD</Badge>}
                              {result.counts.cad_unparsed > 0 && <Badge variant="outline">{result.counts.cad_unparsed} unparsed</Badge>}
                              {result.overlayUrl && (
                                <a
                                  href={result.overlayUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs underline inline-flex items-center gap-1"
                                >
                                  Overlay <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
