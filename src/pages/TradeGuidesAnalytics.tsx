import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BarChart3, Eye, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ViewRow = { slug: string; created_at: string; user_id: string | null };
type Window = 7 | 30;

export default function TradeGuidesAnalytics() {
  const [windowDays, setWindowDays] = useState<Window>(7);
  const [rows, setRows] = useState<ViewRow[] | null>(null);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(null);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    Promise.all([
      supabase
        .from("guide_views")
        .select("slug, created_at, user_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.rpc("get_admin_user_ids"),
    ]).then(([viewsRes, adminsRes]) => {
      if (cancelled) return;
      if (viewsRes.error) {
        setError(viewsRes.error.message);
        return;
      }
      setRows((viewsRes.data ?? []) as ViewRow[]);
      const ids = (adminsRes.data ?? []) as { user_id: string }[];
      setAdminIds(new Set(ids.map((r) => r.user_id)));
    });
    return () => {
      cancelled = true;
    };
  }, [windowDays]);

  const { total, uniqueVisits, uniqueTrade, uniqueAdmin, perSlug } = useMemo(() => {
    if (!rows)
      return {
        total: 0,
        uniqueVisits: 0,
        uniqueTrade: 0,
        uniqueAdmin: 0,
        perSlug: [] as {
          slug: string;
          count: number;
          unique: number;
          uniqueTrade: number;
          uniqueAdmin: number;
        }[],
      };
    const counts = new Map<string, number>();
    const uniqueKeys = new Map<string, Set<string>>();
    const tradeKeys = new Map<string, Set<string>>();
    const adminKeys = new Map<string, Set<string>>();
    const globalUnique = new Set<string>();
    const globalTrade = new Set<string>();
    const globalAdmin = new Set<string>();
    for (const r of rows) {
      counts.set(r.slug, (counts.get(r.slug) ?? 0) + 1);
      const visitorKey = r.user_id ?? `anon:${r.created_at}`;
      const isAdmin = !!r.user_id && adminIds.has(r.user_id);
      if (!uniqueKeys.has(r.slug)) uniqueKeys.set(r.slug, new Set());
      if (!tradeKeys.has(r.slug)) tradeKeys.set(r.slug, new Set());
      if (!adminKeys.has(r.slug)) adminKeys.set(r.slug, new Set());
      uniqueKeys.get(r.slug)!.add(visitorKey);
      (isAdmin ? adminKeys : tradeKeys).get(r.slug)!.add(visitorKey);
      globalUnique.add(`${r.slug}::${visitorKey}`);
      (isAdmin ? globalAdmin : globalTrade).add(visitorKey);
    }
    const perSlug = Array.from(counts.entries())
      .map(([slug, count]) => ({
        slug,
        count,
        unique: uniqueKeys.get(slug)?.size ?? 0,
        uniqueTrade: tradeKeys.get(slug)?.size ?? 0,
        uniqueAdmin: adminKeys.get(slug)?.size ?? 0,
      }))
      .sort((a, b) => b.count - a.count);
    return {
      total: rows.length,
      uniqueVisits: globalUnique.size,
      uniqueTrade: globalTrade.size,
      uniqueAdmin: globalAdmin.size,
      perSlug,
    };
  }, [rows, adminIds]);

  const max = perSlug[0]?.count ?? 0;

  return (
    <article className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-3">
        <Link
          to="/trade/guides"
          className="inline-flex items-center gap-1 font-body text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" aria-hidden="true" /> All guides
        </Link>
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-foreground">
            <BarChart3 className="h-4 w-4" aria-hidden="true" />
          </span>
          <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">
            Guide views
          </h1>
        </div>
        <p className="font-body text-sm text-muted-foreground">
          Internal dashboard — totals and top viewed slugs in the selected window.
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Time window"
        className="inline-flex rounded-md border border-border overflow-hidden"
      >
        {[7, 30].map((d) => (
          <button
            key={d}
            role="tab"
            aria-selected={windowDays === d}
            onClick={() => setWindowDays(d as Window)}
            className={`px-4 py-2 font-body text-xs uppercase tracking-wider transition-colors ${
              windowDays === d
                ? "bg-foreground text-background"
                : "bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Last {d} days
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 font-body text-sm text-destructive">
          Failed to load: {error}
        </div>
      )}

      {!rows && !error && (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          <span className="font-body text-sm">Loading…</span>
        </div>
      )}

      {rows && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Stat label="Total views" value={total} icon={Eye} />
            <Stat label="Unique visits" value={uniqueVisits} icon={Eye} />
            <Stat label="Unique guides" value={perSlug.length} icon={BarChart3} />
          </div>

          <section className="space-y-3">
            <h2 className="font-body text-xs uppercase tracking-wider text-muted-foreground">
              Top viewed slugs
            </h2>
            {perSlug.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
                No views recorded in this window.
              </p>
            ) : (
              <ol className="divide-y divide-border rounded-md border border-border overflow-hidden">
                {perSlug.map((row, i) => {
                  const pct = max > 0 ? Math.round((row.count / max) * 100) : 0;
                  return (
                    <li key={row.slug} className="px-4 py-3 bg-card">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-body text-xs text-muted-foreground tabular-nums w-5">
                            {i + 1}.
                          </span>
                          <Link
                            to={`/trade/guides/${row.slug}`}
                            className="font-body text-sm text-foreground hover:text-primary truncate"
                          >
                            <code className="text-xs">{row.slug}</code>
                          </Link>
                        </div>
                        <span className="font-body text-sm tabular-nums text-foreground whitespace-nowrap">
                          {row.count}
                          <span className="text-muted-foreground"> · {row.unique} unique</span>
                        </span>
                      </div>
                      <div
                        className="mt-2 h-1 rounded-full bg-muted overflow-hidden"
                        aria-hidden="true"
                      >
                        <div
                          className="h-full bg-primary transition-[width] duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}
    </article>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: number; icon: any }) {
  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-body text-[10px] uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className="font-display text-3xl text-foreground mt-2 tabular-nums">{value}</p>
    </div>
  );
}
