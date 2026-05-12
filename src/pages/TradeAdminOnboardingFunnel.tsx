import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Navigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { ArrowLeft, BarChart3, Smartphone, Monitor, Tablet, Globe, X, ExternalLink } from "lucide-react";

type EventType = "tour_step_view" | "tour_substep_click" | "tour_complete" | "tour_skip";
type DeviceFilter = "all" | "desktop" | "mobile" | "tablet";

interface TourEvent {
  id: string;
  event_type: EventType;
  user_id: string | null;
  step_id: string | null;
  step_index: number | null;
  total_steps: number | null;
  sub_step_id: string | null;
  sub_step_label: string | null;
  target_path: string | null;
  device_type: string | null;
  platform: string | null;
  viewport: string | null;
  pwa_standalone: boolean | null;
  language: string | null;
  page_path: string | null;
  referrer_host: string | null;
  created_at: string;
}

const RANGES = [
  { id: "7", label: "Last 7 days", days: 7 },
  { id: "30", label: "Last 30 days", days: 30 },
  { id: "90", label: "Last 90 days", days: 90 },
  { id: "all", label: "All time", days: 3650 },
] as const;

type Drill =
  | { kind: "step"; step_id: string }
  | { kind: "substep"; step_id: string; sub_step_id: string; label: string }
  | { kind: "type"; event_type: EventType }
  | { kind: "window"; from: number; label: string }
  | null;

interface ProfileLite { id: string; email: string | null; first_name: string | null; last_name: string | null; company: string | null; }

