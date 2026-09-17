import { Helmet } from "react-helmet-async";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatMoneyIn } from "@/lib/displayMoney";
import { CalendarRange, CircleDollarSign, CreditCard, Flag, Search } from "lucide-react";

/* ------------------------------------------------------------------ */
/* scale + date helpers                                                */
/* ------------------------------------------------------------------ */

type Scale = "week" | "month" | "quarter";

const PX_PER_DAY: Record<Scale, number> = { week: 22, month: 7, quarter: 2.6 };
const SCALE_LABEL: Record<Scale, string> = { week: "Week", month: "Month", quarter: "Quarter" };

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const diffDays = (a: Date, b: Date) => Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY);
const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtDate = (d: Date | null) =>
  !d || isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });

function parseLeadWeeks(text: string | null): number | null {
  if (!text) return null;
  const range = text.match(/(\d+)\s*(?:-|–|—|to)\s*(\d+)/i);
  if (range) return parseInt(range[2], 10);
  const single = text.match(/\d+/);
  return single ? parseInt(single[0], 10) : null;
}

function derivedExpected(tl: any, leadWeeks: number | null, quoteCreatedAt: string | null): Date | null {
  if (tl?.actual_delivery_at) return new Date(tl.actual_delivery_at);
  if (tl?.estimated_delivery_at) return new Date(tl.estimated_delivery_at);
  const anchor = tl?.deposit_paid_at || quoteCreatedAt;
  if (!anchor || leadWeeks == null) return null;
  const d = new Date(anchor);
  d.setDate(d.getDate() + (leadWeeks + (tl?.shipping_weeks || 0)) * 7);
  return d;
}

/** Delivery Tracker colour states, shared so the Gantt reads identically. */
function slackState(slack: number | null): "late" | "tight" | "ontrack" | "unknown" {
  if (slack == null) return "unknown";
  if (slack < 0) return "late";
  if (slack <= 14) return "tight";
  return "ontrack";
}

const BAR_STYLE: Record<string, string> = {
  late: "bg-red-500/85 hover:bg-red-500",
  tight: "bg-amber-500/85 hover:bg-amber-500",
  ontrack: "bg-emerald-600/85 hover:bg-emerald-600",
  unknown: "bg-muted-foreground/40 hover:bg-muted-foreground/60",
};

const STATE_LABEL: Record<string, string> = {
  late: "Late",
  tight: "Tight timeline",
  ontrack: "On track",
  unknown: "Unscheduled",
};

/* ------------------------------------------------------------------ */

interface GanttLine {
  item_id: string;
  product_name: string;
  brand_name: string;
  quantity: number;
  quote_id: string;
  quote_ref: string;
  project_name: string | null;
  client_name: string | null;
  currency: string;
  total_cents: number;
  start: Date | null;
  expected: Date | null;
  requiredBy: Date | null;
  slack: number | null;
  depositAt: Date | null;
  supplierDueAt: Date | null;
  depositCents: number;
  supplierBalanceCents: number;
}

