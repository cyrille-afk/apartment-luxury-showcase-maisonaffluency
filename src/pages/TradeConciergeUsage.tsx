import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { useState, Fragment } from "react";

type UsageRow = {
  id: string;
  user_id: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  message_count: number | null;
  sentiment: string | null;
  intent: string | null;
  created_at: string;
};

type Profile = { id: string; email: string | null; first_name: string | null; last_name: string | null; company: string | null };

// Rough USD pricing per 1M tokens (Gemini 2.5 Pro) — update if model changes.
const PRICE_IN_PER_M = 1.25;
const PRICE_OUT_PER_M = 10.0;

function fmtUSD(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export default function TradeConciergeUsage() {
  const { user, isAdmin, loading } = useAuth();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["concierge-usage-30d"],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("trade_concierge_usage")
        .select("id, user_id, model, prompt_tokens, completion_tokens, total_tokens, message_count, sentiment, intent, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as UsageRow[];
    },
  });

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (uid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const userIds = Array.from(new Set((rows || []).map((r) => r.user_id).filter(Boolean) as string[]));

  const { data: profiles } = useQuery({
    queryKey: ["concierge-usage-profiles", userIds.sort().join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, company")
        .in("id", userIds);
      if (error) throw error;
      return (data || []) as Profile[];
    },
  });

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  const profileById = new Map((profiles || []).map((p) => [p.id, p]));

  // Aggregate by user
  const byUser = new Map<string, { turns: number; pt: number; ct: number; tt: number }>();
  let totalPT = 0, totalCT = 0, totalTT = 0, totalTurns = 0;
  for (const r of rows || []) {
    totalPT += r.prompt_tokens; totalCT += r.completion_tokens; totalTT += r.total_tokens; totalTurns++;
    const key = r.user_id || "anonymous";
    const agg = byUser.get(key) || { turns: 0, pt: 0, ct: 0, tt: 0 };
    agg.turns++; agg.pt += r.prompt_tokens; agg.ct += r.completion_tokens; agg.tt += r.total_tokens;
    byUser.set(key, agg);
  }

  const totalCost = (totalPT / 1_000_000) * PRICE_IN_PER_M + (totalCT / 1_000_000) * PRICE_OUT_PER_M;
  const userRows = Array.from(byUser.entries())
    .map(([uid, a]) => ({ uid, ...a, cost: (a.pt / 1_000_000) * PRICE_IN_PER_M + (a.ct / 1_000_000) * PRICE_OUT_PER_M }))
    .sort((a, b) => b.tt - a.tt);

  return (
    <>
      <Helmet><title>Concierge Token Usage · Trade</title></Helmet>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="h-5 w-5 text-foreground/70" />
          <h1 className="font-display text-2xl">AI Concierge — Token Usage (last 30 days)</h1>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Stat label="Turns" value={totalTurns.toLocaleString()} />
          <Stat label="Users" value={byUser.size.toLocaleString()} />
          <Stat label="Input tokens" value={totalPT.toLocaleString()} />
          <Stat label="Output tokens" value={totalCT.toLocaleString()} />
          <Stat label="Est. cost (USD)" value={fmtUSD(totalCost)} />
        </div>

        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-foreground/60 uppercase tracking-wider text-xs">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-right px-4 py-3">Turns</th>
                <th className="text-right px-4 py-3">Input</th>
                <th className="text-right px-4 py-3">Output</th>
                <th className="text-right px-4 py-3">Total tokens</th>
                <th className="text-right px-4 py-3">Est. cost</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-foreground/50">Loading…</td></tr>
              )}
              {!isLoading && userRows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-foreground/50">No usage logged yet.</td></tr>
              )}
              {userRows.map((u) => {
                const p = profileById.get(u.uid);
                const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || p.email || u.uid : u.uid;
                return (
                  <tr key={u.uid} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-medium">{name}</div>
                      {p?.company && <div className="text-xs text-foreground/50">{p.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-right">{u.turns.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{u.pt.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{u.ct.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">{u.tt.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right">{fmtUSD(u.cost)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-foreground/40 mt-4">
          Pricing estimate: ${PRICE_IN_PER_M}/M input + ${PRICE_OUT_PER_M}/M output (Gemini 2.5 Pro list price). Actual billing depends on your AI gateway plan.
        </p>
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