const TradeAdminOnboardingFunnel = () => {
  const { isAdmin, loading: authLoading } = useAuth();
  const [events, setEvents] = useState<TourEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("30");
  const [device, setDevice] = useState<DeviceFilter>("all");
  const [drill, setDrill] = useState<Drill>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const days = RANGES.find((r) => r.id === range)!.days;
      const since = new Date(Date.now() - days * 86400_000).toISOString();
      const { data, error } = await supabase
        .from("tour_events")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(10000);
      if (cancelled) return;
      if (!error && data) setEvents(data as unknown as TourEvent[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, range]);

  const filtered = useMemo(
    () => (device === "all" ? events : events.filter((e) => e.device_type === device)),
    [events, device]
  );

  const counts = useMemo(() => {
    const c: Record<EventType, number> = {
      tour_step_view: 0, tour_substep_click: 0, tour_complete: 0, tour_skip: 0,
    };
    for (const e of filtered) c[e.event_type] = (c[e.event_type] || 0) + 1;
    return c;
  }, [filtered]);

  const uniqueUsers = useMemo(() => {
    const s = new Set<string>();
    for (const e of filtered) if (e.user_id) s.add(e.user_id);
    return s.size;
  }, [filtered]);

  const stepFunnel = useMemo(() => {
    // Unique-user reach per step_id, sorted by step_index
    const map = new Map<string, { step_id: string; step_index: number; users: Set<string> }>();
    for (const e of filtered) {
      if (e.event_type !== "tour_step_view" || !e.step_id) continue;
      const key = e.step_id;
      if (!map.has(key)) {
        map.set(key, { step_id: e.step_id, step_index: e.step_index ?? 999, users: new Set() });
      }
      const row = map.get(key)!;
      if (e.user_id) row.users.add(e.user_id);
    }
    const rows = Array.from(map.values()).map((r) => ({
      step_id: r.step_id,
      step_index: r.step_index,
      unique_users: r.users.size,
    }));
    rows.sort((a, b) => a.step_index - b.step_index);
    const top = rows[0]?.unique_users || 0;
    return rows.map((r) => ({ ...r, pct: top ? Math.round((r.unique_users / top) * 100) : 0 }));
  }, [filtered]);

  const subStepBreakdown = useMemo(() => {
    const map = new Map<string, { label: string; clicks: number; users: Set<string> }>();
    for (const e of filtered) {
      if (e.event_type !== "tour_substep_click" || !e.sub_step_id) continue;
      const key = `${e.step_id ?? "?"} → ${e.sub_step_label ?? e.sub_step_id}`;
      if (!map.has(key)) map.set(key, { label: key, clicks: 0, users: new Set() });
      const row = map.get(key)!;
      row.clicks++;
      if (e.user_id) row.users.add(e.user_id);
    }
    return Array.from(map.values())
      .map((r) => ({ label: r.label, clicks: r.clicks, unique_users: r.users.size }))
      .sort((a, b) => b.clicks - a.clicks);
  }, [filtered]);

  const deviceMix = useMemo(() => {
    const m: Record<string, number> = { desktop: 0, mobile: 0, tablet: 0, other: 0 };
    for (const e of events) {
      const d = e.device_type ?? "other";
      m[d] = (m[d] || 0) + 1;
    }
    return m;
  }, [events]);

  const completionRate = useMemo(() => {
    const starts = filtered.filter((e) => e.event_type === "tour_step_view" && (e.step_index ?? 0) === 0).length;
    if (!starts) return null;
    return Math.round((counts.tour_complete / starts) * 100);
  }, [filtered, counts]);

  // ---- drill-down ---------------------------------------------------------
  const drillEvents = useMemo(() => {
    if (!drill) return [] as TourEvent[];
    return filtered.filter((e) => {
      if (drill.kind === "type") return e.event_type === drill.event_type;
      if (drill.kind === "step") return e.step_id === drill.step_id;
      if (drill.kind === "substep")
        return e.event_type === "tour_substep_click"
          && e.step_id === drill.step_id
          && e.sub_step_id === drill.sub_step_id;
      if (drill.kind === "window")
        return new Date(e.created_at).getTime() >= drill.from;
      return false;
    });
  }, [drill, filtered]);

  const drillUserSummary = useMemo(() => {
    const map = new Map<string, { user_id: string | null; events: number; first: string; last: string; types: Set<EventType> }>();
    for (const e of drillEvents) {
      const key = e.user_id ?? `__anon_${e.id}`;
      if (!map.has(key)) map.set(key, { user_id: e.user_id, events: 0, first: e.created_at, last: e.created_at, types: new Set() });
      const r = map.get(key)!;
      r.events++;
      r.types.add(e.event_type);
      if (e.created_at < r.first) r.first = e.created_at;
      if (e.created_at > r.last) r.last = e.created_at;
    }
    return Array.from(map.values()).sort((a, b) => b.events - a.events);
  }, [drillEvents]);

  // Hydrate profile info for the user_ids appearing in the current drill.
  useEffect(() => {
    if (!drill) return;
    const ids = Array.from(new Set(drillEvents.map((e) => e.user_id).filter(Boolean))) as string[];
    const missing = ids.filter((id) => !profiles[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, company")
        .in("id", missing);
      if (cancelled || !data) return;
      setProfiles((prev) => {
        const next = { ...prev };
        for (const p of data as ProfileLite[]) next[p.id] = p;
        return next;
      });
    })();
    return () => { cancelled = true; };
  }, [drill, drillEvents, profiles]);

  if (authLoading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const userLabel = (uid: string | null) => {
    if (!uid) return "(anonymous)";
    const p = profiles[uid];
    if (!p) return uid.slice(0, 8) + "…";
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ");
    return p.email || name || uid.slice(0, 8) + "…";
  };

  return (
    <>
      <Helmet><title>Onboarding funnel — Trade Admin — Maison Affluency</title></Helmet>
      <div className="max-w-6xl">
        <Link to="/trade/admin" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Trade Admin
        </Link>
        <h1 className="font-display text-2xl text-foreground flex items-center gap-2 mb-1">
          <BarChart3 className="h-5 w-5 text-accent" /> Onboarding funnel
        </h1>
        <p className="font-body text-sm text-muted-foreground mb-6">
          First-login Quick Tour engagement across <code className="px-1 bg-muted rounded">tour_step_view</code>,{" "}
          <code className="px-1 bg-muted rounded">tour_substep_click</code>, <code className="px-1 bg-muted rounded">tour_complete</code> and{" "}
          <code className="px-1 bg-muted rounded">tour_skip</code>.
        </p>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="flex items-center gap-1 border border-border rounded-md p-1 bg-card">
            {RANGES.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`px-3 py-1 text-[11px] uppercase tracking-widest rounded ${
                  range === r.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 border border-border rounded-md p-1 bg-card">
            {([
              ["all", "All devices", Globe],
              ["desktop", "Desktop", Monitor],
              ["mobile", "Mobile", Smartphone],
              ["tablet", "Tablet", Tablet],
            ] as const).map(([id, label, Icon]) => (
              <button
                key={id}
                onClick={() => setDevice(id as DeviceFilter)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 text-[11px] uppercase tracking-widest rounded ${
                  device === id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" /> {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex items-center justify-center text-muted-foreground"><DotCircleLoader size="sm" /></div>
        ) : (
          <>
            {/* KPI cards (clickable) */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <Kpi label="Step views" value={counts.tour_step_view} onClick={() => setDrill({ kind: "type", event_type: "tour_step_view" })} />
              <Kpi label="Sub-step clicks" value={counts.tour_substep_click} onClick={() => setDrill({ kind: "type", event_type: "tour_substep_click" })} />
              <Kpi label="Completes" value={counts.tour_complete} accent onClick={() => setDrill({ kind: "type", event_type: "tour_complete" })} />
              <Kpi label="Skips" value={counts.tour_skip} onClick={() => setDrill({ kind: "type", event_type: "tour_skip" })} />
              <Kpi label="Unique users" value={uniqueUsers} />
            </div>

            {/* Time-window quick drills */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Drill window:</span>
              {[
                ["Last hour", 3600_000],
                ["Last 24 h", 86400_000],
                ["Last 7 days", 7 * 86400_000],
              ].map(([label, ms]) => (
                <button
                  key={label as string}
                  onClick={() => setDrill({ kind: "window", from: Date.now() - (ms as number), label: label as string })}
                  className="px-2.5 py-1 text-[11px] uppercase tracking-widest border border-border rounded hover:bg-muted"
                >
                  {label}
                </button>
              ))}
              {completionRate !== null && (
                <span className="ml-auto font-body text-xs text-muted-foreground">
                  Completion rate: <span className="text-foreground font-medium">{completionRate}%</span>
                </span>
              )}
            </div>

            {/* Step funnel */}
            <Section title="Step funnel — unique users reaching each step (click a row to drill)">
              {stepFunnel.length === 0 ? (
                <Empty />
              ) : (
                <div className="space-y-2">
                  {stepFunnel.map((s) => (
                    <button
                      key={s.step_id}
                      onClick={() => setDrill({ kind: "step", step_id: s.step_id })}
                      className="w-full flex items-center gap-3 text-left rounded hover:bg-muted/40 px-1 py-1 transition-colors"
                    >
                      <div className="w-48 truncate font-mono text-[11px] text-muted-foreground">
                        {s.step_index}. {s.step_id}
                      </div>
                      <div className="flex-1 h-6 bg-muted rounded relative overflow-hidden">
                        <div className="h-full bg-accent/70" style={{ width: `${s.pct}%` }} />
                      </div>
                      <div className="w-28 text-right font-body text-xs">
                        <span className="text-foreground font-medium">{s.unique_users}</span>{" "}
                        <span className="text-muted-foreground">({s.pct}%)</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Section>

            {/* Sub-step pill clicks */}
            <Section title="Sub-step clicks (click a row to drill)">
              {subStepBreakdown.length === 0 ? (
                <Empty />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-body">
                    <thead>
                      <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                        <th className="text-left py-2">Step → sub-step</th>
                        <th className="text-right py-2 w-24">Clicks</th>
                        <th className="text-right py-2 w-32">Unique users</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subStepBreakdown.map((r) => (
                        <tr
                          key={r.label}
                          onClick={() => setDrill({ kind: "substep", step_id: r.step_id, sub_step_id: r.sub_step_id, label: r.label })}
                          className="border-b border-border/50 cursor-pointer hover:bg-muted/40"
                        >
                          <td className="py-2 text-foreground">{r.label}</td>
                          <td className="py-2 text-right">{r.clicks}</td>
                          <td className="py-2 text-right text-muted-foreground">{r.unique_users}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* Drill-down panel */}
            {drill && (
              <Section title={`Drill-down — ${drillTitle(drill)} · ${drillEvents.length} events · ${drillUserSummary.length} users`}>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => setDrill(null)}
                    className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                </div>

                {drillEvents.length === 0 ? (
                  <Empty />
                ) : (
                  <>
                    {/* Per-user summary */}
                    <div className="overflow-x-auto mb-6 border border-border rounded-md">
                      <table className="w-full text-sm font-body">
                        <thead className="bg-muted/40">
                          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            <th className="text-left px-3 py-2">User</th>
                            <th className="text-left px-3 py-2">Company</th>
                            <th className="text-left px-3 py-2">Event types</th>
                            <th className="text-right px-3 py-2 w-20">Events</th>
                            <th className="text-left px-3 py-2 w-44">First → last</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillUserSummary.map((u, i) => {
                            const p = u.user_id ? profiles[u.user_id] : null;
                            return (
                              <tr key={(u.user_id ?? "anon") + i} className="border-t border-border/50">
                                <td className="px-3 py-2 text-foreground">{userLabel(u.user_id)}</td>
                                <td className="px-3 py-2 text-muted-foreground">{p?.company || "—"}</td>
                                <td className="px-3 py-2 text-[11px] text-muted-foreground">{Array.from(u.types).join(", ")}</td>
                                <td className="px-3 py-2 text-right">{u.events}</td>
                                <td className="px-3 py-2 text-[11px] text-muted-foreground">
                                  {fmt(u.first)} → {fmt(u.last)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Raw events */}
                    <div className="overflow-x-auto border border-border rounded-md">
                      <table className="w-full text-sm font-body">
                        <thead className="bg-muted/40">
                          <tr className="text-[10px] uppercase tracking-widest text-muted-foreground">
                            <th className="text-left px-3 py-2 w-44">When</th>
                            <th className="text-left px-3 py-2">Event</th>
                            <th className="text-left px-3 py-2">Step / sub-step</th>
                            <th className="text-left px-3 py-2">User</th>
                            <th className="text-left px-3 py-2">Device</th>
                            <th className="text-left px-3 py-2">Page</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillEvents.slice(0, 500).map((e) => (
                            <tr key={e.id} className="border-t border-border/50 align-top">
                              <td className="px-3 py-2 text-[11px] text-muted-foreground whitespace-nowrap">{fmt(e.created_at)}</td>
                              <td className="px-3 py-2 text-[11px]">{e.event_type.replace("tour_", "")}</td>
                              <td className="px-3 py-2 text-[11px] text-foreground">
                                {e.step_id}
                                {e.sub_step_label ? ` → ${e.sub_step_label}` : ""}
                                {typeof e.step_index === "number" ? ` (#${e.step_index})` : ""}
                              </td>
                              <td className="px-3 py-2 text-[11px]">{userLabel(e.user_id)}</td>
                              <td className="px-3 py-2 text-[11px] text-muted-foreground">
                                {e.device_type ?? "?"}{e.platform ? ` · ${e.platform}` : ""}{e.viewport ? ` · ${e.viewport}` : ""}
                              </td>
                              <td className="px-3 py-2 text-[11px] text-muted-foreground">
                                {e.target_path ? (
                                  <span className="inline-flex items-center gap-1">
                                    <ExternalLink className="h-3 w-3" /> {e.target_path}
                                  </span>
                                ) : (e.page_path ?? "—")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {drillEvents.length > 500 && (
                        <p className="px-3 py-2 text-[11px] text-muted-foreground italic">Showing first 500 of {drillEvents.length} events.</p>
                      )}
                    </div>
                  </>
                )}
              </Section>
            )}

            {/* Device mix (always all-events, regardless of filter) */}
            <Section title="Device mix (all events in range)">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(deviceMix).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-border p-3 bg-card">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</div>
                    <div className="font-display text-xl text-foreground">{v}</div>
                  </div>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </>
  );
};

const Kpi = ({ label, value, accent }: { label: string; value: number; accent?: boolean }) => (
  <div className={`rounded-lg border p-4 ${accent ? "border-accent/50 bg-accent/5" : "border-border bg-card"}`}>
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    <div className="font-display text-2xl text-foreground">{value.toLocaleString()}</div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="font-display text-base text-foreground mb-3">{title}</h2>
    {children}
  </section>
);

const Empty = () => (
  <p className="font-body text-xs text-muted-foreground italic py-4">No events for this filter yet.</p>
);

export default TradeAdminOnboardingFunnel;
