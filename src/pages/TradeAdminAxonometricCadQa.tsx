import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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

const STATUS_VARIANT: Record<QaStatus, "default" | "destructive" | "secondary" | "outline"> = {
  match: "secondary",
  mismatch: "destructive",
  no_cad: "outline",
  cad_unparsed: "outline",
};

export default function TradeAdminAxonometricCadQa() {
  const [rows, setRows] = useState<QaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<QaStatus | "all">("mismatch");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("axonometric_cad_qa")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data || []) as QaRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<QaStatus, number> = { match: 0, mismatch: 0, no_cad: 0, cad_unparsed: 0 };
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [rows]);

  const filtered = tab === "all" ? rows : rows.filter((r) => r.status === tab);

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

      <Tabs value={tab} onValueChange={(v) => setTab(v as QaStatus | "all")}>
        <TabsList>
          <TabsTrigger value="mismatch">Mismatch ({counts.mismatch})</TabsTrigger>
          <TabsTrigger value="cad_unparsed">CAD unparsed ({counts.cad_unparsed})</TabsTrigger>
          <TabsTrigger value="no_cad">No CAD ({counts.no_cad})</TabsTrigger>
          <TabsTrigger value="match">Match ({counts.match})</TabsTrigger>
          <TabsTrigger value="all">All ({rows.length})</TabsTrigger>
        </TabsList>

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
      </Tabs>
    </div>
  );
}
