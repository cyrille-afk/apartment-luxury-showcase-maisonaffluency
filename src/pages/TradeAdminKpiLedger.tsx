/**
 * Acquisition KPI Ledger — admin analytics across Instagram, LinkedIn and Email outreach.
 * Source of truth: acquisition_outreach_events (one row per send, hook + agent attributed).
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Instagram, Linkedin, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Range = "1" | "7" | "30" | "all";
const RANGES: Record<Range, string> = { "1": "Today (Last 24 Hours)", "7": "7 Days", "30": "30 Days", all: "All-Time" };
const ACQ_TEMPLATES = ["acquisition-trade-invitation", "trade-program-invitation"];

const since = (r: Range) => (r === "all" ? null : new Date(Date.now() - Number(r) * 86400000).toISOString());
const inRange = (iso: string | null | undefined, from: string | null) => !!iso && (!from || iso >= from);
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

const useLedger = (range: Range, enabled: boolean) =>
  useQuery({
    queryKey: ["kpi-ledger", range],
    enabled,
    queryFn: async () => {
      const from = since(range);
      const ev = supabase.from("acquisition_outreach_events").select("lead_id, channel, hook, agent_id, created_at").limit(10000);
      const clicks = supabase.from("email_click_log").select("recipient_email, clicked_at").in("template_name", ACQ_TEMPLATES).limit(10000);
      const invites = supabase.from("board_invites").select("id", { count: "exact", head: true });
      const apps = supabase.from("trade_applications").select("reviewed_by, reviewed_at, status").eq("status", "approved");
      if (from) { ev.gte("created_at", from); clicks.gte("clicked_at", from); invites.gte("created_at", from); apps.gte("reviewed_at", from); }
      const [e, c, i, a, l] = await Promise.all([
        ev, clicks, invites, apps,
        supabase.from("acquisition_leads").select("id, reply_received_at, reply_intent, portal_activated_at").limit(10000),
      ]);
      const err = e.error || c.error || i.error || a.error || l.error;
      if (err) throw err;
      const agentIds = [...new Set([...(e.data ?? []).map((x) => x.agent_id), ...(a.data ?? []).map((x) => x.reviewed_by)].filter(Boolean))] as string[];
      const { data: profiles } = agentIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name, email").in("id", agentIds)
        : { data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] };
      return { from, events: e.data ?? [], clicks: c.data ?? [], viral: i.count ?? 0, apps: a.data ?? [], leads: l.data ?? [], profiles: profiles ?? [] };
    },
  });

const Metric = ({ label, value, hint }: { label: string; value: string | number; hint?: string }) => (
  <div className="border border-border bg-card px-4 py-3">
    <p className="font-body text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className="mt-1 font-display text-2xl tabular-nums text-foreground">{value}</p>
    {hint && <p className="mt-0.5 font-body text-[10px] text-muted-foreground">{hint}</p>}
  </div>
);

const Row = ({ k, v, muted }: { k: string; v: string | number; muted?: boolean }) => (
  <div className="flex items-baseline justify-between border-t border-border py-1.5 first:border-t-0">
    <span className="font-body text-xs text-muted-foreground">{k}</span>
    <span className={`font-body text-sm tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`} title={muted ? "Not tracked yet" : undefined}>{v}</span>
  </div>
);

export default function TradeAdminKpiLedger() {
  const { user, isAdmin, loading } = useAuth();
  const [range, setRange] = useState<Range>("30");
  const { data, isLoading, error } = useLedger(range, !!user && isAdmin);

  const k = useMemo(() => {
    if (!data) return null;
    const { from, events, leads, apps, clicks } = data;
    const leadMap = new Map(leads.map((l) => [l.id, l]));
    const converted = (id: string | null) => {
      const l = id ? leadMap.get(id) : undefined;
      return !!l && (!!l.portal_activated_at || l.reply_intent === "positive");
    };
    const leadConv = leads.filter((l) => inRange(l.portal_activated_at, from) || (l.reply_intent === "positive" && inRange(l.reply_received_at, from))).length;
    const conversions = leadConv + apps.length;
    const by = (ch: string) => events.filter((e) => e.channel === ch);
    const ig = by("instagram"), li = by("linkedin"), em = by("email");
    const replied = (list: typeof events) => new Set(list.filter((e) => e.lead_id && leadMap.get(e.lead_id)?.reply_received_at).map((e) => e.lead_id)).size;
    const hook = (h: "A" | "B") => {
      const ids = new Set(events.filter((e) => e.hook === h).map((e) => e.lead_id));
      const conv = [...ids].filter(converted).length;
      return { sent: ids.size, conv, rate: ids.size ? conv / ids.size : 0 };
    };
    const name = (id: string | null) => {
      if (!id) return "Unattributed (pre-ledger)";
      const p = data.profiles.find((x) => x.id === id);
      return p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Agent" : "Agent";
    };
    const agents = new Map<string, { name: string; ig: number; li: number; em: number; demos: Set<string>; ids: number }>();
    const get = (id: string | null) => {
      const key = id ?? "none";
      if (!agents.has(key)) agents.set(key, { name: name(id), ig: 0, li: 0, em: 0, demos: new Set(), ids: 0 });
      return agents.get(key)!;
    };
    for (const e of events) {
      const a = get(e.agent_id);
      if (e.channel === "instagram") a.ig++; else if (e.channel === "linkedin") a.li++; else a.em++;
      if (e.lead_id && leadMap.get(e.lead_id)?.reply_intent === "positive") a.demos.add(e.lead_id);
    }
    for (const ap of apps) if (ap.reviewed_by) get(ap.reviewed_by).ids++;
    return {
      outbound: events.length, conversions, rate: pct(conversions, events.length),
      ig: { sent: ig.length, replies: replied(ig) },
      li: { sent: li.length, replies: replied(li) },
      em: { sent: em.length, replies: replied(em), clicks: clicks.length },
      A: hook("A"), B: hook("B"),
      agents: [...agents.values()].sort((x, y) => y.ig + y.li + y.em - (x.ig + x.li + x.em)),
    };
  }, [data]);

  if (!loading && (!user || !isAdmin)) return <Navigate to="/trade" replace />;

  const maxRate = Math.max(k?.A.rate ?? 0, k?.B.rate ?? 0, 0.0001);

  return (
    <div className="w-full px-4 py-6 lg:px-6">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Admin · Growth</p>
          <h1 className="font-display text-2xl text-foreground">Acquisition KPI Ledger</h1>
        </div>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="h-9 w-[210px] rounded-none text-xs" aria-label="Timeframe"><SelectValue /></SelectTrigger>
          <SelectContent>{(Object.keys(RANGES) as Range[]).map((r) => <SelectItem key={r} value={r} className="text-xs">{RANGES[r]}</SelectItem>)}</SelectContent>
        </Select>
      </header>

      {error && <p className="mb-4 font-body text-sm text-destructive">Could not load the ledger.</p>}
      {isLoading || !k ? (
        <p className="font-body text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Total Multi-Channel Outbound" value={k.outbound} hint="Instagram + LinkedIn + Email sends" />
            <Metric label="Total Conversions" value={k.conversions} hint="Demo requests + verified trade IDs" />
            <Metric label="Master Conversion Rate" value={k.rate} hint="Conversions ÷ outbound" />
            <Metric label="Active Viral Nodes" value={data!.viral} hint="Client / contractor invites sent" />
          </section>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              { icon: Instagram, title: "Instagram Studio Hub", rows: [["DMs sent", k.ig.sent], ["Profile click-through", "—", true], ["Responses", k.ig.replies]] },
              { icon: Linkedin, title: "LinkedIn Executive Desk", rows: [["Pitches sent", k.li.sent], ["Connection acceptance", "—", true], ["Warm responses", k.li.replies]] },
              { icon: Mail, title: "Direct Procurement Email", rows: [["Emails sent", k.em.sent], ["Open rate", "—", true], ["Signup link clicks", k.em.clicks]] },
            ].map(({ icon: Icon, title, rows }) => (
              <div key={title} className="border border-border bg-card px-4 py-3">
                <div className="mb-2 flex items-center gap-2"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><h2 className="font-body text-[11px] uppercase tracking-[0.16em] text-foreground">{title}</h2></div>
                {rows.map(([a, b, m]) => <Row key={a as string} k={a as string} v={b as string | number} muted={!!m} />)}
              </div>
            ))}
          </section>

          <section className="border border-border bg-card px-4 py-3">
            <h2 className="mb-3 font-body text-[11px] uppercase tracking-[0.16em] text-foreground">Hook Angle Effectiveness</h2>
            {([["A", "Tab A · AI Sourcing Hook", k.A], ["B", "Tab B · White-Label Collaboration Hook", k.B]] as const).map(([key, label, h]) => (
              <div key={key} className="mb-3 last:mb-0">
                <div className="mb-1 flex items-baseline justify-between font-body text-xs">
                  <span className="text-foreground">{label}{h.sent > 0 && h.rate === maxRate && (k.A.sent + k.B.sent) > 0 && <span className="ml-2 text-[10px] uppercase tracking-wider text-primary">Leading</span>}</span>
                  <span className="tabular-nums text-muted-foreground">{h.conv}/{h.sent} studios · {pct(h.conv, h.sent)}</span>
                </div>
                <div className="h-1.5 w-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${(h.rate / maxRate) * 100}%` }} /></div>
              </div>
            ))}
          </section>

          <section className="border border-border bg-card">
            <h2 className="px-4 pt-3 font-body text-[11px] uppercase tracking-[0.16em] text-foreground">Account Executive Leaderboard</h2>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full font-body text-xs">
                <thead><tr className="border-y border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  {["Sales Agent", "Instagram", "LinkedIn", "Email", "Demo Bookings", "Verified Trade IDs"].map((h, i) => <th key={h} className={`px-4 py-1.5 font-normal ${i ? "text-right" : ""}`}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {k.agents.length === 0 && <tr><td colSpan={6} className="px-4 py-3 text-muted-foreground">No activity in this timeframe.</td></tr>}
                  {k.agents.map((a) => (
                    <tr key={a.name} className="border-b border-border last:border-0">
                      <td className="px-4 py-1.5 text-foreground">{a.name}</td>
                      {[a.ig, a.li, a.em, a.demos.size, a.ids].map((n, i) => <td key={i} className="px-4 py-1.5 text-right tabular-nums">{n}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
