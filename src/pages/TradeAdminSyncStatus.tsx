import { Helmet } from "react-helmet-async";
import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, Link2Off, FileQuestion, RefreshCcw,
} from "lucide-react";

/**
 * Admin: Sync Status
 *
 * Side-by-side audit of `designer_curator_picks` (the editor source of truth)
 * vs `trade_products` (the catalogue used by quotes / showroom).
 *
 * Statuses per row:
 *  - in_sync         → both sides match on every tracked field
 *  - mismatch        → matched row exists but one or more fields differ
 *  - missing_trade   → curator pick has no matching trade product
 *  - orphan_trade    → trade product has no matching curator pick (informational)
 */

type Pick = {
  id: string;
  title: string;
  designer_id: string;
  category: string | null;
  subcategory: string | null;
  trade_price_cents: number | null;
  currency: string | null;
  lead_time: string | null;
  dimensions: string | null;
  materials: string | null;
  image_url: string | null;
  origin: string | null;
  designers?: { name: string } | null;
};

type TradeProduct = {
  id: string;
  brand_name: string;
  product_name: string;
  category: string | null;
  subcategory: string | null;
  trade_price_cents: number | null;
  rrp_price_cents: number | null;
  currency: string | null;
  lead_time: string | null;
  dimensions: string | null;
  materials: string | null;
  image_url: string | null;
  origin: string | null;
};

type FieldDiff = {
  field: string;
  pick: string;
  trade: string;
};

type Row = {
  key: string;
  brand: string;
  product: string;
  pick: Pick | null;
  trade: TradeProduct | null;
  status: "in_sync" | "mismatch" | "missing_trade" | "orphan_trade";
  diffs: FieldDiff[];
};

const TRACKED_FIELDS: { label: string; pickKey: keyof Pick; tradeKey: keyof TradeProduct }[] = [
  { label: "Price (cents)", pickKey: "trade_price_cents", tradeKey: "trade_price_cents" },
  { label: "Currency", pickKey: "currency", tradeKey: "currency" },
  { label: "Lead time", pickKey: "lead_time", tradeKey: "lead_time" },
  { label: "Category", pickKey: "category", tradeKey: "category" },
  { label: "Subcategory", pickKey: "subcategory", tradeKey: "subcategory" },
  { label: "Dimensions", pickKey: "dimensions", tradeKey: "dimensions" },
  { label: "Materials", pickKey: "materials", tradeKey: "materials" },
  { label: "Image URL", pickKey: "image_url", tradeKey: "image_url" },
  { label: "Origin", pickKey: "origin", tradeKey: "origin" },
];

const norm = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).trim();
};

function computeRows(picks: Pick[], products: TradeProduct[]): Row[] {
  const productByKey = new Map<string, TradeProduct>();
  for (const tp of products) {
    productByKey.set(`${norm(tp.brand_name).toLowerCase()}|${norm(tp.product_name).toLowerCase()}`, tp);
  }
  const usedTradeIds = new Set<string>();
  const rows: Row[] = [];

  for (const pick of picks) {
    const brand = pick.designers?.name || "";
    const key = `${norm(brand).toLowerCase()}|${norm(pick.title).toLowerCase()}`;
    const trade = productByKey.get(key) || null;
    if (trade) usedTradeIds.add(trade.id);

    let status: Row["status"];
    const diffs: FieldDiff[] = [];

    if (!trade) {
      status = "missing_trade";
    } else {
      for (const f of TRACKED_FIELDS) {
        const a = norm(pick[f.pickKey]);
        const b = norm(trade[f.tradeKey]);
        if (a !== b) diffs.push({ field: f.label, pick: a || "—", trade: b || "—" });
      }
      status = diffs.length === 0 ? "in_sync" : "mismatch";
    }

    rows.push({
      key: `pick-${pick.id}`,
      brand: brand || "—",
      product: pick.title,
      pick,
      trade,
      status,
      diffs,
    });
  }

  // Orphan trade products (exist in trade_products but no matching curator pick)
  for (const tp of products) {
    if (usedTradeIds.has(tp.id)) continue;
    rows.push({
      key: `tp-${tp.id}`,
      brand: tp.brand_name || "—",
      product: tp.product_name,
      pick: null,
      trade: tp,
      status: "orphan_trade",
      diffs: [],
    });
  }

  return rows.sort((a, b) => {
    // mismatches/missing first, then by brand/product
    const order: Record<Row["status"], number> = {
      mismatch: 0, missing_trade: 1, orphan_trade: 2, in_sync: 3,
    };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return (a.brand + a.product).localeCompare(b.brand + b.product);
  });
}

const STATUS_BADGE: Record<Row["status"], { label: string; tone: string; Icon: React.ElementType }> = {
  in_sync: { label: "In sync", tone: "bg-emerald-50 text-emerald-700 border-emerald-200", Icon: CheckCircle2 },
  mismatch: { label: "Mismatch", tone: "bg-amber-50 text-amber-800 border-amber-200", Icon: AlertTriangle },
  missing_trade: { label: "Missing trade row", tone: "bg-red-50 text-red-700 border-red-200", Icon: Link2Off },
  orphan_trade: { label: "Orphan trade row", tone: "bg-muted text-muted-foreground border-border", Icon: FileQuestion },
};

