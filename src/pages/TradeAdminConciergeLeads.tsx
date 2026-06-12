import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Inbox, ChevronDown, ChevronRight, Search, Filter } from "lucide-react";
import { useState, Fragment } from "react";
import type { Json } from "@/integrations/supabase/types";

type LeadRow = {
  id: string;
  created_at: string;
  surface: string;
  name: string | null;
  city: string | null;
  country: string | null;
  first_message: string | null;
  intent: string | null;
  signals: Json;
  qualified_score: number;
  path: string | null;
  referrer: string | null;
  session_id: string;
  user_id: string | null;
  user_agent: string | null;
  notified_at: string | null;
};

const SURFACES = ["all", "public", "trade"];
const INTENTS = ["all", "sourcing", "bespoke", "project_ffe", "general"];
const SCORE_BUCKETS = [
  { label: "All", min: 0 },
  { label: "High (≥60)", min: 60 },
  { label: "Very High (≥80)", min: 80 },
];

function signalBadges(signals: Json): string[] {
  if (!signals) return [];
  if (Array.isArray(signals)) return signals.filter((s) => typeof s === "string") as string[];
  if (typeof signals === "object") {
    const arr = (signals as any).signals;
    if (Array.isArray(arr)) return arr.filter((s: any) => typeof s === "string");
    const entries = Object.entries(signals as Record<string, unknown>);
    return entries.filter(([, v]) => v === true || v === "true").map(([k]) => k);
  }
  return [];
}

function classForScore(score: number): string {
  if (score >= 80) return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  if (score >= 60) return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  return "bg-muted text-muted-foreground border-border";
}

export default function TradeAdminConciergeLeads() {
  const { user, isAdmin, loading } = useAuth();

  const [surfaceFilter, setSurfaceFilter] = useState("all");
  const [intentFilter, setIntentFilter] = useState("all");
  const [scoreMin, setScoreMin] = useState(0);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const { data: rows, isLoading } = useQuery({
    queryKey: ["concierge-leads", surfaceFilter, intentFilter, scoreMin],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      let query = supabase
        .from("concierge_leads")
        .select("*")
        .gte("qualified_score", scoreMin)
        .order("created_at", { ascending: false })
        .limit(500);

      if (surfaceFilter !== "all") {
        query = query.eq("surface", surfaceFilter);
      }
      if (intentFilter !== "all") {
        query = query.eq("intent", intentFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as LeadRow[];
    },
  });

  const filtered = (rows || []).filter((r) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(q) ||
      (r.city || "").toLowerCase().includes(q) ||
      (r.country || "").toLowerCase().includes(q) ||
      (r.first_message || "").toLowerCase().includes(q) ||
      (r.intent || "").toLowerCase().includes(q)
    );
  });

  const highValueCount = (rows || []).filter((r) => {
    const sigs = signalBadges(r.signals);
    return sigs.includes("high_value_location");
  }).length;

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <>
      <Helmet><title>Concierge Leads · Admin · Trade</title></Helmet>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Inbox className="h-5 w-5 text-foreground/70" />
          <h1 className="font-display text-2xl">Concierge Leads</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Stat label="Total captured" value={(rows || []).length.toLocaleString()} />
          <Stat label="High-value locations" value={highValueCount.toLocaleString()} />
          <Stat label="Avg. score" value={
            rows && rows.length > 0
              ? Math.round(rows.reduce((s, r) => s + r.qualified_score, 0) / rows.length).toString()
              : "—"
          } />
          <Stat label="Notified" value={(rows || []).filter((r) => r.notified_at).length.toLocaleString()} />
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name, city, message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 rounded-md border border-input bg-background text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <FilterSelect
              icon={<Filter className="h-3.5 w-3.5" />}
              value={surfaceFilter}
              onChange={setSurfaceFilter}
              options={SURFACES.map((s) => ({ label: s === "all" ? "All surfaces" : s, value: s }))}
            />
            <FilterSelect
              value={intentFilter}
              onChange={setIntentFilter}
              options={INTENTS.map((i) => ({ label: i === "all" ? "All intents" : i.replace("_", " "), value: i }))}
            />
            <FilterSelect
              value={String(scoreMin)}
              onChange={(v) => setScoreMin(Number(v))}
              options={SCORE_BUCKETS.map((b) => ({ label: b.label, value: String(b.min) }))}
            />
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-foreground/60 uppercase tracking-wider text-xs">
              <tr>
                <th className="text-left px-4 py-3 w-8"></th>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Surface</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Intent</th>
                <th className="text-right px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Signals</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-foreground/50">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-foreground/50">No leads match.</td></tr>
              )}
              {filtered.map((row) => {
                const isOpen = expanded.has(row.id);
                const badges = signalBadges(row.signals);
                return (
                  <Fragment key={row.id}>
                    <tr
                      className="border-t border-border cursor-pointer hover:bg-muted/30"
                      onClick={() => toggle(row.id)}
                    >
                      <td className="px-4 py-3 text-foreground/50">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString()}
                        <div className="text-[10px] text-foreground/40">{new Date(row.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-body uppercase tracking-wider border ${
                          row.surface === "trade" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border"
                        }`}>
                          {row.surface}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium">{row.name || "—"}</td>
                      <td className="px-4 py-3">
                        {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-3 capitalize">{row.intent?.replace("_", " ") || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded text-xs font-medium border ${classForScore(row.qualified_score)}`}>
                          {row.qualified_score}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {badges.slice(0, 3).map((b) => (
                            <span key={b} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-accent/10 text-accent-foreground border border-accent/20">
                              {b.replace(/_/g, " ")}
                            </span>
                          ))}
                          {badges.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">+{badges.length - 3}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-muted/20">
                        <td></td>
                        <td colSpan={7} className="px-4 py-4">
                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-xs uppercase tracking-wider text-foreground/50">First message</span>
                              <p className="mt-1 text-foreground/80 whitespace-pre-wrap">{row.first_message || "—"}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-foreground/60">
                              <div>
                                <span className="text-foreground/40">Session:</span> {row.session_id}
                              </div>
                              <div>
                                <span className="text-foreground/40">Path:</span> {row.path || "—"}
                              </div>
                              <div>
                                <span className="text-foreground/40">Referrer:</span> {row.referrer || "—"}
                              </div>
                              {row.user_id && (
                                <div>
                                  <span className="text-foreground/40">User:</span> {row.user_id}
                                </div>
                              )}
                              {row.notified_at && (
                                <div>
                                  <span className="text-foreground/40">Notified:</span> {new Date(row.notified_at).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wider text-foreground/50">{label}</div>
      <div className="font-display text-xl mt-1">{value}</div>
    </div>
  );
}

function FilterSelect({
  icon,
  value,
  onChange,
  options,
}: {
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="relative">
      {icon && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">{icon}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${icon ? "pl-8 pr-8" : "px-3"}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
