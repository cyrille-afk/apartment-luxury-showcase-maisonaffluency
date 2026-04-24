import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Check, Eye, Link2, Loader2, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrandToParent } from "@/lib/brandNormalization";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ViewRow = { slug: string; created_at: string; user_id: string | null };
type EngagementRow = {
  brand_name: string;
  quote_users: number;
  quote_lines: number;
  board_users: number;
  board_items: number;
};
type Window = 7 | 30;
type EngagementSort = "all" | "quotes" | "boards";
type BrandUserRow = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
  quote_lines: number;
  board_items: number;
  source: "quote" | "board" | "both";
};

export default function TradeGuidesAnalytics() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialWindow = searchParams.get("window") === "30" ? 30 : 7;
  const initialTab = (() => {
    const t = searchParams.get("tab");
    return t === "quotes" || t === "boards" ? (t as EngagementSort) : "all";
  })();
  const [windowDays, setWindowDays] = useState<Window>(initialWindow as Window);
  const [rows, setRows] = useState<ViewRow[] | null>(null);
  const [adminIds, setAdminIds] = useState<Set<string>>(new Set());
  const [engagement, setEngagement] = useState<EngagementRow[] | null>(null);
  const [designerSlugs, setDesignerSlugs] = useState<Map<string, string>>(new Map());
  const [engagementSort, setEngagementSort] = useState<EngagementSort>(initialTab);
  const [drillBrand, setDrillBrand] = useState<string | null>(searchParams.get("brand"));
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const copyDesignerLink = async (
    slug: string,
    brand: string,
    tab: EngagementSort = engagementSort,
  ) => {
    const params = new URLSearchParams();
    params.set("brand", brand);
    if (tab !== "all") params.set("tab", tab);
    params.set("window", String(windowDays));
    params.set("section", "engagement");
    const url = `${window.location.origin}/trade/designers/admin?${params.toString()}#engagement`;
    const key = `${slug}:${tab}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(key);
      const label =
        tab === "quotes" ? "Quotes" : tab === "boards" ? "Boards" : "Analytics";
      toast.success(`${label} link for ${brand} copied`);
      setTimeout(() => setCopiedSlug((s) => (s === key ? null : s)), 1500);
    } catch {
      toast.error("Could not copy link");
    }
  };
  const [drillRows, setDrillRows] = useState<BrandUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync drill open/close + tab back to URL so the link stays shareable
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (drillBrand) next.set("brand", drillBrand);
    else next.delete("brand");
    if (engagementSort !== "all") next.set("tab", engagementSort);
    else next.delete("tab");
    next.set("window", String(windowDays));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [drillBrand, engagementSort, windowDays]);

  // On first load with ?section=engagement, scroll the section into view
  useEffect(() => {
    if (searchParams.get("section") !== "engagement") return;
    const el = document.getElementById("engagement");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!drillBrand) return;
    let cancelled = false;
    setDrillRows(null);
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
    supabase
      .rpc("get_brand_engagement_users", { _brand_name: drillBrand, _since: since })
      .then(({ data }) => {
        if (cancelled) return;
        setDrillRows((data ?? []) as BrandUserRow[]);
      });
    return () => {
      cancelled = true;
    };
  }, [drillBrand, windowDays]);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setEngagement(null);
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
      supabase.rpc("get_designer_engagement", { _since: since }),
      supabase.from("designers").select("name, slug"),
    ]).then(([viewsRes, adminsRes, engagementRes, designersRes]) => {
      if (cancelled) return;
      if (viewsRes.error) {
        setError(viewsRes.error.message);
        return;
      }
      setRows((viewsRes.data ?? []) as ViewRow[]);
      const ids = (adminsRes.data ?? []) as { user_id: string }[];
      setAdminIds(new Set(ids.map((r) => r.user_id)));
      setEngagement((engagementRes.data ?? []) as EngagementRow[]);
      const slugMap = new Map<string, string>();
      for (const d of (designersRes.data ?? []) as { name: string; slug: string }[]) {
        if (d?.name && d?.slug) slugMap.set(d.name.toLowerCase(), d.slug);
      }
      setDesignerSlugs(slugMap);
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

  const designerRanking = useMemo(() => {
    if (!engagement) return [];
    const merged = new Map<
      string,
      { brand: string; quoteUsers: number; quoteLines: number; boardUsers: number; boardItems: number }
    >();
    for (const r of engagement) {
      const parent = normalizeBrandToParent(r.brand_name) || r.brand_name;
      const existing = merged.get(parent) ?? {
        brand: parent,
        quoteUsers: 0,
        quoteLines: 0,
        boardUsers: 0,
        boardItems: 0,
      };
      existing.quoteUsers += Number(r.quote_users) || 0;
      existing.quoteLines += Number(r.quote_lines) || 0;
      existing.boardUsers += Number(r.board_users) || 0;
      existing.boardItems += Number(r.board_items) || 0;
      merged.set(parent, existing);
    }
    const arr = Array.from(merged.values()).map((r) => ({
      ...r,
      totalUsers: r.quoteUsers + r.boardUsers,
    }));
    const key =
      engagementSort === "quotes"
        ? (r: typeof arr[number]) => r.quoteUsers * 1000 + r.quoteLines
        : engagementSort === "boards"
          ? (r: typeof arr[number]) => r.boardUsers * 1000 + r.boardItems
          : (r: typeof arr[number]) => r.totalUsers * 1000 + r.quoteLines + r.boardItems;
    return arr.sort((a, b) => key(b) - key(a)).slice(0, 20);
  }, [engagement, engagementSort]);

  const maxEngagement = designerRanking[0]
    ? engagementSort === "quotes"
      ? designerRanking[0].quoteUsers
      : engagementSort === "boards"
        ? designerRanking[0].boardUsers
        : designerRanking[0].totalUsers
    : 0;

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat label="Total views" value={total} icon={Eye} />
            <Stat label="Unique visits" value={uniqueVisits} icon={Eye} />
            <Stat label="Trade users" value={uniqueTrade} icon={BarChart3} />
            <Stat label="Admins / staff" value={uniqueAdmin} icon={BarChart3} />
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
                          <span className="text-muted-foreground">
                            {" "}
                            · {row.uniqueTrade} trade · {row.uniqueAdmin} staff
                          </span>
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

          <section id="engagement" className="space-y-3 scroll-mt-24">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-body text-xs uppercase tracking-wider text-muted-foreground">
                Designer engagement (trade users only)
              </h2>
              <div
                role="tablist"
                aria-label="Engagement filter"
                className="inline-flex rounded-md border border-border overflow-hidden"
              >
                {([
                  ["all", "All"],
                  ["quotes", "Quotes"],
                  ["boards", "Boards"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    role="tab"
                    aria-selected={engagementSort === key}
                    onClick={() => setEngagementSort(key)}
                    className={`px-3 py-1.5 font-body text-[10px] uppercase tracking-wider transition-colors ${
                      engagementSort === key
                        ? "bg-foreground text-background"
                        : "bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {designerRanking.length === 0 ? (
              <p className="font-body text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
                No designer engagement recorded in this window.
              </p>
            ) : (
              <ol className="divide-y divide-border rounded-md border border-border overflow-hidden">
                {designerRanking.map((row, i) => {
                  const primary =
                    engagementSort === "quotes"
                      ? row.quoteUsers
                      : engagementSort === "boards"
                        ? row.boardUsers
                        : row.totalUsers;
                  const pct = maxEngagement > 0 ? Math.round((primary / maxEngagement) * 100) : 0;
                  return (
                    <li key={row.brand} className="px-4 py-3 bg-card">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-body text-xs text-muted-foreground tabular-nums w-5">
                            {i + 1}.
                          </span>
                          {(() => {
                            const slug = designerSlugs.get(row.brand.toLowerCase());
                            const inner = (
                              <>
                                <Sparkles className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                                {row.brand}
                              </>
                            );
                            return slug ? (
                              <Link
                                to={`/designers/${slug}`}
                                className="font-body text-sm text-foreground hover:text-primary truncate flex items-center gap-1.5"
                              >
                                {inner}
                              </Link>
                            ) : (
                              <span className="font-body text-sm text-foreground truncate flex items-center gap-1.5">
                                {inner}
                              </span>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="font-body text-sm tabular-nums text-foreground">
                            {primary}
                            <span className="text-muted-foreground">
                              {" "}
                              · {row.quoteUsers}q / {row.quoteLines} lines · {row.boardUsers}b /{" "}
                              {row.boardItems} picks
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setDrillBrand(row.brand)}
                            aria-label={`View users contributing to ${row.brand}`}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          {(() => {
                            const slug = designerSlugs.get(row.brand.toLowerCase());
                            if (!slug) return null;
                            const isCopied = copiedSlug === slug;
                            return (
                              <button
                                type="button"
                                onClick={() => copyDesignerLink(slug, row.brand)}
                                aria-label={`Copy share link for ${row.brand}`}
                                title="Copy share link"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                {isCopied ? (
                                  <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                                )}
                              </button>
                            );
                          })()}
                        </div>
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

      <Dialog open={!!drillBrand} onOpenChange={(open) => !open && setDrillBrand(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-wide">
              {drillBrand} — top contributors
            </DialogTitle>
            <DialogDescription className="font-body text-xs text-muted-foreground">
              Trade users who quoted or saved {drillBrand} pieces in the last {windowDays} days.
            </DialogDescription>
          </DialogHeader>
          {!drillRows ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="font-body text-sm">Loading…</span>
            </div>
          ) : drillRows.length === 0 ? (
            <p className="font-body text-sm text-muted-foreground border border-dashed border-border rounded-md p-6 text-center">
              No contributors found in this window.
            </p>
          ) : (
            <BrandUsersTables rows={drillRows} />
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}

function BrandUsersTables({ rows }: { rows: BrandUserRow[] }) {
  const quoters = rows
    .filter((r) => r.quote_lines > 0)
    .sort((a, b) => b.quote_lines - a.quote_lines)
    .slice(0, 10);
  const boarders = rows
    .filter((r) => r.board_items > 0)
    .sort((a, b) => b.board_items - a.board_items)
    .slice(0, 10);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <UserList title="Top quoters" metricLabel="lines" rows={quoters} metric={(r) => r.quote_lines} />
      <UserList
        title="Top board contributors"
        metricLabel="picks"
        rows={boarders}
        metric={(r) => r.board_items}
      />
    </div>
  );
}

function UserList({
  title,
  metricLabel,
  rows,
  metric,
}: {
  title: string;
  metricLabel: string;
  rows: BrandUserRow[];
  metric: (r: BrandUserRow) => number;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="font-body text-xs text-muted-foreground italic">None in this window.</p>
      ) : (
        <ol className="divide-y divide-border rounded-md border border-border overflow-hidden">
          {rows.map((r, i) => {
            const name =
              [r.first_name, r.last_name].filter(Boolean).join(" ").trim() ||
              r.email ||
              r.user_id.slice(0, 8);
            return (
              <li key={r.user_id} className="px-3 py-2 bg-card flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-body text-sm text-foreground truncate">
                    <span className="text-muted-foreground tabular-nums mr-1">{i + 1}.</span>
                    {name}
                  </p>
                  {r.company && (
                    <p className="font-body text-[11px] text-muted-foreground truncate">
                      {r.company}
                    </p>
                  )}
                </div>
                <span className="font-body text-sm tabular-nums text-foreground whitespace-nowrap">
                  {metric(r)}{" "}
                  <span className="text-muted-foreground text-xs">{metricLabel}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
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
