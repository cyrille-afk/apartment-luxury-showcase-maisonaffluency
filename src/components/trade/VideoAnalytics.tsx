import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, CheckCircle2, Clock, Users, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface VideoStats {
  totalPlays: number;
  uniqueSessions: number;
  completions: number;
  completionRate: number;
  avgWatchDuration: number;
  milestoneBreakdown: { milestone: number; count: number }[];
  recentDays: { date: string; plays: number }[];
}

const StatCard = ({ icon: Icon, label, value, subtitle }: { icon: any; label: string; value: string | number; subtitle?: string }) => (
  <Card className="p-4 space-y-2">
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <span className="font-body text-xs text-muted-foreground">{label}</span>
    </div>
    <p className="font-display text-2xl text-foreground">{value}</p>
    {subtitle && <p className="font-body text-[10px] text-muted-foreground">{subtitle}</p>}
  </Card>
);

export default function VideoAnalytics() {
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data: events } = await supabase
          .from("video_watch_events")
          .select("*")
          .order("created_at", { ascending: false });

        if (!events || events.length === 0) {
          setStats({
            totalPlays: 0, uniqueSessions: 0, completions: 0,
            completionRate: 0, avgWatchDuration: 0,
            milestoneBreakdown: [], recentDays: [],
          });
          setLoading(false);
          return;
        }

        const plays = events.filter(e => e.event_type === "play");
        const completions = events.filter(e => e.event_type === "complete");
        const sessions = new Set(events.map(e => e.session_id));

        // Average watch duration from completion events (they have the longest duration per session)
        const sessionMaxDuration = new Map<string, number>();
        events.forEach(e => {
          if (e.watch_duration_seconds != null) {
            const current = sessionMaxDuration.get(e.session_id) || 0;
            if (Number(e.watch_duration_seconds) > current) {
              sessionMaxDuration.set(e.session_id, Number(e.watch_duration_seconds));
            }
          }
        });
        const durations = Array.from(sessionMaxDuration.values());
        const avgDuration = durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0;

        // Milestone breakdown
        const milestones = events.filter(e => e.event_type === "milestone" || e.event_type === "complete");
        const milestoneMap = new Map<number, Set<string>>();
        milestones.forEach(e => {
          const pct = e.progress_percent ?? (e.event_type === "complete" ? 100 : 0);
          if (!milestoneMap.has(pct)) milestoneMap.set(pct, new Set());
          milestoneMap.get(pct)!.add(e.session_id);
        });
        const milestoneBreakdown = [25, 50, 75, 100].map(m => ({
          milestone: m,
          count: milestoneMap.get(m)?.size || 0,
        }));

        // Recent 7 days
        const now = new Date();
        const recentDays: { date: string; plays: number }[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const dateStr = d.toISOString().slice(0, 10);
          const dayPlays = plays.filter(e => e.created_at.slice(0, 10) === dateStr).length;
          recentDays.push({ date: dateStr, plays: dayPlays });
        }

        const completionRate = plays.length > 0
          ? Math.round((completions.length / plays.length) * 100)
          : 0;

        setStats({
          totalPlays: plays.length,
          uniqueSessions: sessions.size,
          completions: completions.length,
          completionRate,
          avgWatchDuration: avgDuration,
          milestoneBreakdown,
          recentDays,
        });
      } catch (err) {
        console.error("Video analytics error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const formatDuration = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
  };

  const maxDayPlays = Math.max(...stats.recentDays.map(d => d.plays), 1);

  return (
    <div className="space-y-6">
      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Play} label="Total Plays" value={stats.totalPlays} subtitle={`${stats.uniqueSessions} unique sessions`} />
        <StatCard icon={CheckCircle2} label="Completions" value={stats.completions} />
        <StatCard icon={TrendingUp} label="Completion Rate" value={`${stats.completionRate}%`} subtitle="Play → 100% watched" />
        <StatCard icon={Clock} label="Avg Watch Duration" value={formatDuration(stats.avgWatchDuration)} />
      </div>

      {/* Milestone funnel */}
      <Card className="p-5 space-y-4">
        <h2 className="font-display text-sm text-foreground">Viewer Retention Funnel</h2>
        <div className="space-y-3">
          {stats.milestoneBreakdown.map((m) => (
            <div key={m.milestone} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-body text-xs text-foreground">{m.milestone}% watched</span>
                <span className="font-body text-[10px] text-muted-foreground">
                  {m.count} session{m.count !== 1 ? "s" : ""}
                </span>
              </div>
              <Progress
                value={stats.totalPlays > 0 ? (m.count / stats.totalPlays) * 100 : 0}
                className="h-1.5"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Last 7 days */}
      <Card className="p-5 space-y-4">
        <h2 className="font-display text-sm text-foreground">Plays — Last 7 Days</h2>
        <div className="flex items-end gap-1 h-20">
          {stats.recentDays.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="font-body text-[9px] text-muted-foreground">{d.plays}</span>
              <div
                className="w-full bg-primary/20 rounded-sm min-h-[2px]"
                style={{ height: `${(d.plays / maxDayPlays) * 100}%` }}
              >
                <div
                  className="w-full h-full bg-primary rounded-sm"
                />
              </div>
              <span className="font-body text-[8px] text-muted-foreground">
                {new Date(d.date + "T00:00").toLocaleDateString("en", { weekday: "short" })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {stats.totalPlays === 0 && (
        <Card className="p-5 border-amber-500/20 bg-amber-500/5">
          <div className="flex gap-3">
            <Users className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
            <div>
              <p className="font-display text-xs text-foreground">No video views yet</p>
              <p className="font-body text-[11px] text-muted-foreground mt-1">
                Once visitors play the apartment tour video, engagement data will appear here.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
