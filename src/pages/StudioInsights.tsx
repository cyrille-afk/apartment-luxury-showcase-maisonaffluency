import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, MousePointerClick, Filter, LayoutGrid } from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type Event = {
  id: string;
  studio_id: string;
  event_type: string;
  cta_kind: string | null;
  filter_key: string | null;
  filter_value: string | null;
  user_id: string | null;
  visitor_hash: string | null;
  country: string | null;
  referrer: string | null;
  created_at: string;
};

type StudioMeta = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string | null;
};

const DAYS = 30;

export default function StudioInsights() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const [studio, setStudio] = useState<StudioMeta | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    if (!slug || !user) return;
    (async () => {
      setLoading(true);
      const { data: studioRow } = await supabase
        .from("featured_studios")
        .select("id, name, slug, owner_user_id")
        .eq("slug", slug)
        .maybeSingle();

      if (!studioRow) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      setStudio(studioRow as StudioMeta);

      const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
      const { data: rows, error } = await supabase
        .from("studio_lead_events")
        .select("*")
        .eq("studio_id", studioRow.id)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) {
        // RLS will reject non-owners → treat as forbidden
        setForbidden(true);
      } else {
        setEvents((rows ?? []) as Event[]);
      }
      setLoading(false);
    })();
  }, [slug, user]);

  const stats = useMemo(() => {
    const totals = {
      profile_view: 0,
      cta_click: 0,
      directory_card_click: 0,
      filter_applied: 0,
    } as Record<string, number>;
    const cta = { website: 0, email: 0, instagram: 0, contact_form: 0 } as Record<string, number>;
    const filters: Record<string, number> = {};
    const uniqueVisitors = new Set<string>();
    const byDay: Record<string, number> = {};

    for (let i = DAYS - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      byDay[d] = 0;
    }

    for (const e of events) {
      totals[e.event_type] = (totals[e.event_type] || 0) + 1;
      if (e.cta_kind) cta[e.cta_kind] = (cta[e.cta_kind] || 0) + 1;
      if (e.event_type === "filter_applied" && e.filter_key && e.filter_value) {
        const k = `${e.filter_key}: ${e.filter_value}`;
        filters[k] = (filters[k] || 0) + 1;
      }
      if (e.visitor_hash) uniqueVisitors.add(e.visitor_hash);
      if (e.event_type === "profile_view") {
        const day = e.created_at.slice(0, 10);
        if (day in byDay) byDay[day]++;
      }
    }

    const trend = Object.entries(byDay).map(([date, views]) => ({
      date: date.slice(5), // MM-DD
      views,
    }));

    const topFilters = Object.entries(filters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    return { totals, cta, trend, uniqueVisitors: uniqueVisitors.size, topFilters };
  }, [events]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Skeleton className="h-8 w-40" />
      </main>
    );
  }
  if (!user) {
    return (
      <Navigate
        to={`/trade/login?redirect=${encodeURIComponent(`/studios/${slug}/insights`)}`}
        replace
      />
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>{studio?.name ? `${studio.name} — Insights` : "Studio Insights"} | Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="mx-auto max-w-6xl px-6 pt-8">
        <Link
          to={`/studios/${slug ?? ""}`}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" /> Back to studio
        </Link>
      </div>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
          Studio Insights · Last {DAYS} days
        </p>
        <h1 className="mt-3 font-display text-4xl md:text-5xl text-foreground">
          {studio?.name ?? "Studio"}
        </h1>

        {loading ? (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : forbidden ? (
          <div className="mt-12 border border-border bg-card p-8">
            <p className="font-display text-2xl text-foreground">No access</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Insights are only visible to the studio owner or a Maison Affluency administrator.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/studios">Back to directory</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Totals */}
            <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={<Eye className="h-4 w-4" />}
                label="Profile views"
                value={stats.totals.profile_view}
              />
              <StatCard
                icon={<MousePointerClick className="h-4 w-4" />}
                label="CTA clicks"
                value={stats.totals.cta_click}
              />
              <StatCard
                icon={<LayoutGrid className="h-4 w-4" />}
                label="Card clicks"
                value={stats.totals.directory_card_click}
              />
              <StatCard
                icon={<Filter className="h-4 w-4" />}
                label="Unique visitors"
                value={stats.uniqueVisitors}
              />
            </div>

            {/* Trend */}
            <div className="mt-10 border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
                Profile views — 30-day trend
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="vw" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="views"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={1.5}
                      fill="url(#vw)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CTA + Filters */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-border bg-card p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
                  CTA breakdown
                </p>
                <ul className="space-y-2 text-sm">
                  {(["website", "email", "instagram", "contact_form"] as const).map((k) => (
                    <li key={k} className="flex justify-between border-b border-border/60 pb-1.5">
                      <span className="capitalize text-foreground/90">{k.replace("_", " ")}</span>
                      <span className="font-mono text-foreground">{stats.cta[k] ?? 0}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="border border-border bg-card p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
                  Top filters used to find you
                </p>
                {stats.topFilters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No filter usage yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {stats.topFilters.map(([k, v]) => (
                      <li key={k} className="flex justify-between border-b border-border/60 pb-1.5">
                        <span className="text-foreground/90">{k.replace(/_/g, " ")}</span>
                        <span className="font-mono text-foreground">{v}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Recent events */}
            <div className="mt-8 border border-border bg-card">
              <div className="px-6 py-4 border-b border-border">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Recent activity
                </p>
              </div>
              {events.length === 0 ? (
                <p className="px-6 py-8 text-sm text-muted-foreground">No events recorded yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="text-left px-6 py-3">When</th>
                        <th className="text-left px-6 py-3">Event</th>
                        <th className="text-left px-6 py-3">Detail</th>
                        <th className="text-left px-6 py-3">Referrer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.slice(0, 50).map((e) => (
                        <tr key={e.id} className="border-b border-border/60 last:border-0">
                          <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                            {new Date(e.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-3">
                            <Badge variant="outline" className="font-normal">
                              {e.event_type.replace(/_/g, " ")}
                            </Badge>
                          </td>
                          <td className="px-6 py-3 text-foreground/90">
                            {e.cta_kind && <span className="capitalize">{e.cta_kind.replace("_", " ")}</span>}
                            {e.filter_key && (
                              <span>
                                {e.filter_key}: <em>{e.filter_value}</em>
                              </span>
                            )}
                            {!e.cta_kind && !e.filter_key && <span className="text-muted-foreground">—</span>}
                          </td>
                          <td className="px-6 py-3 text-muted-foreground truncate max-w-[260px]">
                            {e.referrer ? new URL(e.referrer).hostname : "direct"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-3 font-display text-3xl text-foreground">{value.toLocaleString()}</p>
    </div>
  );
}
