import { useEffect, useMemo, useState } from "react";
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
    const filtered = (data || [])
      .map((r: any) => ({
        ...r,
        linked_favorite_product_ids: Array.isArray(r.linked_favorite_product_ids)
          ? r.linked_favorite_product_ids.filter((id: any) => typeof id === "string")
          : [],
      }))
      .filter((r: RenderItem) => r.result_image_url && r.linked_favorite_product_ids.length > 0);
    setRenders(filtered as RenderItem[]);
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

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(renders.map((r) => r.id)) : new Set());
  };
  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
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
              <div className="flex items-center gap-3 flex-wrap">
                <Button variant="outline" size="sm" onClick={loadRenders} disabled={rendersLoading || bulkRunning}>
                  {rendersLoading ? "Loading…" : "Reload renders"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAll(selectedIds.size !== renders.length)}
                  disabled={renders.length === 0 || bulkRunning}
                >
                  {selectedIds.size === renders.length && renders.length > 0 ? "Clear selection" : "Select all"}
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
            {renders.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">
                {rendersLoading ? "Loading renders…" : "No saved renders with pinned products were found."}
              </CardContent></Card>
            ) : renders.map((r) => {
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
