import { Helmet } from "react-helmet-async";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useMemo, useState } from "react";
import {
  Wallet, TrendingUp, Percent, Banknote, Search, X, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { useProjectFilter } from "@/hooks/useProjectFilter";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

interface BudgetItem {
  item_id: string;
  product_name: string;
  brand_name: string;
  category: string;
  quantity: number;
  unit_cost_cents: number;   // supplier / trade cost per unit
  currency: string;
  quote_id: string;
  quote_ref: string;
  client_name: string | null;
  project_id: string | null;
  project_name: string | null;
  quote_created_at: string | null;
  deposit_pct: number;       // 0..1
}

type TierKey = "A" | "B" | "C" | "custom";

const TIERS: { key: TierKey; label: string; pct: number | null }[] = [
  { key: "A", label: "Tier A (10%)", pct: 0.10 },
  { key: "B", label: "Tier B (15%)", pct: 0.15 },
  { key: "C", label: "Tier C (20%)", pct: 0.20 },
  { key: "custom", label: "Custom %", pct: null },
];

const DEFAULT_TIER: TierKey = "B";

interface RowConfig {
  tier: TierKey;
  customPct: number;   // percentage points, e.g. 27.5
  depositPct: number;  // percentage points, e.g. 50
  depositPaid: boolean;
}

const CONFIG_KEY = "trade-budget-cashflow-config-v1";
const COMPACT_KEY = "trade-budget-cashflow-compact-v1";

const QUOTE_REF = (id: string) => `QU-${id.slice(0, 6).toUpperCase()}`;

function loadConfig(): Record<string, RowConfig> {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function money(cents: number, currency = "EUR") {
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "SGD" ? "S$" : "€";
  return `${symbol}${(cents / 100).toLocaleString("en", { maximumFractionDigits: 0 })}`;
}

function markupPct(cfg: RowConfig): number {
  const tier = TIERS.find((t) => t.key === cfg.tier);
  if (!tier || tier.pct == null) return Math.max(0, cfg.customPct) / 100;
  return tier.pct;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function TradeBudgetTracker() {
  const { user } = useAuth();
  const { projectFilter, clearProjectFilter } = useProjectFilter();

  const [config, setConfig] = useState<Record<string, RowConfig>>(() => loadConfig());
  const [search, setSearch] = useState("");
  const [isCompact, setIsCompact] = useState(() => {
    try { return localStorage.getItem(COMPACT_KEY) === "1"; } catch { return false; }
  });
  const [globalMarkupPct, setGlobalMarkupPct] = useState(0);

  useEffect(() => {
    try { localStorage.setItem(COMPACT_KEY, isCompact ? "1" : "0"); } catch { /* ignore */ }
  }, [isCompact]);

  const persist = (next: Record<string, RowConfig>) => {
    setConfig(next);
    try { localStorage.setItem(CONFIG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["budget-cashflow", user?.id, projectFilter],
    queryFn: async (): Promise<BudgetItem[]> => {
      let qq = supabase
        .from("trade_quotes")
        .select("id, client_name, status, project_id, created_at")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "submitted", "responded", "priced", "deposit_paid", "paid"]);
      if (projectFilter) qq = qq.eq("project_id", projectFilter);
      const { data: quotes } = await qq;
      if (!quotes?.length) return [];

      const quoteIds = quotes.map((q) => q.id);
      const { data: qItems } = await supabase
        .from("trade_quote_items")
        .select("id, product_id, quantity, unit_price_cents, quote_id, deposit_pct_override")
        .in("quote_id", quoteIds);
      if (!qItems?.length) return [];

      const productIds = [...new Set(qItems.map((i) => i.product_id))];
      const { data: products } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, category, currency")
        .in("id", productIds);

      const projectIds = [...new Set(quotes.map((q: any) => q.project_id).filter(Boolean))] as string[];
      const { data: projects } = projectIds.length
        ? await supabase.from("projects" as any).select("id, name").in("id", projectIds)
        : { data: [] as any[] };

      const productMap = Object.fromEntries((products || []).map((p: any) => [p.id, p]));
      const quoteMap = Object.fromEntries(quotes.map((q: any) => [q.id, q]));
      const projectMap = Object.fromEntries(((projects as any[]) || []).map((p: any) => [p.id, p.name]));

      return (qItems as any[]).map((item) => {
        const p: any = productMap[item.product_id];
        const q: any = quoteMap[item.quote_id];
        return {
          item_id: item.id,
          product_name: p?.product_name || "Unknown item",
          brand_name: p?.brand_name || "",
          category: p?.category || "",
          quantity: item.quantity || 1,
          unit_cost_cents: item.unit_price_cents || 0,
          currency: p?.currency || "EUR",
          quote_id: item.quote_id,
          quote_ref: QUOTE_REF(item.quote_id),
          client_name: q?.client_name || null,
          project_id: q?.project_id || null,
          project_name: q?.project_id ? projectMap[q.project_id] || null : null,
          quote_created_at: q?.created_at || null,
          deposit_pct: item.deposit_pct_override ?? 0.5,
        } as BudgetItem;
      });
    },
    enabled: !!user,
  });

  const currency = items[0]?.currency || "EUR";

  const cfgFor = (it: BudgetItem): RowConfig =>
    config[it.item_id] || {
      tier: DEFAULT_TIER,
      customPct: 25,
      depositPct: Math.round((it.deposit_pct || 0.5) * 100),
      depositPaid: false,
    };

  const updateRow = (it: BudgetItem, patch: Partial<RowConfig>) => {
    persist({ ...config, [it.item_id]: { ...cfgFor(it), ...patch } });
  };

  /* --- derived rows ------------------------------------------------ */
  const rows = useMemo(() => {
    return items.map((it) => {
      const cfg = cfgFor(it);
      const cost = it.unit_cost_cents * it.quantity;
      const mk = markupPct(cfg) + globalMarkupPct / 100;
      const clientPrice = Math.round(cost * (1 + mk));
      const margin = clientPrice - cost;
      const marginPct = clientPrice > 0 ? (margin / clientPrice) * 100 : 0;
      const depositDue = Math.round(clientPrice * (Math.max(0, Math.min(100, cfg.depositPct)) / 100));
      const collected = cfg.depositPaid ? depositDue : 0;
      const balanceDue = clientPrice - collected;
      return { it, cfg, cost, mk, clientPrice, margin, marginPct, depositDue, collected, balanceDue };
    });
  }, [items, config]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ it }) =>
      [it.product_name, it.brand_name, it.category, it.client_name, it.project_name, it.quote_ref]
        .some((v) => (v || "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const cost = filteredRows.reduce((s, r) => s + r.cost, 0);
    const client = filteredRows.reduce((s, r) => s + r.clientPrice, 0);
    const collected = filteredRows.reduce((s, r) => s + r.collected, 0);
    const margin = client - cost;
    return {
      cost,
      client,
      margin,
      marginPct: client > 0 ? (margin / client) * 100 : 0,
      collected,
      outstanding: client - collected,
    };
  }, [filteredRows]);

  /* --- ledger (grouped by quote) ----------------------------------- */
  const ledger = useMemo(() => {
    const map = new Map<string, {
      quote_id: string; quote_ref: string; label: string;
      client: number; cost: number; depositDue: number; depositPaid: number;
    }>();
    filteredRows.forEach((r) => {
      const key = r.it.quote_id;
      const entry = map.get(key) || {
        quote_id: key,
        quote_ref: r.it.quote_ref,
        label: r.it.project_name || r.it.client_name || "Untitled project",
        client: 0, cost: 0, depositDue: 0, depositPaid: 0,
      };
      entry.client += r.clientPrice;
      entry.cost += r.cost;
      entry.depositDue += r.depositDue;
      entry.depositPaid += r.collected;
      map.set(key, entry);
    });
    return Array.from(map.values()).sort((a, b) => b.client - a.client);
  }, [filteredRows]);

  /* --- cash flow timeline ------------------------------------------ */
  const cashFlow = useMemo(() => {
    if (!filteredRows.length) return [] as { label: string; inflow: number; outflow: number; buffer: number }[];

    const monthKey = (d: Date) => d.getFullYear() * 12 + d.getMonth();
    const anchors = filteredRows.map((r) => new Date(r.it.quote_created_at || Date.now()));
    const startKey = Math.min(...anchors.map(monthKey));

    // Milestone model: deposit invoice settles in the quote month; the final
    // balance is projected 4 months later. Supplier payouts follow the deposit
    // (60% of cost on order release) with the remainder at shipment (+3 months).
    const FINAL_OFFSET = 4;
    const PO_BALANCE_OFFSET = 3;
    const horizon = 6;

    const buckets = new Map<number, { in: number; out: number }>();
    const bump = (k: number, field: "in" | "out", amount: number) => {
      const b = buckets.get(k) || { in: 0, out: 0 };
      b[field] += amount;
      buckets.set(k, b);
    };

    filteredRows.forEach((r) => {
      const k = monthKey(new Date(r.it.quote_created_at || Date.now()));
      if (r.collected > 0) {
        bump(k, "in", r.collected);
        bump(k, "out", Math.round(r.cost * 0.6));
        bump(k + PO_BALANCE_OFFSET, "out", r.cost - Math.round(r.cost * 0.6));
      }
      bump(k + FINAL_OFFSET, "in", r.balanceDue);
    });

    const endKey = Math.max(startKey + horizon, ...Array.from(buckets.keys()));
    const out: { label: string; inflow: number; outflow: number; buffer: number }[] = [];
    let cIn = 0, cOut = 0;
    for (let k = startKey; k <= endKey; k++) {
      const b = buckets.get(k) || { in: 0, out: 0 };
      cIn += b.in;
      cOut += b.out;
      const date = new Date(Math.floor(k / 12), k % 12, 1);
      out.push({
        label: date.toLocaleDateString("en", { month: "short", year: "2-digit" }),
        inflow: Math.round(cIn / 100),
        outflow: Math.round(cOut / 100),
        buffer: Math.round((cIn - cOut) / 100),
      });
    }
    return out;
  }, [filteredRows]);

  const axisMoney = (v: number) => {
    const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "SGD" ? "S$" : "€";
    if (Math.abs(v) >= 1000) return `${symbol}${(v / 1000).toFixed(0)}K`;
    return `${symbol}${v}`;
  };


  const d = isCompact
    ? { th: "px-2 py-1.5", td: "px-2 py-1", text: "text-[10px]", ctl: "h-6 text-[10px]" }
    : { th: "px-3 py-3", td: "px-3 py-2.5", text: "text-xs", ctl: "h-8 text-xs" };

  const statCards = [
    { label: "Total Procurement Cost", value: money(totals.cost, currency), sub: `${filteredRows.length} line${filteredRows.length === 1 ? "" : "s"}`, icon: Wallet, tone: "text-foreground" },
    { label: "Total Client Price", value: money(totals.client, currency), sub: "After applied markup", icon: TrendingUp, tone: "text-foreground" },
    { label: "Gross Profit Margin", value: money(totals.margin, currency), sub: `${totals.marginPct.toFixed(1)}% of client price`, icon: Percent, tone: "text-emerald-700" },
    { label: "Total Deposits Collected", value: money(totals.collected, currency), sub: `${money(totals.outstanding, currency)} outstanding`, icon: Banknote, tone: "text-foreground" },
  ];

  return (
    <>
      <Helmet>
        <title>Budget Tracker &amp; Cash-Flow Planner — Trade Portal</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="w-[95%] max-w-[1800px] mx-auto space-y-6">
        <TradeBreadcrumb />

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl text-foreground">Budget Tracker &amp; Cash-Flow Planner</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">
              Trade margins, tier markups and client billing states across your live projects.
            </p>
          </div>
          {projectFilter && (
            <button
              onClick={clearProjectFilter}
              className="inline-flex items-center gap-1 font-body text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Clear project filter
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><DotCircleLoader size="sm" className="text-muted-foreground" /></div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {statCards.map((c) => (
                <div key={c.label} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <c.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{c.label}</span>
                  </div>
                  <p className={`font-display text-2xl tabular-nums ${c.tone}`}>{c.value}</p>
                  <p className="font-body text-[10px] text-muted-foreground mt-1">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Cash Flow Health */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <div>
                  <h2 className="font-display text-lg text-foreground">Cash Flow Health</h2>
                  <p className="font-body text-xs text-muted-foreground">
                    Cumulative client inflow against supplier payouts — the shaded band is your cash buffer.
                  </p>
                </div>
                <span className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                  Lowest projected buffer: {money(cashFlow.length ? Math.min(...cashFlow.map((p) => p.buffer)) * 100 : 0, currency)}
                </span>
              </div>
              {cashFlow.length === 0 ? (
                <p className="py-10 text-center font-body text-sm text-muted-foreground">
                  No cash-flow data yet — it builds as quotes and deposits are recorded.
                </p>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cashFlow} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                      <defs>
                        <linearGradient id="inflowFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(152 55% 38%)" stopOpacity={0.28} />
                          <stop offset="100%" stopColor="hsl(152 55% 38%)" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="outflowFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(0 65% 50%)" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="hsl(0 65% 50%)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tickFormatter={axisMoney}
                        tick={{ fontSize: 11 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        width={62}
                      />
                      <RTooltip
                        formatter={(value: any, name: any) => [axisMoney(Number(value)), name]}
                        labelFormatter={(l) => `Timeline: ${l}`}
                        contentStyle={{
                          borderRadius: 8,
                          border: "1px solid hsl(var(--border))",
                          background: "hsl(var(--card))",
                          fontSize: 12,
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Area
                        type="monotone"
                        dataKey="inflow"
                        name="Client inflow"
                        stroke="hsl(152 55% 32%)"
                        strokeWidth={2}
                        fill="url(#inflowFill)"
                        activeDot={{ r: 4 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="outflow"
                        name="Supplier outbound"
                        stroke="hsl(0 65% 45%)"
                        strokeWidth={2}
                        fill="url(#outflowFill)"
                        activeDot={{ r: 4 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="buffer"
                        name="Cash buffer"
                        stroke="hsl(var(--muted-foreground))"
                        strokeDasharray="4 4"
                        strokeWidth={1}
                        fill="none"
                        activeDot={{ r: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>



            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/60 px-3 py-2">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items, brands, projects, quotes…"
                  className="h-8 pl-8 font-body text-xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Switch id="budget-compact" checked={isCompact} onCheckedChange={setIsCompact} />
                <Label htmlFor="budget-compact" className="font-body text-xs text-muted-foreground cursor-pointer">
                  Compact View
                </Label>
              </div>
            </div>

            {/* Cost & margin table */}
            {filteredRows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-16 text-center">
                <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="font-body text-sm text-muted-foreground">
                  {items.length ? "No items match your search." : "No budgeted items yet — they appear once quotes are submitted."}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto overscroll-x-contain">
                  <table className="w-full table-fixed min-w-[1180px] 2xl:min-w-0 text-left">
                    <colgroup>
                      <col className="w-[18%]" /><col className="w-[10%]" /><col className="w-[9%]" />
                      <col className="w-[12%]" /><col className="w-[9%]" /><col className="w-[11%]" />
                      <col className="w-[9%]" /><col className="w-[10%]" /><col className="w-[9%]" />
                    </colgroup>
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        {["Item", "Category", "Supplier Cost", "Markup Tier", "Client Price", "Margin ($/%)", "Deposit Req.", "Deposit Paid", "Balance Due"].map((h) => (
                          <th key={h} className={`${d.th} font-body text-[10px] uppercase tracking-widest text-muted-foreground`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((r) => (
                        <tr key={r.it.item_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors align-middle">
                          <td className={d.td}>
                            <p className={`font-display ${isCompact ? "text-[11px]" : "text-sm"} text-foreground truncate`}>{r.it.product_name}</p>
                            <p className="font-body text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                              {r.it.brand_name} · {r.it.quote_ref} · ×{r.it.quantity}
                            </p>
                          </td>
                          <td className={`${d.td} font-body ${d.text} text-muted-foreground truncate`}>{r.it.category || "—"}</td>
                          <td className={`${d.td} font-body ${d.text} tabular-nums text-foreground`}>{money(r.cost, r.it.currency)}</td>
                          <td className={d.td}>
                            <div className="flex items-center gap-1">
                              <Select
                                value={r.cfg.tier}
                                onValueChange={(v) => updateRow(r.it, { tier: v as TierKey })}
                              >
                                <SelectTrigger className={`${d.ctl} font-body`} aria-label={`Markup tier for ${r.it.product_name}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {TIERS.map((t) => (
                                    <SelectItem key={t.key} value={t.key} className="font-body text-xs">{t.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {r.cfg.tier === "custom" && (
                                <Input
                                  type="number"
                                  min={0}
                                  max={500}
                                  value={r.cfg.customPct}
                                  onChange={(e) => updateRow(r.it, { customPct: Number(e.target.value) })}
                                  className={`${d.ctl} w-16 font-body tabular-nums`}
                                  aria-label="Custom markup percentage"
                                />
                              )}
                            </div>
                          </td>
                          <td className={`${d.td} font-display ${isCompact ? "text-[11px]" : "text-sm"} tabular-nums text-foreground`}>
                            {money(r.clientPrice, r.it.currency)}
                          </td>
                          <td className={`${d.td} font-body ${d.text} tabular-nums`}>
                            <span className="text-emerald-700">{money(r.margin, r.it.currency)}</span>
                            <span className="text-muted-foreground"> · {r.marginPct.toFixed(1)}%</span>
                          </td>
                          <td className={d.td}>
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={r.cfg.depositPct}
                                onChange={(e) => updateRow(r.it, { depositPct: Number(e.target.value) })}
                                className={`${d.ctl} w-14 font-body tabular-nums`}
                                aria-label={`Deposit percentage for ${r.it.product_name}`}
                              />
                              <span className="font-body text-[10px] text-muted-foreground">%</span>
                            </div>
                            <p className="font-body text-[10px] text-muted-foreground tabular-nums mt-0.5">{money(r.depositDue, r.it.currency)}</p>
                          </td>
                          <td className={d.td}>
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={r.cfg.depositPaid}
                                onCheckedChange={(v) => updateRow(r.it, { depositPaid: v === true })}
                                aria-label={`Deposit paid for ${r.it.product_name}`}
                              />
                              <span className={`font-body text-[10px] ${r.cfg.depositPaid ? "text-emerald-700" : "text-muted-foreground"}`}>
                                {r.cfg.depositPaid ? "Cleared" : "Pending"}
                              </span>
                            </div>
                          </td>
                          <td className={`${d.td} font-body ${d.text} tabular-nums text-foreground`}>{money(r.balanceDue, r.it.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/40 border-t border-border">
                        <td className={`${d.td} font-body text-[10px] uppercase tracking-widest text-muted-foreground`} colSpan={2}>Total</td>
                        <td className={`${d.td} font-display text-sm tabular-nums`}>{money(totals.cost, currency)}</td>
                        <td className={d.td} />
                        <td className={`${d.td} font-display text-sm tabular-nums`}>{money(totals.client, currency)}</td>
                        <td className={`${d.td} font-body text-xs tabular-nums text-emerald-700`}>
                          {money(totals.margin, currency)} · {totals.marginPct.toFixed(1)}%
                        </td>
                        <td className={d.td} />
                        <td className={`${d.td} font-body text-xs tabular-nums`}>{money(totals.collected, currency)}</td>
                        <td className={`${d.td} font-display text-sm tabular-nums`}>{money(totals.client - totals.collected, currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Cash flow & deposit ledger */}
            <section className="space-y-3">
              <div>
                <h2 className="font-display text-lg text-foreground">Cash Flow &amp; Deposit Tracking Ledger</h2>
                <p className="font-body text-xs text-muted-foreground">
                  Cleared client cash per project — confirm a deposit invoice is settled before dispatching supplier POs.
                </p>
              </div>

              {ledger.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border py-10 text-center font-body text-sm text-muted-foreground">
                  No invoice lines to track yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {ledger.map((l) => {
                    const finalBalance = l.client - l.depositDue;
                    const depositProgress = l.depositDue > 0 ? Math.min(100, (l.depositPaid / l.depositDue) * 100) : 0;
                    const totalPaid = l.depositPaid;
                    const totalProgress = l.client > 0 ? Math.min(100, (totalPaid / l.client) * 100) : 0;
                    const safeToDispatch = totalPaid >= l.cost;
                    return (
                      <div key={l.quote_id} className="rounded-lg border border-border bg-card p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-display text-sm text-foreground truncate">{l.label}</p>
                            <p className="font-body text-[10px] uppercase tracking-widest text-muted-foreground">{l.quote_ref}</p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px] ${
                              safeToDispatch ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {safeToDispatch ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                            {safeToDispatch ? "Cleared for PO dispatch" : "Insufficient cleared cash"}
                          </span>
                        </div>

                        {/* Invoice 01 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between font-body text-[11px]">
                            <span className="text-foreground">Invoice 01 — Deposit</span>
                            <span className="tabular-nums text-muted-foreground">
                              {money(l.depositPaid, currency)} / {money(l.depositDue, currency)}
                            </span>
                          </div>
                          <Progress value={depositProgress} className="h-1.5" />
                        </div>

                        {/* Invoice 02 */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between font-body text-[11px]">
                            <span className="text-foreground">Invoice 02 — Final Balance</span>
                            <span className="tabular-nums text-muted-foreground">
                              {money(0, currency)} / {money(finalBalance, currency)}
                            </span>
                          </div>
                          <Progress value={0} className="h-1.5" />
                        </div>

                        <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-2 font-body text-[10px] text-muted-foreground">
                          <div>
                            <p className="uppercase tracking-widest">Paid</p>
                            <p className="font-display text-sm tabular-nums text-foreground">{money(totalPaid, currency)}</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-widest">Outstanding</p>
                            <p className="font-display text-sm tabular-nums text-foreground">{money(l.client - totalPaid, currency)}</p>
                          </div>
                          <div>
                            <p className="uppercase tracking-widest">Supplier cost</p>
                            <p className="font-display text-sm tabular-nums text-foreground">{money(l.cost, currency)}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between font-body text-[10px] uppercase tracking-widest text-muted-foreground">
                            <span>Paid vs outstanding</span>
                            <span className="tabular-nums">{totalProgress.toFixed(0)}%</span>
                          </div>
                          <Progress value={totalProgress} className="h-2" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
