import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Coins, AlertTriangle, Activity, Printer } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { format, subDays } from "date-fns";

interface DailyRow {
  day: string;
  feature: string;
  requests: number;
  tokens: number;
  cost_usd: number;
}
interface FeatureRow {
  feature: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  tokens: number;
  cost_usd: number;
  avg_tokens: number;
  errors: number;
  last_call: string;
}
interface Totals {
  requests: number;
  tokens: number;
  cost_usd: number;
  errors: number;
}

const PRESETS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

const FEATURE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--secondary))",
  "hsl(var(--muted-foreground))",
  "#7c9885",
  "#c9a84c",
  "#8b6f5e",
  "#4a6741",
];

function fmtUSD(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return (n || 0).toLocaleString();
}

export default function TradeAiUsageDashboard() {
  const { user, isAdmin, loading } = useAuth();
  const [days, setDays] = useState(30);

  const range = useMemo(() => {
    const to = new Date();
    const from = subDays(to, days);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [days]);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-usage-summary", days],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_ai_usage_summary", {
        _from: range.from,
        _to: range.to,
      });
      if (error) throw error;
      return data as unknown as { totals: Totals; daily: DailyRow[]; by_feature: FeatureRow[] };
    },
  });

  // Pivot daily rows: one row per day with per-feature token columns.
  const { dailyTokens, dailyCost, features } = useMemo(() => {
    const daily = data?.daily || [];
    const featureSet = new Set<string>();
    const byDay = new Map<string, Record<string, number>>();
    const byDayCost = new Map<string, number>();
    for (const r of daily) {
      featureSet.add(r.feature);
      const dKey = format(new Date(r.day), "MMM d");
      if (!byDay.has(dKey)) byDay.set(dKey, { day: dKey } as any);
      const bucket = byDay.get(dKey)!;
      bucket[r.feature] = (Number(bucket[r.feature]) || 0) + Number(r.tokens || 0);
      byDayCost.set(dKey, (byDayCost.get(dKey) || 0) + Number(r.cost_usd || 0));
    }
    return {
      dailyTokens: Array.from(byDay.values()),
      dailyCost: Array.from(byDayCost.entries()).map(([day, cost_usd]) => ({ day, cost_usd })),
      features: Array.from(featureSet),
    };
  }, [data]);

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const totals = data?.totals;
  const byFeature = data?.by_feature || [];
  const errorRate = totals && totals.requests > 0 ? (totals.errors / totals.requests) * 100 : 0;

  return (
    <div className="min-h-screen bg-background print-root">
      <Helmet>
        <title>AI Usage Dashboard — Admin</title>
        <meta name="robots" content="noindex" />
        <style>{`
          @media print {
            @page { size: A4 landscape; margin: 10mm; }
            html, body { background: #ffffff !important; color: #111 !important; }
            /* Hide all app chrome (nav, sidebars, headers from TradeLayout) */
            body * { visibility: hidden !important; }
            .print-root, .print-root * { visibility: visible !important; }
            .print-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              min-height: 0 !important;
              background: #ffffff !important;
            }
            .no-print { display: none !important; }
            .print-break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
            .print-root, .print-root * {
              color: #111 !important;
              border-color: #d4d4d4 !important;
              box-shadow: none !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-root .bg-card, .print-root section { background: #ffffff !important; }
            .print-root .bg-muted\\/40 { background: #f5f5f5 !important; }
            .print-root .text-muted-foreground { color: #555 !important; }
            .recharts-wrapper, .recharts-surface { overflow: visible !important; }
            .recharts-cartesian-axis-tick text, .recharts-legend-item-text { fill: #333 !important; color: #333 !important; }
            .recharts-cartesian-grid line { stroke: #e5e5e5 !important; }
            table { font-size: 10px !important; }
            th, td { padding: 4px 8px !important; }
          }
        `}</style>


      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 print:px-0 print:py-0 print:space-y-4">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-light tracking-tight">AI Usage Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tokens, requests, and estimated cost by feature and day. Estimates based on published model pricing.
            </p>
            <p className="hidden print:block text-xs text-muted-foreground mt-1">
              Window: last {days} days · Generated {format(new Date(), "MMM d, yyyy HH:mm")}
            </p>
          </div>
          <div className="flex gap-2 no-print">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                  days === p.days
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => {
                const prev = document.title;
                document.title = `AI Usage Dashboard - ${format(new Date(), "yyyy-MM-dd")}`;
                const restore = () => {
                  document.title = prev;
                  window.removeEventListener("afterprint", restore);
                };
                window.addEventListener("afterprint", restore);
                window.print();
              }}
              className="px-3 py-1.5 text-xs rounded-md border border-border bg-background text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5"
              title="Print or save as PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              Print / PDF
            </button>

          </div>
        </header>

        {/* KPI cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi icon={<Activity className="h-4 w-4" />} label="Requests" value={fmtNum(totals?.requests || 0)} />
          <Kpi icon={<BarChart3 className="h-4 w-4" />} label="Total tokens" value={fmtNum(totals?.tokens || 0)} />
          <Kpi icon={<Coins className="h-4 w-4" />} label="Estimated cost" value={fmtUSD(Number(totals?.cost_usd || 0))} />
          <Kpi
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Error rate"
            value={`${errorRate.toFixed(1)}%`}
            tone={errorRate > 5 ? "warn" : "ok"}
          />
        </div>

        {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

        {/* Daily tokens stacked by feature */}
        <section className="bg-card border border-border rounded-lg p-4 print-break-inside-avoid">
          <h2 className="text-sm font-medium mb-3">Daily tokens by feature</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTokens}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {features.map((f, i) => (
                  <Bar key={f} dataKey={f} stackId="t" fill={FEATURE_COLORS[i % FEATURE_COLORS.length]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Daily cost line */}
        <section className="bg-card border border-border rounded-lg p-4 print-break-inside-avoid">
          <h2 className="text-sm font-medium mb-3">Estimated cost (USD) per day</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyCost}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip
                  formatter={(v: any) => fmtUSD(Number(v))}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                />
                <Line type="monotone" dataKey="cost_usd" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Per-feature table */}
        <section className="bg-card border border-border rounded-lg overflow-hidden print-break-inside-avoid">
          <div className="p-4 border-b border-border">
            <h2 className="text-sm font-medium">By feature</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Feature</th>
                  <th className="text-right px-4 py-2 font-medium">Requests</th>
                  <th className="text-right px-4 py-2 font-medium">Prompt</th>
                  <th className="text-right px-4 py-2 font-medium">Completion</th>
                  <th className="text-right px-4 py-2 font-medium">Total tokens</th>
                  <th className="text-right px-4 py-2 font-medium">Avg / req</th>
                  <th className="text-right px-4 py-2 font-medium">Errors</th>
                  <th className="text-right px-4 py-2 font-medium">Est. cost</th>
                  <th className="text-right px-4 py-2 font-medium">Last call</th>
                </tr>
              </thead>
              <tbody>
                {byFeature.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={9} className="text-center px-4 py-8 text-muted-foreground text-xs">
                      No AI usage recorded in this window yet.
                    </td>
                  </tr>
                )}
                {byFeature.map((r) => (
                  <tr key={r.feature} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2 font-medium">{r.feature}</td>
                    <td className="px-4 py-2 text-right">{fmtNum(r.requests)}</td>
                    <td className="px-4 py-2 text-right">{fmtNum(r.prompt_tokens)}</td>
                    <td className="px-4 py-2 text-right">{fmtNum(r.completion_tokens)}</td>
                    <td className="px-4 py-2 text-right">{fmtNum(r.tokens)}</td>
                    <td className="px-4 py-2 text-right">{fmtNum(r.avg_tokens)}</td>
                    <td className={`px-4 py-2 text-right ${r.errors > 0 ? "text-destructive" : ""}`}>
                      {fmtNum(r.errors)}
                    </td>
                    <td className="px-4 py-2 text-right">{fmtUSD(Number(r.cost_usd || 0))}</td>
                    <td className="px-4 py-2 text-right text-xs text-muted-foreground">
                      {r.last_call ? format(new Date(r.last_call), "MMM d, HH:mm") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="text-xs text-muted-foreground">
          Cost figures are estimates calculated from a static per-model price map maintained in
          <code className="mx-1">supabase/functions/_shared/aiUsage.ts</code>. Update that file when Lovable pricing changes.
        </p>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-light ${tone === "warn" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
