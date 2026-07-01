import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Download } from "lucide-react";

type PickRow = {
  id: string;
  designer_slug: string | null;
  product_name: string | null;
  trade_price_cents: number | null;
  currency: string | null;
};

type ProductRow = {
  id: string;
  source_pick_id: string | null;
  trade_price_cents: number | null;
  currency: string | null;
};

type Mismatch = {
  pick_id: string;
  designer_slug: string | null;
  product_name: string | null;
  pick_price: number | null;
  product_price: number | null;
  pick_currency: string | null;
  product_currency: string | null;
  kind: "missing_mirror" | "price_drift" | "currency_drift" | "null_mirror_price";
};

function fmt(cents: number | null, ccy: string | null) {
  if (cents == null) return "—";
  const v = (cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `${v} ${ccy ?? ""}`.trim();
}

const KIND_LABEL: Record<Mismatch["kind"], string> = {
  missing_mirror: "Missing in trade_products",
  null_mirror_price: "Mirror price is NULL",
  price_drift: "Price differs",
  currency_drift: "Currency differs",
};

export default function TradePriceDriftAudit() {
  const { isAdmin, loading } = useAuth();
  const [rows, setRows] = useState<Mismatch[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<Mismatch["kind"] | "all">("all");

  const load = async () => {
    setBusy(true);
    setErr(null);
    try {
      // Only picks that have a price are meaningful sources of truth.
      const { data: picks, error: pErr } = await supabase
        .from("designer_curator_picks")
        .select("id, designer_slug, product_name, trade_price_cents, currency")
        .not("trade_price_cents", "is", null);
      if (pErr) throw pErr;

      const { data: prods, error: prErr } = await supabase
        .from("trade_products")
        .select("id, source_pick_id, trade_price_cents, currency")
        .not("source_pick_id", "is", null);
      if (prErr) throw prErr;

      const mirrorByPick = new Map<string, ProductRow>();
      for (const p of (prods ?? []) as ProductRow[]) {
        if (p.source_pick_id) mirrorByPick.set(p.source_pick_id, p);
      }

      const out: Mismatch[] = [];
      for (const pk of (picks ?? []) as PickRow[]) {
        const mirror = mirrorByPick.get(pk.id);
        if (!mirror) {
          out.push({
            pick_id: pk.id,
            designer_slug: pk.designer_slug,
            product_name: pk.product_name,
            pick_price: pk.trade_price_cents,
            product_price: null,
            pick_currency: pk.currency,
            product_currency: null,
            kind: "missing_mirror",
          });
          continue;
        }
        if (mirror.trade_price_cents == null) {
          out.push({
            pick_id: pk.id,
            designer_slug: pk.designer_slug,
            product_name: pk.product_name,
            pick_price: pk.trade_price_cents,
            product_price: null,
            pick_currency: pk.currency,
            product_currency: mirror.currency,
            kind: "null_mirror_price",
          });
          continue;
        }
        if (mirror.trade_price_cents !== pk.trade_price_cents) {
          out.push({
            pick_id: pk.id,
            designer_slug: pk.designer_slug,
            product_name: pk.product_name,
            pick_price: pk.trade_price_cents,
            product_price: mirror.trade_price_cents,
            pick_currency: pk.currency,
            product_currency: mirror.currency,
            kind: "price_drift",
          });
          continue;
        }
        if ((pk.currency ?? null) !== (mirror.currency ?? null)) {
          out.push({
            pick_id: pk.id,
            designer_slug: pk.designer_slug,
            product_name: pk.product_name,
            pick_price: pk.trade_price_cents,
            product_price: mirror.trade_price_cents,
            pick_currency: pk.currency,
            product_currency: mirror.currency,
            kind: "currency_drift",
          });
        }
      }
      out.sort((a, b) =>
        (a.designer_slug ?? "").localeCompare(b.designer_slug ?? "") ||
        (a.product_name ?? "").localeCompare(b.product_name ?? ""),
      );
      setRows(out);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (kindFilter !== "all" && r.kind !== kindFilter) return false;
      if (!needle) return true;
      return (
        (r.designer_slug ?? "").toLowerCase().includes(needle) ||
        (r.product_name ?? "").toLowerCase().includes(needle) ||
        r.pick_id.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, kindFilter]);

  const counts = useMemo(() => {
    const c = { missing_mirror: 0, null_mirror_price: 0, price_drift: 0, currency_drift: 0 };
    for (const r of rows ?? []) c[r.kind] += 1;
    return c;
  }, [rows]);

  const exportCsv = () => {
    const header = [
      "kind",
      "designer_slug",
      "product_name",
      "pick_id",
      "pick_price_cents",
      "pick_currency",
      "trade_products_price_cents",
      "trade_products_currency",
    ];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.kind,
          JSON.stringify(r.designer_slug ?? ""),
          JSON.stringify(r.product_name ?? ""),
          r.pick_id,
          r.pick_price ?? "",
          r.pick_currency ?? "",
          r.product_price ?? "",
          r.product_currency ?? "",
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `price-drift-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-8 text-sm text-muted-foreground font-body">
        Checking admin access…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet>
        <title>Price Drift Audit — Trade Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="space-y-6 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link
              to="/trade"
              className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Trade
            </Link>
            <h1 className="font-display text-2xl mt-2">Price Drift Audit</h1>
            <p className="text-sm text-muted-foreground font-body max-w-2xl mt-1">
              Compares <code>designer_curator_picks.trade_price_cents</code> (source of truth)
              against the mirrored <code>trade_products.trade_price_cents</code> for the same
              <code> source_pick_id</code>. Any row here means a quote line could resolve to a
              wrong or missing price without the runtime fallback.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={busy}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${busy ? "animate-spin" : ""}`} />
              {busy ? "Scanning…" : "Rescan"}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="w-3.5 h-3.5 mr-1" />
              CSV
            </Button>
          </div>
        </div>

        {err && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {(["all", "missing_mirror", "null_mirror_price", "price_drift", "currency_drift"] as const).map(
            (k) => {
              const active = kindFilter === k;
              const count = k === "all" ? rows?.length ?? 0 : counts[k];
              return (
                <button
                  key={k}
                  onClick={() => setKindFilter(k)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:border-foreground/40"
                  }`}
                >
                  {k === "all" ? "All" : KIND_LABEL[k]} · {count}
                </button>
              );
            },
          )}
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by designer, product or pick id…"
            className="max-w-xs h-8 text-sm"
          />
        </div>

        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Kind</th>
                <th className="text-left px-3 py-2">Designer</th>
                <th className="text-left px-3 py-2">Product</th>
                <th className="text-right px-3 py-2">Pick price</th>
                <th className="text-right px-3 py-2">Mirror price</th>
                <th className="text-left px-3 py-2">Pick id</th>
              </tr>
            </thead>
            <tbody>
              {busy && !rows && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Scanning…
                  </td>
                </tr>
              )}
              {rows && filtered.length === 0 && !busy && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No mismatches. Every priced pick has a matching mirror row.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.pick_id + r.kind} className="border-t border-border/60">
                  <td className="px-3 py-2">
                    <Badge
                      variant={r.kind === "price_drift" ? "destructive" : "secondary"}
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {KIND_LABEL[r.kind]}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    {r.designer_slug ? (
                      <Link
                        to={`/trade/designers/${r.designer_slug}`}
                        className="hover:underline"
                      >
                        {r.designer_slug}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{r.product_name ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(r.pick_price, r.pick_currency)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {fmt(r.product_price, r.product_currency)}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {r.pick_id.slice(0, 8)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