export default function TradeAdminSyncStatus() {
  const { isAdmin, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Row["status"]>("all");

  const picksQuery = useQuery({
    queryKey: ["sync-status:picks"],
    queryFn: async (): Promise<Pick[]> => {
      const { data, error } = await supabase
        .from("designer_curator_picks")
        .select(
          "id, title, designer_id, category, subcategory, trade_price_cents, currency, lead_time, dimensions, materials, image_url, origin, designers ( name )"
        )
        .order("title");
      if (error) throw error;
      return (data as unknown as Pick[]) || [];
    },
  });

  const productsQuery = useQuery({
    queryKey: ["sync-status:products"],
    queryFn: async (): Promise<TradeProduct[]> => {
      const { data, error } = await supabase
        .from("trade_products")
        .select(
          "id, brand_name, product_name, category, subcategory, trade_price_cents, rrp_price_cents, currency, lead_time, dimensions, materials, image_url, origin"
        );
      if (error) throw error;
      return (data as unknown as TradeProduct[]) || [];
    },
  });

  const rows = useMemo(
    () => computeRows(picksQuery.data || [], productsQuery.data || []),
    [picksQuery.data, productsQuery.data]
  );

  const counts = useMemo(() => {
    const c = { in_sync: 0, mismatch: 0, missing_trade: 0, orphan_trade: 0, total: rows.length };
    for (const r of rows) c[r.status]++;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.brand.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const isLoading = picksQuery.isLoading || productsQuery.isLoading;
  const refetch = () => {
    picksQuery.refetch();
    productsQuery.refetch();
  };

  return (
    <>
      <Helmet>
        <title>Sync Status — Trade Admin — Maison Affluency</title>
      </Helmet>

      <div className="max-w-7xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              to="/trade/admin-dashboard"
              className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Admin Dashboard
            </Link>
            <h1 className="font-display text-3xl mt-2">Curator Picks ↔ Trade Products Sync</h1>
            <p className="font-body text-sm text-muted-foreground mt-1 max-w-2xl">
              Compares each curator pick (Designer Editor) with its matching <code>trade_products</code> row
              (used by quotes & showroom). Matched by designer name + product title.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Counts */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Total" value={counts.total} />
          <StatCard label="In sync" value={counts.in_sync} tone="text-emerald-700" />
          <StatCard label="Mismatch" value={counts.mismatch} tone="text-amber-700" />
          <StatCard label="Missing trade row" value={counts.missing_trade} tone="text-red-700" />
          <StatCard label="Orphan trade row" value={counts.orphan_trade} tone="text-muted-foreground" />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3">
          <Input
            placeholder="Search by brand or product…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-sm"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="md:w-56">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="mismatch">Mismatch</SelectItem>
              <SelectItem value="missing_trade">Missing trade row</SelectItem>
              <SelectItem value="orphan_trade">Orphan trade row</SelectItem>
              <SelectItem value="in_sync">In sync</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="border border-border rounded-md overflow-hidden">
          <div className="grid grid-cols-[1.4fr_1.6fr_1fr_2fr] gap-3 px-4 py-3 bg-muted/40 font-body text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <div>Brand</div>
            <div>Product</div>
            <div>Status</div>
            <div>Differences</div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No rows match the current filter.</div>
          ) : (
            filtered.map((row) => {
              const meta = STATUS_BADGE[row.status];
              const Icon = meta.Icon;
              return (
                <div
                  key={row.key}
                  className="grid grid-cols-[1.4fr_1.6fr_1fr_2fr] gap-3 px-4 py-3 border-t border-border items-start text-sm"
                >
                  <div className="font-body text-foreground">{row.brand}</div>
                  <div className="font-body text-foreground">{row.product}</div>
                  <div>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] uppercase tracking-[0.08em] ${meta.tone}`}
                    >
                      <Icon className="h-3 w-3" />
                      {meta.label}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {row.status === "missing_trade" && (
                      <p className="text-xs text-muted-foreground italic">
                        No <code>trade_products</code> row. Editing the pick will create one via the sync trigger.
                      </p>
                    )}
                    {row.status === "orphan_trade" && (
                      <p className="text-xs text-muted-foreground italic">
                        Standalone <code>trade_products</code> row (e.g. ad-hoc quote line). No curator pick to mirror.
                      </p>
                    )}
                    {row.status === "in_sync" && (
                      <p className="text-xs text-muted-foreground italic">All tracked fields match.</p>
                    )}
                    {row.diffs.map((d) => (
                      <div key={d.field} className="text-xs">
                        <span className="font-medium text-foreground">{d.field}:</span>{" "}
                        <span className="text-amber-700">pick</span> <code className="text-foreground">{d.pick}</code>{" "}
                        <span className="text-muted-foreground">vs</span>{" "}
                        <span className="text-amber-700">trade</span> <code className="text-foreground">{d.trade}</code>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="font-body text-xs text-muted-foreground">
          Tip: To force a re-sync of a row, open it in the Designer Editor and save (a no-op edit re-fires the trigger).
          Orphan trade rows are normal for ad-hoc quote items added directly from the showroom.
        </p>
      </div>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border border-border rounded-md p-3 bg-card">
      <div className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`font-display text-2xl mt-1 ${tone || "text-foreground"}`}>{value}</div>
    </div>
  );
}
