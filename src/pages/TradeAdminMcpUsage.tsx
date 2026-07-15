import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

type QueryRow = {
  id: string;
  tool_name: string;
  args: any;
  result_count: number | null;
  duration_ms: number | null;
  is_error: boolean;
  created_at: string;
};

type ClickRow = {
  id: string;
  click_type: string;
  designer_slug: string | null;
  pick_id: string | null;
  ip_hash: string | null;
  created_at: string;
};

const DAYS = 30;

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function lastNDays(n: number): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function TradeAdminMcpUsage() {
  const { user, isAdmin, loading } = useAuth();

  const since = useMemo(
    () => new Date(Date.now() - DAYS * 86400000).toISOString(),
    []
  );

  const { data: queries, isLoading: qLoading } = useQuery({
    queryKey: ["mcp-query-log", DAYS],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_query_log")
        .select("id, tool_name, args, result_count, duration_ms, is_error, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data || []) as QueryRow[];
    },
  });

  const { data: clicks, isLoading: cLoading } = useQuery({
    queryKey: ["mcp-click-log", DAYS],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mcp_click_log")
        .select("id, click_type, designer_slug, pick_id, ip_hash, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return (data || []) as ClickRow[];
    },
  });

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const qs = queries || [];
  const cs = clicks || [];

  // Totals
  const totalQueries = qs.length;
  const totalClicks = cs.length;
  const productClicks = cs.filter((c) => c.click_type === "product").length;
  const designerClicks = cs.filter((c) => c.click_type === "designer").length;
  const signupClicks = cs.filter((c) => c.click_type === "signup").length;
  const errorCount = qs.filter((q) => q.is_error).length;
  const errorRate = totalQueries ? (errorCount / totalQueries) * 100 : 0;
  const conversionRate = totalQueries
    ? (totalClicks / totalQueries) * 100
    : 0;
  const signupConversion = totalQueries
    ? (signupClicks / totalQueries) * 100
    : 0;
  const avgLatency =
    qs.length > 0
      ? qs.reduce((s, r) => s + (r.duration_ms || 0), 0) / qs.length
      : 0;

  // By tool
  const byTool = new Map<
    string,
    { tool: string; calls: number; errors: number; avg_ms: number; total_ms: number; results: number }
  >();
  for (const r of qs) {
    const t = byTool.get(r.tool_name) || {
      tool: r.tool_name,
      calls: 0,
      errors: 0,
      avg_ms: 0,
      total_ms: 0,
      results: 0,
    };
    t.calls++;
    if (r.is_error) t.errors++;
    t.total_ms += r.duration_ms || 0;
    t.results += r.result_count || 0;
    byTool.set(r.tool_name, t);
  }
  const toolRows = Array.from(byTool.values())
    .map((t) => ({ ...t, avg_ms: t.calls ? Math.round(t.total_ms / t.calls) : 0 }))
    .sort((a, b) => b.calls - a.calls);

  // By day
  const days = lastNDays(DAYS);
  const dayMap = new Map<string, { day: string; queries: number; clicks: number; signups: number }>();
  for (const d of days) dayMap.set(d, { day: d.slice(5), queries: 0, clicks: 0, signups: 0 });
  for (const r of qs) {
    const k = dayKey(r.created_at);
    const b = dayMap.get(k);
    if (b) b.queries++;
  }
  for (const r of cs) {
    const k = dayKey(r.created_at);
    const b = dayMap.get(k);
    if (b) {
      b.clicks++;
      if (r.click_type === "signup") b.signups++;
    }
  }
  const dayRows = Array.from(dayMap.values());

  // By designer (from clicks + query args.designer_slug)
  const byDesigner = new Map<string, { designer: string; clicks: number; products: number; queries: number }>();
  for (const c of cs) {
    if (!c.designer_slug) continue;
    const d = byDesigner.get(c.designer_slug) || {
      designer: c.designer_slug,
      clicks: 0,
      products: 0,
      queries: 0,
    };
    d.clicks++;
    if (c.click_type === "product") d.products++;
    byDesigner.set(c.designer_slug, d);
  }
  for (const q of qs) {
    const slug = q.args?.designer_slug || q.args?.slug;
    if (typeof slug !== "string" || !slug) continue;
    const d = byDesigner.get(slug) || {
      designer: slug,
      clicks: 0,
      products: 0,
      queries: 0,
    };
    d.queries++;
    byDesigner.set(slug, d);
  }
  const designerRows = Array.from(byDesigner.values())
    .sort((a, b) => b.clicks + b.queries - (a.clicks + a.queries))
    .slice(0, 20);

  const isLoading = qLoading || cLoading;

  return (
    <>
      <Helmet>
        <title>MCP Usage — Admin — Maison Affluency</title>
      </Helmet>
      <div className="max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl text-foreground">MCP Usage</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Public catalog MCP server — queries, clicks, and conversion over the last {DAYS} days.
          </p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Queries" value={totalQueries.toLocaleString()} />
          <Kpi label="Clicks" value={totalClicks.toLocaleString()} />
          <Kpi
            label="Conversion"
            value={`${conversionRate.toFixed(1)}%`}
            sub={`${signupConversion.toFixed(1)}% → signup`}
          />
          <Kpi
            label="Avg latency"
            value={`${Math.round(avgLatency)} ms`}
            sub={`${errorRate.toFixed(1)}% errors`}
          />
        </div>

        {isLoading && (
          <p className="font-body text-sm text-muted-foreground">Loading…</p>
        )}

        {/* Daily traffic */}
        <Section title="Daily traffic">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <LineChart data={dayRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="queries" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicks" stroke="hsl(var(--accent-foreground))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="signups" stroke="#c48a3a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>

        {/* By tool */}
        <Section title="By tool">
          <div className="h-64 w-full">
            <ResponsiveContainer>
              <BarChart data={toolRows}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="tool" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="calls" fill="hsl(var(--primary))" />
                <Bar dataKey="errors" fill="#c0392b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4">Tool</th>
                  <th className="text-right py-2 pr-4">Calls</th>
                  <th className="text-right py-2 pr-4">Errors</th>
                  <th className="text-right py-2 pr-4">Avg ms</th>
                  <th className="text-right py-2">Total results</th>
                </tr>
              </thead>
              <tbody>
                {toolRows.map((t) => (
                  <tr key={t.tool} className="border-b border-border/50 font-body">
                    <td className="py-2 pr-4 font-mono text-xs">{t.tool}</td>
                    <td className="py-2 pr-4 text-right">{t.calls}</td>
                    <td className="py-2 pr-4 text-right">{t.errors}</td>
                    <td className="py-2 pr-4 text-right">{t.avg_ms}</td>
                    <td className="py-2 text-right">{t.results}</td>
                  </tr>
                ))}
                {toolRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-center text-muted-foreground text-xs">
                      No queries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Click breakdown */}
        <Section title="Click breakdown">
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Product clicks" value={productClicks.toLocaleString()} />
            <Kpi label="Designer clicks" value={designerClicks.toLocaleString()} />
            <Kpi label="Signup clicks" value={signupClicks.toLocaleString()} />
          </div>
        </Section>

        {/* Top designers */}
        <Section title="Top designers (queries + clicks)">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4">Designer</th>
                  <th className="text-right py-2 pr-4">Queries</th>
                  <th className="text-right py-2 pr-4">Clicks</th>
                  <th className="text-right py-2">Product clicks</th>
                </tr>
              </thead>
              <tbody>
                {designerRows.map((d) => (
                  <tr key={d.designer} className="border-b border-border/50 font-body">
                    <td className="py-2 pr-4 font-mono text-xs">{d.designer}</td>
                    <td className="py-2 pr-4 text-right">{d.queries}</td>
                    <td className="py-2 pr-4 text-right">{d.clicks}</td>
                    <td className="py-2 text-right">{d.products}</td>
                  </tr>
                ))}
                {designerRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-center text-muted-foreground text-xs">
                      No designer activity yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground font-body">{label}</div>
      <div className="font-display text-2xl text-foreground mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5 font-body">{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      {children}
    </section>
  );
}