export default function TradeGanttTimeline() {
  const { user } = useAuth();
  const { projectFilter } = useProjectFilter();
  const queryClient = useQueryClient();
  const [scale, setScale] = useState<Scale>("month");
  const [search, setSearch] = useState("");
  /** item_id → day offset currently being dragged (not yet committed). */
  const [dragShift, setDragShift] = useState<{ id: string; days: number } | null>(null);
  const dragRef = useRef<{ id: string; startX: number; line: GanttLine } | null>(null);

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["gantt-timeline", user?.id, projectFilter],
    queryFn: async (): Promise<GanttLine[]> => {
      let qq = supabase
        .from("trade_quotes")
        .select("id, client_name, status, project_id, created_at, currency")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "submitted", "responded", "priced", "deposit_paid", "paid"]);
      if (projectFilter) qq = qq.eq("project_id", projectFilter);
      const { data: quotes } = await qq;
      if (!quotes?.length) return [];
      const quoteIds = quotes.map((q) => q.id);

      const [{ data: qItems }, { data: timelines }] = await Promise.all([
        supabase
          .from("trade_quote_items")
          .select(
            "id, product_id, quantity, quote_id, unit_price_cents, required_by_date, lead_time_weeks_override, fabrication_start_date, expected_ready_override, po_due_date, po_balance_due_date, po_deposit_paid_at, deposit_pct_override",
          )
          .in("quote_id", quoteIds),
        supabase
          .from("order_timeline" as any)
          .select("quote_id, deposit_paid_at, shipping_weeks, estimated_delivery_at, actual_delivery_at")
          .in("quote_id", quoteIds),
      ]);
      if (!qItems?.length) return [];

      const productIds = [...new Set(qItems.map((i: any) => i.product_id))];
      const { data: products } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, lead_time")
        .in("id", productIds);

      const projectIds = [...new Set(quotes.map((q: any) => q.project_id).filter(Boolean))] as string[];
      const { data: projects } = projectIds.length
        ? await supabase.from("projects" as any).select("id, name").in("id", projectIds)
        : { data: [] as any[] };

      const productMap = Object.fromEntries((products || []).map((p: any) => [p.id, p]));
      const quoteMap = Object.fromEntries(quotes.map((q: any) => [q.id, q]));
      const projectMap = Object.fromEntries(((projects as any[]) || []).map((p: any) => [p.id, p.name]));
      const timelineMap = Object.fromEntries(((timelines as any[]) || []).map((t: any) => [t.quote_id, t]));

      return (qItems as any[]).map((it) => {
        const p: any = productMap[it.product_id];
        const q: any = quoteMap[it.quote_id];
        const tl = timelineMap[it.quote_id];
        const leadWeeks = it.lead_time_weeks_override ?? parseLeadWeeks(p?.lead_time || null);
        const expected = it.expected_ready_override
          ? new Date(it.expected_ready_override)
          : derivedExpected(tl, leadWeeks, q?.created_at || null);
        const start = it.fabrication_start_date
          ? new Date(it.fabrication_start_date)
          : expected
            ? addDays(expected, -((leadWeeks ?? 8) * 7))
            : null;
        const requiredBy = it.required_by_date ? new Date(it.required_by_date) : null;
        const slack = expected && requiredBy ? diffDays(requiredBy, expected) : null;
        const total = (it.unit_price_cents || 0) * (it.quantity || 1);
        const depositPct = it.deposit_pct_override ?? 0.5;
        return {
          item_id: it.id,
          product_name: p?.product_name || "Unknown item",
          brand_name: p?.brand_name || "",
          quantity: it.quantity || 1,
          quote_id: it.quote_id,
          quote_ref: `QU-${it.quote_id.slice(0, 6).toUpperCase()}`,
          project_name: q?.project_id ? projectMap[q.project_id] || null : null,
          client_name: q?.client_name || null,
          currency: q?.currency || "EUR",
          total_cents: total,
          start,
          expected,
          requiredBy,
          slack,
          depositAt: it.po_deposit_paid_at
            ? new Date(it.po_deposit_paid_at)
            : tl?.deposit_paid_at
              ? new Date(tl.deposit_paid_at)
              : q?.created_at
                ? new Date(q.created_at)
                : null,
          supplierDueAt: it.po_balance_due_date
            ? new Date(it.po_balance_due_date)
            : it.po_due_date
              ? new Date(it.po_due_date)
              : expected,
          depositCents: Math.round(total * depositPct),
          supplierBalanceCents: total - Math.round(total * depositPct),
        } as GanttLine;
      });
    },
    enabled: !!user,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = lines.filter((l) => l.start && l.expected);
    if (!q) return base;
    return base.filter((l) =>
      [l.product_name, l.brand_name, l.project_name, l.client_name, l.quote_ref].some((v) =>
        (v || "").toLowerCase().includes(q),
      ),
    );
  }, [lines, search]);

  /* timeline domain ------------------------------------------------- */
  const domain = useMemo(() => {
    const all: Date[] = [];
    filtered.forEach((l) => {
      [l.start, l.expected, l.requiredBy, l.depositAt, l.supplierDueAt].forEach((d) => d && all.push(d));
    });
    if (!all.length) {
      const today = startOfDay(new Date());
      return { from: addDays(today, -30), to: addDays(today, 120) };
    }
    const min = new Date(Math.min(...all.map((d) => d.getTime())));
    const max = new Date(Math.max(...all.map((d) => d.getTime())));
    return { from: addDays(startOfDay(min), -10), to: addDays(startOfDay(max), 20) };
  }, [filtered]);

  const pxDay = PX_PER_DAY[scale];
  const totalDays = Math.max(1, diffDays(domain.to, domain.from));
  const gridWidth = totalDays * pxDay;
  const xOf = (d: Date) => diffDays(d, domain.from) * pxDay;

  const ticks = useMemo(() => {
    const out: { x: number; label: string; major: boolean }[] = [];
    const cursor = new Date(domain.from);
    if (scale === "week") {
      cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
      while (cursor <= domain.to) {
        out.push({
          x: xOf(cursor),
          label: cursor.toLocaleDateString(undefined, { day: "2-digit", month: "short" }),
          major: cursor.getDate() <= 7,
        });
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      const step = scale === "month" ? 1 : 3;
      cursor.setDate(1);
      while (cursor <= domain.to) {
        out.push({
          x: xOf(cursor),
          label:
            scale === "month"
              ? cursor.toLocaleDateString(undefined, { month: "short", year: "2-digit" })
              : `Q${Math.floor(cursor.getMonth() / 3) + 1} ${String(cursor.getFullYear()).slice(2)}`,
          major: cursor.getMonth() % 3 === 0,
        });
        cursor.setMonth(cursor.getMonth() + step);
      }
    }
    return out;
  }, [domain, scale]);

  const todayX = xOf(startOfDay(new Date()));

  /* drag ------------------------------------------------------------ */
  useEffect(() => {
    if (!dragRef.current) return;
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      setDragShift({ id: d.id, days: Math.round((e.clientX - d.startX) / pxDay) });
    };
    const onUp = async (e: MouseEvent) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDragShift(null);
      if (!d) return;
      const days = Math.round((e.clientX - d.startX) / pxDay);
      if (!days) return;
      const line = d.line;
      const nextExpected = addDays(line.expected!, days);
      const nextStart = line.start ? addDays(line.start, days) : null;
      const { error } = await supabase
        .from("trade_quote_items")
        .update({
          expected_ready_override: isoDate(nextExpected),
          ...(nextStart ? { fabrication_start_date: isoDate(nextStart) } : {}),
        } as never)
        .eq("id", line.item_id);
      if (error) {
        toast({ title: "Could not move the schedule", description: error.message, variant: "destructive" });
        return;
      }
      const newSlack = line.requiredBy ? diffDays(line.requiredBy, nextExpected) : null;
      toast({
        title: `${line.product_name} rescheduled`,
        description: `Expected ready ${fmtDate(nextExpected)}${
          newSlack != null
            ? newSlack < 0
              ? ` — now ${Math.abs(newSlack)} days past the required date`
              : ` — ${newSlack} days of slack`
            : ""
        }`,
      });
      // Cascade: delivery table, FF&E schedule, cash-flow chart, PO logs.
      ["gantt-timeline", "delivery-tracker", "ffe-schedule", "budget-cashflow", "po-logs"].forEach((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      );
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragShift, pxDay, queryClient]);

  const beginDrag = (e: React.MouseEvent, line: GanttLine) => {
    e.preventDefault();
    dragRef.current = { id: line.item_id, startX: e.clientX, line };
    setDragShift({ id: line.item_id, days: 0 });
  };

  const shiftFor = (id: string) => (dragShift?.id === id ? dragShift.days : 0);

  const currency = filtered[0]?.currency || "EUR";
  const counts = useMemo(
    () => ({
      late: filtered.filter((l) => slackState(l.slack) === "late").length,
      tight: filtered.filter((l) => slackState(l.slack) === "tight").length,
      ontrack: filtered.filter((l) => slackState(l.slack) === "ontrack").length,
    }),
    [filtered],
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1800px] px-3 py-6 sm:px-5 lg:w-[94%] lg:px-6">
      <Helmet>
        <title>Project Timeline | Maison Affluency</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <TradeBreadcrumb />

      <header className="mb-5">
        <h1 className="font-display text-2xl text-foreground">Gantt Chart &amp; Project Timeline</h1>
        <p className="mt-1 font-body text-sm text-muted-foreground">
          Fabrication and delivery windows tracked against the cash milestones that fund them. Drag any bar to
          reschedule — every linked tool updates instantly.
        </p>
      </header>

      {/* toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item, brand, project…"
            className="h-9 pl-8 font-body text-xs"
          />
        </div>
        <div className="inline-flex overflow-hidden rounded-md border border-border">
          {(Object.keys(SCALE_LABEL) as Scale[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={cn(
                "px-3 py-1.5 font-body text-[11px] uppercase tracking-[0.12em] transition-all duration-200",
                scale === s ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-accent/40",
              )}
            >
              {SCALE_LABEL[s]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 font-body text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-red-500/85" />Overdue {counts.late}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-amber-500/85" />Tight {counts.tight}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-sm bg-emerald-600/85" />Comfortable {counts.ontrack}</span>
          <span className="inline-flex items-center gap-1.5"><CircleDollarSign className="h-3.5 w-3.5 text-emerald-600" />Client deposit</span>
          <span className="inline-flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-red-500" />Supplier payment</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><DotCircleLoader /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/20 px-6 py-16 text-center">
          <CalendarRange className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
          <p className="font-body text-sm text-muted-foreground">
            No scheduled items yet. Lines appear here once a confirmed quote has lead times or delivery dates.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          <div className="flex min-w-0">
            {/* sticky item column */}
            <div className="w-[240px] shrink-0 border-r border-border bg-muted/30">
              <div className="h-10 border-b border-border px-3 py-2 font-body text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Line item
              </div>
              {filtered.map((l) => (
                <div key={l.item_id} className="h-[58px] border-b border-border/70 px-3 py-2">
                  <p className="truncate font-body text-xs font-medium text-foreground">{l.product_name}</p>
                  <p className="truncate font-body text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    {l.brand_name || l.quote_ref}
                  </p>
                </div>
              ))}
            </div>

            {/* scrollable grid */}
            <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
              <div style={{ width: gridWidth }} className="relative">
                {/* header ticks */}
                <div className="relative h-10 border-b border-border bg-muted/30">
                  {ticks.map((t, i) => (
                    <div
                      key={i}
                      className={cn(
                        "absolute top-0 h-full border-l pl-1.5 pt-2 font-body text-[10px] tabular-nums",
                        t.major ? "border-border text-foreground" : "border-border/50 text-muted-foreground",
                      )}
                      style={{ left: t.x }}
                    >
                      {t.label}
                    </div>
                  ))}
                </div>

                {/* today marker */}
                {todayX >= 0 && todayX <= gridWidth && (
                  <div
                    className="pointer-events-none absolute bottom-0 top-10 z-20 w-px bg-primary/60"
                    style={{ left: todayX }}
                  />
                )}

                {filtered.map((l) => {
                  const shift = shiftFor(l.item_id);
                  const start = addDays(l.start!, shift);
                  const expected = addDays(l.expected!, shift);
                  const slack = l.requiredBy ? diffDays(l.requiredBy, expected) : null;
                  const state = slackState(slack);
                  const left = xOf(start);
                  const width = Math.max(pxDay * 2, xOf(expected) - left);
                  return (
                    <div key={l.item_id} className="relative h-[58px] border-b border-border/70">
                      {/* faint period gridlines */}
                      {ticks.map((t, i) => (
                        <div
                          key={i}
                          className={cn("absolute inset-y-0 w-px", t.major ? "bg-border/60" : "bg-border/25")}
                          style={{ left: t.x }}
                        />
                      ))}

                      {/* channel 1 — logistics bar */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            role="button"
                            tabIndex={0}
                            onMouseDown={(e) => beginDrag(e, l)}
                            className={cn(
                              "absolute top-2 z-10 h-5 cursor-grab select-none rounded-[3px] shadow-sm transition-colors active:cursor-grabbing",
                              BAR_STYLE[state],
                              shift !== 0 && "ring-2 ring-primary/60",
                            )}
                            style={{ left, width }}
                            aria-label={`${l.product_name} fabrication window`}
                          >
                            <span className="pointer-events-none block truncate px-1.5 py-0.5 font-body text-[10px] text-white">
                              {width > 90 ? `${fmtDate(start)} → ${fmtDate(expected)}` : ""}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[18rem]">
                          <p className="font-body text-xs font-medium">{l.product_name}</p>
                          <p className="font-body text-[10px] text-muted-foreground">
                            Fabrication {fmtDate(start)} → expected ready {fmtDate(expected)}
                          </p>
                          <p className="font-body text-[10px] text-muted-foreground">
                            Required by {fmtDate(l.requiredBy)} · {STATE_LABEL[state]}
                            {slack != null ? ` (${slack}d)` : ""}
                          </p>
                          <p className="mt-1 font-body text-[10px] text-muted-foreground">Drag to reschedule</p>
                        </TooltipContent>
                      </Tooltip>

                      {/* required-by flag */}
                      {l.requiredBy && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0}
                              className="absolute top-1.5 z-10 -ml-1.5 text-foreground/70"
                              style={{ left: xOf(l.requiredBy) }}
                            >
                              <Flag className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="font-body text-[11px]">Required by {fmtDate(l.requiredBy)}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {/* channel 2 — financial overlay */}
                      {l.depositAt && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0}
                              className="absolute bottom-2 z-10 -ml-2 rounded-full bg-emerald-500/15 p-0.5 text-emerald-600"
                              style={{ left: xOf(l.depositAt) }}
                            >
                              <CircleDollarSign className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="font-body text-[11px]">
                              Client deposit clears {fmtDate(l.depositAt)} — {formatMoneyIn(l.depositCents, l.currency)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {l.supplierDueAt && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span
                              tabIndex={0}
                              className="absolute bottom-2 z-10 -ml-2 rounded-full bg-red-500/15 p-0.5 text-red-500"
                              style={{ left: xOf(addDays(l.supplierDueAt, shift)) }}
                            >
                              <CreditCard className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="font-body text-[11px]">
                              Supplier balance due {fmtDate(addDays(l.supplierDueAt, shift))} —{" "}
                              {formatMoneyIn(l.supplierBalanceCents, l.currency)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/20 px-4 py-2 font-body text-[11px] text-muted-foreground">
            <span>{filtered.length} scheduled line items</span>
            <span>
              Committed value on this timeline:{" "}
              {formatMoneyIn(filtered.reduce((s, l) => s + l.total_cents, 0), currency)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
