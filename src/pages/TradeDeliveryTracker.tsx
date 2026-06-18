import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "react-router-dom";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import TradeBreadcrumb from "@/components/trade/TradeBreadcrumb";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useMemo } from "react";

const STAGE_LABEL: Record<string, string> = {
  not_started: "Not started",
  deposit_pending: "Deposit pending",
  in_production: "In production",
  ready_to_ship: "Ready to ship",
  in_transit: "In transit",
  customs: "Customs",
  delivered: "Delivered",
};

function parseLeadWeeks(text: string | null): number | null {
  if (!text) return null;
  const range = text.match(/(\d+)\s*(?:-|–|—|to)\s*(\d+)/i);
  if (range) return parseInt(range[2], 10);
  const single = text.match(/\d+/);
  return single ? parseInt(single[0], 10) : null;
}

function expectedReady(tl: any, leadWeeks: number | null, quoteCreatedAt: string | null): Date | null {
  if (tl?.actual_delivery_at) return new Date(tl.actual_delivery_at);
  if (tl?.estimated_delivery_at) return new Date(tl.estimated_delivery_at);
  const anchor = tl?.deposit_paid_at || quoteCreatedAt;
  if (!anchor || leadWeeks == null) return null;
  const d = new Date(anchor);
  d.setDate(d.getDate() + (leadWeeks + (tl?.shipping_weeks || 0)) * 7);
  return d;
}

function fmtDate(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "2-digit" });
}

