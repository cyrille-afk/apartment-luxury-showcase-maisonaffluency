import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const RANGES = [7, 30, 90] as const;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export default function TradeAdminFelixUsage() {
  const { user, isAdmin, loading } = useAuth();
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["felix-usage", days],
    enabled: !!user && isAdmin,
    queryFn: async () => {
      const since = new Date(Date.now() - (days - 1) * 86_400_000);
      since.setUTCHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("felix_usage_events")
        .select("created_at, mode, query, result_count, user_id")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(10000);
      if (error) throw error;
      return data;
    },
  });

  const { series, totals, topQueries } = useMemo(() => {
    const byDay = new Map<string, { day: string; keyword: number; link: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(new Date(Date.now() - i * 86_400_000));
      byDay.set(k, { day: k.slice(5), keyword: 0, link: 0 });
    }
    const q = new Map<string, number>();
    let keyword = 0, link = 0, empty = 0;
    const users = new Set<string>();
    for (const r of data) {
      const row = byDay.get(r.created_at.slice(0, 10));
      if (r.mode === "reference") { link++; if (row) row.link++; } else { keyword++; if (row) row.keyword++; }
      if (r.result_count === 0) empty++;
      if (r.user_id) users.add(r.user_id);
      const key = r.query.trim().toLowerCase();
      q.set(key, (q.get(key) ?? 0) + 1);
    }
    return {
      series: [...byDay.values()],
      totals: { all: data.length, keyword, link, empty, users: users.size },
      topQueries: [...q.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10),
    };
  }, [data, days]);

  if (!loading && (!user || !isAdmin)) return <Navigate to="/trade" replace />;

  const stat = (label: string, value: number) => (
    <div className="border border-border p-4">
      <div className="font-body text-xs uppercase tracking-[0.15em] text-muted-foreground">{label}</div>
      <div className="mt-2 font-display text-3xl text-foreground">{value}</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl uppercase tracking-[0.04em] text-foreground">Felix Moodboard Usage</h1>
          <p className="mt-2 font-body text-sm text-muted-foreground">Generate Edit submissions by day (UTC) · keyword vs image/Pinterest link</p>
        </div>
        <div className="flex border border-border">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setDays(r)}
              className={`px-3 py-1.5 font-body text-xs uppercase tracking-wider ${days === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}>
              {r} days
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
        {stat("Total", totals.all)}
        {stat("Keyword", totals.keyword)}
        {stat("Image / link", totals.link)}
        {stat("No results", totals.empty)}
        {stat("Signed-in users", totals.users)}
      </div>

      <div className="mt-8 h-80 border border-border p-4">
        {isLoading ? <p className="font-body text-sm text-muted-foreground">Loading…</p>
          : isError ? <p className="font-body text-sm text-destructive">Couldn't load usage.</p>
          : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Bar dataKey="keyword" name="Keyword" stackId="a" fill="hsl(var(--primary))" />
                <Bar dataKey="link" name="Image / link" stackId="a" fill="hsl(var(--muted-foreground))" />
              </BarChart>
            </ResponsiveContainer>
          )}
      </div>

      <h2 className="mt-10 font-display text-xl uppercase tracking-[0.04em] text-foreground">Top searches</h2>
      <div className="mt-4 border border-border">
        {topQueries.length === 0 && <p className="px-4 py-6 font-body text-sm text-muted-foreground">No submissions in this period.</p>}
        {topQueries.map(([q, n]) => (
          <div key={q} className="flex justify-between gap-4 border-t border-border px-4 py-3 font-body text-sm first:border-t-0">
            <span className="truncate text-foreground">{q}</span><span className="text-muted-foreground">{n}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
