import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { bucketInviteActivity } from "@/lib/inviteActivity";

const series = [
  { key: "attempt", label: "Invitation attempts", className: "bg-muted-foreground/60" },
  { key: "sent", label: "Emails sent", className: "bg-primary" },
  { key: "validation_error", label: "Validation errors", className: "bg-destructive" },
] as const;

export default function ViewingRoomInviteActivity({ developerId }: { developerId: string }) {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["viewing-room-invite-activity", developerId, days],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - days);
      const { data, error } = await supabase.from("viewing_room_invite_activity").select("kind, created_at").eq("developer_project_id", developerId).gte("created_at", since.toISOString()).order("created_at").limit(5000);
      if (error) throw error;
      return data;
    },
  });
  const buckets = useMemo(() => bucketInviteActivity(data ?? [], days), [data, days]);
  const totals = useMemo(() => Object.fromEntries(series.map(s => [s.key, buckets.reduce((n, d) => n + d[s.key], 0)])) as Record<(typeof series)[number]["key"], number>, [buckets]);
  const max = Math.max(1, ...buckets.map(d => Math.max(d.attempt, d.sent, d.validation_error)));

  return <section aria-label="Invitation activity" className="space-y-4 border border-border p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-display text-lg">Invitation activity</h3>
      <div className="flex items-center gap-1">{[7, 30, 90].map(n => <Button key={n} size="sm" variant={days === n ? "secondary" : "ghost"} aria-pressed={days === n} onClick={() => setDays(n)}>{n}d</Button>)}<Button size="icon" variant="ghost" aria-label="Refresh invitation activity" disabled={isFetching} onClick={() => void refetch()}><RotateCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /></Button></div>
    </div>
    {isError ? <p role="alert" className="text-sm text-destructive">Activity couldn’t load. Try refreshing.</p> : <>
      <dl className="grid grid-cols-3 gap-3">{series.map(s => <div key={s.key} className="min-w-0"><dt className="flex items-start gap-1.5 text-xs leading-tight text-muted-foreground"><span aria-hidden className={`mt-1 size-2 shrink-0 rounded-full ${s.className}`} /><span>{s.label}</span></dt><dd className="font-display text-2xl">{isLoading ? "–" : totals[s.key]}</dd></div>)}</dl>
      <div role="img" aria-label={`Daily invitation activity over the last ${days} days`} className="flex h-28 items-end gap-px border-b border-border">
        {buckets.map(d => <div key={d.day} title={`${d.day}: ${d.attempt} attempts, ${d.sent} sent, ${d.validation_error} errors`} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
          {series.map(s => <span key={s.key} className={`w-full max-w-2 ${s.className}`} style={{ height: `${(d[s.key] / max) * 100}%` }} />)}
        </div>)}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>{buckets[0]?.day}</span><span>Today</span></div>
      {!isLoading && totals.attempt === 0 && <p className="text-xs text-muted-foreground">No invitations sent in this period.</p>}
    </>}
  </section>;
}
