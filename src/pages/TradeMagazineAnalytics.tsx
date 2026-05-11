import { Helmet } from "react-helmet-async";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFeaturedPublicDocument } from "@/hooks/useFeaturedPublicDocument";
import { ArrowLeft, Eye, MousePointerClick, Download, Globe } from "lucide-react";
import { format } from "date-fns";
import { useMemo } from "react";

interface BadgeEvent {
  id: string;
  document_id: string | null;
  event_type: "impression" | "click";
  source: string | null;
  country: string | null;
  created_at: string;
}

interface DownloadEvent {
  id?: string;
  document_id: string | null;
  country: string | null;
  created_at: string;
}

const fmtDay = (iso: string) => format(new Date(iso), "yyyy-MM-dd");

export default function TradeMagazineAnalytics() {
  const { isAdmin, loading } = useAuth();
  const { doc: featuredDoc, loading: docLoading } = useFeaturedPublicDocument();

  const docId = featuredDoc?.id;

  const { data: badgeEvents = [], isLoading: badgeLoading } = useQuery<BadgeEvent[]>({
    queryKey: ["magazine-badge-events", docId],
    enabled: !!docId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("magazine_badge_events" as any)
        .select("id, document_id, event_type, source, country, created_at")
        .eq("document_id", docId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown) as BadgeEvent[]) ?? [];
    },
  });

  const { data: downloadEvents = [] } = useQuery<DownloadEvent[]>({
    queryKey: ["magazine-downloads", docId],
    enabled: !!docId && isAdmin,
    queryFn: async () => {
      const [memberRes, publicRes] = await Promise.all([
        supabase
          .from("document_downloads")
          .select("document_id, country, created_at")
          .eq("document_id", docId!),
        supabase
          .from("public_download_events" as any)
          .select("document_id, country, created_at")
          .eq("document_id", docId!),
      ]);
      const member = ((memberRes.data as unknown) ?? []) as DownloadEvent[];
      const pub = ((publicRes.data as unknown) ?? []) as DownloadEvent[];
      return [...member, ...pub];
    },
  });

  const stats = useMemo(() => {
    const impressions = badgeEvents.filter((e) => e.event_type === "impression");
    const clicks = badgeEvents.filter((e) => e.event_type === "click");

    // By day
    const dayMap = new Map<string, { impressions: number; clicks: number; downloads: number }>();
    const ensure = (d: string) => {
      if (!dayMap.has(d)) dayMap.set(d, { impressions: 0, clicks: 0, downloads: 0 });
      return dayMap.get(d)!;
    };
    impressions.forEach((e) => (ensure(fmtDay(e.created_at)).impressions += 1));
    clicks.forEach((e) => (ensure(fmtDay(e.created_at)).clicks += 1));
    downloadEvents.forEach((e) => (ensure(fmtDay(e.created_at)).downloads += 1));
    const byDay = Array.from(dayMap.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => (a.day < b.day ? 1 : -1));

    // By country
    const countryMap = new Map<string, { impressions: number; clicks: number; downloads: number }>();
    const ensureC = (c: string) => {
      if (!countryMap.has(c)) countryMap.set(c, { impressions: 0, clicks: 0, downloads: 0 });
      return countryMap.get(c)!;
    };
    impressions.forEach((e) => (ensureC(e.country || "Unknown").impressions += 1));
    clicks.forEach((e) => (ensureC(e.country || "Unknown").clicks += 1));
    downloadEvents.forEach((e) => (ensureC(e.country || "Unknown").downloads += 1));
    const byCountry = Array.from(countryMap.entries())
      .map(([country, v]) => ({ country, ...v }))
      .sort(
        (a, b) =>
          b.downloads - a.downloads ||
          b.clicks - a.clicks ||
          b.impressions - a.impressions,
      );

    // By source
    const sourceMap = new Map<string, { impressions: number; clicks: number }>();
    const ensureS = (s: string) => {
      if (!sourceMap.has(s)) sourceMap.set(s, { impressions: 0, clicks: 0 });
      return sourceMap.get(s)!;
    };
    impressions.forEach((e) => (ensureS(e.source || "unknown").impressions += 1));
    clicks.forEach((e) => (ensureS(e.source || "unknown").clicks += 1));
    const bySource = Array.from(sourceMap.entries())
      .map(([source, v]) => ({ source, ...v }))
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions);

    const totalImpressions = impressions.length;
    const totalClicks = clicks.length;
    const totalDownloads = downloadEvents.length;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const conv = totalClicks > 0 ? (totalDownloads / totalClicks) * 100 : 0;

    return { byDay, byCountry, bySource, totalImpressions, totalClicks, totalDownloads, ctr, conv };
  }, [badgeEvents, downloadEvents]);

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const maxDay = Math.max(
    1,
    ...stats.byDay.map((d) => Math.max(d.impressions, d.clicks, d.downloads)),
  );

  return (
    <>
      <Helmet>
        <title>Magazine Analytics — Admin — Maison Affluency</title>
      </Helmet>

      <div className="max-w-6xl space-y-10">
        <div className="flex items-center gap-3">
          <Link to="/trade/admin-dashboard" className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="font-display text-2xl text-foreground">Featured Magazine Analytics</h1>
            <p className="font-body text-sm text-muted-foreground mt-0.5">
              {docLoading
                ? "Loading featured issue…"
                : featuredDoc
                  ? <>Currently featured: <span className="text-foreground">{featuredDoc.title}</span></>
                  : "No issue is currently flagged as featured."}
            </p>
          </div>
        </div>

        {!featuredDoc && !docLoading ? (
          <p className="text-sm text-muted-foreground">
            Mark a document as the public featured issue from the Documents admin to see analytics.
          </p>
        ) : (
          <>
            {/* Top metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard
                icon={<Eye className="h-4 w-4" />}
                label="Badge impressions"
                value={stats.totalImpressions}
              />
              <MetricCard
                icon={<MousePointerClick className="h-4 w-4" />}
                label="Badge / CTA clicks"
                value={stats.totalClicks}
                hint={`CTR ${stats.ctr.toFixed(1)}%`}
              />
              <MetricCard
                icon={<Download className="h-4 w-4" />}
                label="Downloads"
                value={stats.totalDownloads}
                hint={`Conv. from click ${stats.conv.toFixed(1)}%`}
              />
            </div>

            {/* By day */}
            <section className="space-y-3">
              <h2 className="font-display text-lg text-foreground">Daily activity</h2>
              {badgeLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : stats.byDay.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Day</th>
                        <th className="text-right px-3 py-2">Impressions</th>
                        <th className="text-right px-3 py-2">Clicks</th>
                        <th className="text-right px-3 py-2">Downloads</th>
                        <th className="px-3 py-2 w-[40%]">Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byDay.map((d) => (
                        <tr key={d.day} className="border-t border-border">
                          <td className="px-3 py-2 font-mono text-xs">{d.day}</td>
                          <td className="px-3 py-2 text-right">{d.impressions}</td>
                          <td className="px-3 py-2 text-right">{d.clicks}</td>
                          <td className="px-3 py-2 text-right">{d.downloads}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1">
                              <Bar value={d.impressions} max={maxDay} className="bg-muted-foreground/40" />
                              <Bar value={d.clicks} max={maxDay} className="bg-primary/70" />
                              <Bar value={d.downloads} max={maxDay} className="bg-foreground" />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                <span className="inline-block w-2 h-2 bg-muted-foreground/40 rounded-sm mr-1 align-middle" /> impressions
                <span className="inline-block w-2 h-2 bg-primary/70 rounded-sm mx-1 ml-3 align-middle" /> clicks
                <span className="inline-block w-2 h-2 bg-foreground rounded-sm mx-1 ml-3 align-middle" /> downloads
              </p>
            </section>

            {/* By country */}
            <section className="space-y-3">
              <h2 className="font-display text-lg text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4" /> By country
              </h2>
              {stats.byCountry.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Country</th>
                        <th className="text-right px-3 py-2">Impressions</th>
                        <th className="text-right px-3 py-2">Clicks</th>
                        <th className="text-right px-3 py-2">Downloads</th>
                        <th className="text-right px-3 py-2">CTR</th>
                        <th className="text-right px-3 py-2">Conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.byCountry.map((c) => {
                        const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                        const conv = c.clicks > 0 ? (c.downloads / c.clicks) * 100 : 0;
                        return (
                          <tr key={c.country} className="border-t border-border">
                            <td className="px-3 py-2">{c.country}</td>
                            <td className="px-3 py-2 text-right">{c.impressions}</td>
                            <td className="px-3 py-2 text-right">{c.clicks}</td>
                            <td className="px-3 py-2 text-right">{c.downloads}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{ctr.toFixed(1)}%</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{conv.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* By source */}
            <section className="space-y-3">
              <h2 className="font-display text-lg text-foreground">By surface</h2>
              {stats.bySource.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="text-left px-3 py-2">Source</th>
                        <th className="text-right px-3 py-2">Impressions</th>
                        <th className="text-right px-3 py-2">Clicks</th>
                        <th className="text-right px-3 py-2">CTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.bySource.map((s) => {
                        const ctr = s.impressions > 0 ? (s.clicks / s.impressions) * 100 : 0;
                        return (
                          <tr key={s.source} className="border-t border-border">
                            <td className="px-3 py-2 font-mono text-xs">{s.source}</td>
                            <td className="px-3 py-2 text-right">{s.impressions}</td>
                            <td className="px-3 py-2 text-right">{s.clicks}</td>
                            <td className="px-3 py-2 text-right text-muted-foreground">{ctr.toFixed(1)}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}

function MetricCard({
  icon, label, value, hint,
}: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-md border border-border p-4 bg-card">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-2 font-display text-2xl text-foreground">{value.toLocaleString()}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 rounded-sm" style={{ width: `${w}%` }}>
      <div className={`h-full w-full rounded-sm ${className}`} />
    </div>
  );
}
