import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Coins, AlertTriangle, Activity, Download, Database, Loader2 } from "lucide-react";
import { jsPDF } from "jspdf";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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

const PDF_FEATURE_COLORS: Array<[number, number, number]> = [
  [49, 74, 67],
  [117, 139, 126],
  [188, 160, 92],
  [92, 99, 96],
  [124, 152, 133],
  [201, 168, 76],
  [139, 111, 94],
  [74, 103, 65],
];

function fmtUSD(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}
function fmtNum(n: number) {
  return (n || 0).toLocaleString();
}

function exportFilename(date = new Date()) {
  return `AI Usage Dashboard - ${format(date, "yyyy-MM-dd")}.pdf`;
}

function downloadPdfBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

function drawText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = 11) {
  const lines = doc.splitTextToSize(text || "—", maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function renderAiUsagePdf(args: {
  days: number;
  totals?: Totals;
  byFeature: FeatureRow[];
  dailyTokens: Array<Record<string, number | string>>;
  dailyCost: Array<{ day: string; cost_usd: number }>;
  features: string[];
}) {
  const { days, totals, byFeature, dailyTokens, dailyCost, features } = args;
  const generated = new Date();
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const contentW = pageW - margin * 2;
  const errorRate = totals && totals.requests > 0 ? (totals.errors / totals.requests) * 100 : 0;

  const addFooter = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated ${format(generated, "MMM d, yyyy HH:mm")} · Page ${i} of ${pageCount}`, margin, pageH - 18);
    }
  };

  doc.setFillColor(250, 249, 245);
  doc.rect(0, 0, pageW, pageH, "F");
  doc.setTextColor(28, 36, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(24);
  doc.text("AI Usage Dashboard", margin, 54);
  doc.setFontSize(9);
  doc.setTextColor(92, 99, 96);
  doc.text(`Window: last ${days} days`, margin, 74);

  const kpis = [
    ["Requests", fmtNum(totals?.requests || 0)],
    ["Total tokens", fmtNum(totals?.tokens || 0)],
    ["Estimated cost", fmtUSD(Number(totals?.cost_usd || 0))],
    ["Error rate", `${errorRate.toFixed(1)}%`],
  ];
  const cardW = (contentW - 24) / 4;
  kpis.forEach(([label, value], i) => {
    const x = margin + i * (cardW + 8);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(221, 217, 205);
    doc.roundedRect(x, 96, cardW, 64, 4, 4, "FD");
    doc.setFontSize(8);
    doc.setTextColor(92, 99, 96);
    doc.text(label, x + 12, 118);
    doc.setFontSize(18);
    doc.setTextColor(28, 36, 33);
    doc.text(value, x + 12, 145);
  });

  const chartTop = 192;
  const chartH = 150;
  const chartW = (contentW - 24) / 2;
  const chartGap = 24;
  const maxTokens = Math.max(1, ...dailyTokens.map((row) => features.reduce((sum, f) => sum + Number(row[f] || 0), 0)));
  const maxCost = Math.max(0.01, ...dailyCost.map((row) => Number(row.cost_usd || 0)));

  doc.setFontSize(11);
  doc.setTextColor(28, 36, 33);
  doc.text("Daily tokens by feature", margin, chartTop - 12);
  doc.text("Estimated cost per day", margin + chartW + chartGap, chartTop - 12);

  const drawChartBox = (x: number) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(221, 217, 205);
    doc.roundedRect(x, chartTop, chartW, chartH, 4, 4, "FD");
    doc.setDrawColor(235, 232, 223);
    for (let i = 1; i < 4; i++) {
      const y = chartTop + (chartH / 4) * i;
      doc.line(x + 28, y, x + chartW - 12, y);
    }
  };
  drawChartBox(margin);
  drawChartBox(margin + chartW + chartGap);

  const plotX = margin + 32;
  const plotY = chartTop + 16;
  const plotW = chartW - 48;
  const plotH = chartH - 34;
  const barGap = 3;
  const barW = dailyTokens.length ? Math.max(3, (plotW - barGap * (dailyTokens.length - 1)) / dailyTokens.length) : plotW;

  dailyTokens.forEach((row, idx) => {
    const x = plotX + idx * (barW + barGap);
    let stackBase = plotY + plotH;
    features.forEach((f, featureIdx) => {
      const value = Number(row[f] || 0);
      if (!value) return;
      const h = Math.max(1, (value / maxTokens) * plotH);
      const [r, g, b] = PDF_FEATURE_COLORS[featureIdx % PDF_FEATURE_COLORS.length];
      doc.setFillColor(r, g, b);
      doc.rect(x, stackBase - h, barW, h, "F");
      stackBase -= h;
    });
  });

  if (features.length) {
    let legendX = margin + 12;
    let legendY = chartTop + chartH + 18;
    doc.setFontSize(7);
    features.slice(0, 8).forEach((f, i) => {
      const [r, g, b] = PDF_FEATURE_COLORS[i % PDF_FEATURE_COLORS.length];
      doc.setFillColor(r, g, b);
      doc.rect(legendX, legendY - 6, 6, 6, "F");
      doc.setTextColor(92, 99, 96);
      const label = f.length > 18 ? `${f.slice(0, 17)}…` : f;
      doc.text(label, legendX + 9, legendY);
      legendX += 78;
      if (legendX > margin + chartW - 70) {
        legendX = margin + 12;
        legendY += 10;
      }
    });
  }

  const costX = margin + chartW + chartGap + 32;
  const costY = chartTop + 16;
  const costW = chartW - 48;
  const costH = chartH - 34;
  doc.setDrawColor(49, 74, 67);
  doc.setLineWidth(1.5);
  dailyCost.forEach((row, idx) => {
    if (dailyCost.length < 2) return;
    const x = costX + (idx / (dailyCost.length - 1)) * costW;
    const y = costY + costH - (Number(row.cost_usd || 0) / maxCost) * costH;
    if (idx === 0) doc.moveTo(x, y);
    else doc.lineTo(x, y);
  });
  doc.stroke();

  let y = 390;
  doc.setFontSize(12);
  doc.setTextColor(28, 36, 33);
  doc.text("By feature", margin, y);
  y += 18;

  const columns = [
    { label: "Feature", x: margin, w: 175, align: "left" as const },
    { label: "Requests", x: margin + 185, w: 58, align: "right" as const },
    { label: "Prompt", x: margin + 253, w: 58, align: "right" as const },
    { label: "Completion", x: margin + 321, w: 70, align: "right" as const },
    { label: "Total", x: margin + 401, w: 64, align: "right" as const },
    { label: "Avg/req", x: margin + 475, w: 58, align: "right" as const },
    { label: "Errors", x: margin + 543, w: 46, align: "right" as const },
    { label: "Cost", x: margin + 599, w: 70, align: "right" as const },
    { label: "Last call", x: margin + 679, w: 88, align: "right" as const },
  ];

  const drawHeader = () => {
    doc.setFillColor(235, 232, 223);
    doc.rect(margin, y - 12, contentW, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(92, 99, 96);
    columns.forEach((c) => doc.text(c.label, c.align === "right" ? c.x + c.w : c.x + 4, y, { align: c.align }));
    doc.setFont("helvetica", "normal");
    y += 18;
  };

  drawHeader();
  const rows = byFeature.length ? byFeature : [];
  if (!rows.length) {
    doc.setFontSize(8);
    doc.setTextColor(92, 99, 96);
    doc.text("No AI usage recorded in this window yet.", margin + 4, y + 8);
  }

  rows.forEach((r, idx) => {
    if (y > pageH - 44) {
      doc.addPage("a4", "landscape");
      doc.setFillColor(250, 249, 245);
      doc.rect(0, 0, pageW, pageH, "F");
      y = margin + 18;
      drawHeader();
    }
    if (idx % 2 === 0) {
      doc.setFillColor(255, 255, 255);
      doc.rect(margin, y - 11, contentW, 18, "F");
    }
    doc.setFontSize(7.5);
    doc.setTextColor(28, 36, 33);
    const feature = r.feature.length > 38 ? `${r.feature.slice(0, 37)}…` : r.feature;
    const values = [
      feature,
      fmtNum(r.requests),
      fmtNum(r.prompt_tokens),
      fmtNum(r.completion_tokens),
      fmtNum(r.tokens),
      fmtNum(r.avg_tokens),
      fmtNum(r.errors),
      fmtUSD(Number(r.cost_usd || 0)),
      r.last_call ? format(new Date(r.last_call), "MMM d, HH:mm") : "—",
    ];
    columns.forEach((c, i) => doc.text(values[i], c.align === "right" ? c.x + c.w : c.x + 4, y, { align: c.align }));
    y += 18;
  });

  y += 12;
  if (y > pageH - 50) {
    doc.addPage("a4", "landscape");
    doc.setFillColor(250, 249, 245);
    doc.rect(0, 0, pageW, pageH, "F");
    y = margin;
  }
  doc.setFontSize(7.5);
  doc.setTextColor(120, 120, 120);
  drawText(
    doc,
    "Cost figures are estimates calculated from the maintained model price map. This export is generated directly as a PDF with a fixed filename and does not use the browser print dialog.",
    margin,
    y,
    contentW,
    10,
  );

  addFooter();
  return doc.output("blob");
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
                const blob = renderAiUsagePdf({ days, totals, byFeature, dailyTokens, dailyCost, features });
                downloadPdfBlob(blob, exportFilename());
              }}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs rounded-md border border-border bg-background text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Download PDF"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>


          </div>
        </header>

        <EmbedCatalogPanel />



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