function slackBadge(slackDays: number | null) {
  if (slackDays == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (slackDays < 0)
    return <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[10px] font-medium tabular-nums">{slackDays}d late</span>;
  if (slackDays <= 14)
    return <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-medium tabular-nums">{slackDays}d slack</span>;
  return <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-medium tabular-nums">{slackDays}d slack</span>;
}

interface Line {
  item_id: string;
  product_name: string;
  brand_name: string;
  quantity: number;
  quote_id: string;
  quote_ref: string;
  project_id: string | null;
  project_name: string | null;
  client_name: string | null;
  required_by_date: string | null;
  stage: string | null;
  expected: Date | null;
  slack: number | null;
}

export default function TradeDeliveryTracker() {
  const { user } = useAuth();

  const { data: lines = [], isLoading } = useQuery({
    queryKey: ["delivery-tracker", user?.id],
    queryFn: async (): Promise<Line[]> => {
      const { data: quotes } = await supabase
        .from("trade_quotes")
        .select("id, client_name, status, project_id, created_at")
        .eq("user_id", user!.id)
        .in("status", ["confirmed", "submitted", "responded", "priced", "deposit_paid", "paid"]);
      if (!quotes?.length) return [];
      const quoteIds = quotes.map((q) => q.id);

      const [{ data: qItems }, { data: timelines }] = await Promise.all([
        supabase
          .from("trade_quote_items")
          .select("id, product_id, quantity, quote_id, lead_time_weeks_override, required_by_date")
          .in("quote_id", quoteIds),
        supabase
          .from("order_timeline" as any)
          .select("quote_id, kanban_status, deposit_paid_at, shipping_weeks, estimated_delivery_at, actual_delivery_at")
          .in("quote_id", quoteIds),
      ]);

      if (!qItems?.length) return [];

      const productIds = [...new Set(qItems.map((i) => i.product_id))];
      const { data: products } = await supabase
        .from("trade_products")
        .select("id, product_name, brand_name, lead_time")
        .in("id", productIds);

      const projectIds = [...new Set(quotes.map((q: any) => q.project_id).filter(Boolean))] as string[];
      const { data: projects } = projectIds.length
        ? await supabase.from("projects" as any).select("id, name").in("id", projectIds)
        : { data: [] as any[] };

      const productMap = Object.fromEntries((products || []).map((p) => [p.id, p]));
      const quoteMap = Object.fromEntries(quotes.map((q) => [q.id, q]));
      const projectMap = Object.fromEntries(((projects as any[]) || []).map((p: any) => [p.id, p.name]));
      const timelineMap = Object.fromEntries(((timelines as any[]) || []).map((t: any) => [t.quote_id, t]));

      return qItems.map((it: any) => {
        const p: any = productMap[it.product_id];
        const q: any = quoteMap[it.quote_id];
        const tl = timelineMap[it.quote_id];
        const lead = it.lead_time_weeks_override ?? parseLeadWeeks(p?.lead_time || null);
        const expected = expectedReady(tl, lead, q?.created_at || null);
        const requiredBy = it.required_by_date ? new Date(it.required_by_date) : null;
        const slack = expected && requiredBy
          ? Math.round((requiredBy.getTime() - expected.getTime()) / 86400000)
          : null;
        return {
          item_id: it.id,
          product_name: p?.product_name || "Unknown",
          brand_name: p?.brand_name || "",
          quantity: it.quantity,
          quote_id: it.quote_id,
          quote_ref: `QU-${it.quote_id.slice(0, 6).toUpperCase()}`,
          project_id: q?.project_id || null,
          project_name: q?.project_id ? projectMap[q.project_id] || null : null,
          client_name: q?.client_name || null,
          required_by_date: it.required_by_date || null,
          stage: tl?.kanban_status || null,
          expected,
          slack,
        };
      });
    },
    enabled: !!user,
  });

  const groups = useMemo(() => {
    const m = new Map<string, { id: string | null; name: string; lines: Line[] }>();
    for (const l of lines) {
      const key = l.project_id || "__none__";
      const name = l.project_name || "Unassigned";
      if (!m.has(key)) m.set(key, { id: l.project_id, name, lines: [] });
      m.get(key)!.lines.push(l);
    }
    return Array.from(m.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [lines]);

  return (
    <>
      <Helmet><title>Delivery Tracker — Trade Portal</title></Helmet>
      <div className="max-w-6xl space-y-6">
        <TradeBreadcrumb current="Delivery tracker" />
        <div>
          <h1 className="font-display text-2xl text-foreground">Delivery Tracker</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Each line's order stage, expected ready date and slack against the deadline you set on the FF&E Schedule.
            Red = late, amber = ≤2 weeks of slack, green = comfortable.
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><DotCircleLoader size="sm" className="text-muted-foreground" /></div>
        ) : groups.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-lg">
            <CalendarClock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-body text-sm text-muted-foreground">No confirmed lines yet.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {groups.map((g) => {
              const worst = g.lines.reduce<number | null>((acc, l) => {
                if (l.slack == null) return acc;
                return acc == null || l.slack < acc ? l.slack : acc;
              }, null);
              const lateCount = g.lines.filter((l) => l.slack != null && l.slack < 0).length;
              const tightCount = g.lines.filter((l) => l.slack != null && l.slack >= 0 && l.slack <= 14).length;
              return (
                <section key={g.id || g.name} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {g.id ? (
                        <Link to={`/trade/projects/${g.id}`} className="font-display text-base text-foreground underline underline-offset-2 inline-flex items-center gap-1">
                          {g.name} <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="font-display text-base text-foreground">{g.name}</span>
                      )}
                      <span className="font-body text-[11px] text-muted-foreground">· {g.lines.length} line{g.lines.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {lateCount > 0 && <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[10px] font-medium">{lateCount} late</span>}
                      {tightCount > 0 && <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-medium">{tightCount} tight</span>}
                      {worst != null && slackBadge(worst)}
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {["Item", "Brand", "Qty", "Client", "Stage", "Expected ready", "Required by", "Slack", "Quote"].map((h) => (
                            <th key={h} className="px-4 py-2 font-body text-[10px] uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {g.lines
                          .slice()
                          .sort((a, b) => {
                            const ar = a.required_by_date || "9999-12-31";
                            const br = b.required_by_date || "9999-12-31";
                            return ar.localeCompare(br);
                          })
                          .map((l) => (
                            <tr key={l.item_id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                              <td className="px-4 py-2 font-body text-sm text-foreground">{l.product_name}</td>
                              <td className="px-4 py-2 font-body text-sm text-muted-foreground">{l.brand_name}</td>
                              <td className="px-4 py-2 font-body text-sm text-foreground tabular-nums">{l.quantity}</td>
                              <td className="px-4 py-2 font-body text-xs text-muted-foreground">{l.client_name || "—"}</td>
                              <td className="px-4 py-2 font-body text-xs text-muted-foreground whitespace-nowrap">{STAGE_LABEL[l.stage || ""] || (l.stage || "—")}</td>
                              <td className="px-4 py-2 font-body text-xs text-muted-foreground whitespace-nowrap tabular-nums">{fmtDate(l.expected)}</td>
                              <td className="px-4 py-2 font-body text-xs text-muted-foreground whitespace-nowrap tabular-nums">{l.required_by_date ? fmtDate(new Date(l.required_by_date)) : <Link to="/trade/ffe-schedule" className="italic underline underline-offset-2">set on FF&E</Link>}</td>
                              <td className="px-4 py-2 font-body text-xs whitespace-nowrap">{slackBadge(l.slack)}</td>
                              <td className="px-4 py-2 font-body text-xs">
                                <Link to={`/trade/quotes?id=${l.quote_id}`} className="text-foreground underline underline-offset-2 tabular-nums">
                                  {l.quote_ref}
                                </Link>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
