import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function formatAge(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ${mins % 60}m`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"}`;
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function WaitingClock({ createdAt, open, highIntent }: { createdAt: string; open: boolean; highIntent: boolean }) {
  const now = useNow();
  const age = now - new Date(createdAt).getTime();
  const urgent = open && highIntent && age > 86_400_000;
  return (
    <span
      title={new Date(createdAt).toLocaleString()}
      className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] tabular-nums tracking-wide ${
        urgent ? "border-warning/60 bg-warning/15 text-foreground" : "border-border text-muted-foreground"
      }`}
    >
      ⏱️ {formatAge(age)} ago{urgent && <span className="ml-1 uppercase tracking-[0.15em]">· Urgent</span>}
    </span>
  );
}

export function TimeToApprovalKpi() {
  const { data, isLoading } = useQuery({
    queryKey: ["trade-time-to-approval"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("trade_accounts")
        .select("created_at, approved_at")
        .eq("status", "approved")
        .gte("approved_at", since)
        .limit(1000);
      if (error) throw error;
      const rows = (data ?? []).filter((r) => r.approved_at);
      const avg = rows.length
        ? rows.reduce((s, r) => s + (new Date(r.approved_at!).getTime() - new Date(r.created_at).getTime()), 0) / rows.length
        : null;
      return { avg, count: rows.length };
    },
  });

  return (
    <div className="border border-foreground bg-background px-6 py-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-foreground">Average Time-to-Approval</p>
      <div className="mt-2 flex items-baseline gap-4">
        <span className="font-serif text-4xl tracking-tight text-foreground tabular-nums">
          {isLoading ? "…" : data?.avg != null ? formatAge(data.avg) : "—"}
        </span>
        <span className="text-xs text-muted-foreground">
          {data ? `${data.count} approval${data.count === 1 ? "" : "s"} · last 30 days` : "last 30 days"}
        </span>
      </div>
    </div>
  );
}
