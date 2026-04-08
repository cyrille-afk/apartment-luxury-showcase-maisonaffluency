import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.1/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoISO = weekAgo.toISOString();

  // Fetch this week's events
  const { data: events, error } = await supabase
    .from("video_watch_events")
    .select("*")
    .gte("created_at", weekAgoISO)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch video events:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allEvents = events || [];

  // Compute stats
  const plays = allEvents.filter((e) => e.event_type === "play");
  const completions = allEvents.filter((e) => e.event_type === "complete");
  const sessions = new Set(allEvents.map((e) => e.session_id));

  // Milestone funnel
  const milestoneEvents = allEvents.filter(
    (e) => e.event_type === "milestone" || e.event_type === "complete"
  );
  const milestoneSessions: Record<number, Set<string>> = { 25: new Set(), 50: new Set(), 75: new Set(), 100: new Set() };
  for (const e of milestoneEvents) {
    const pct = e.progress_percent ?? (e.event_type === "complete" ? 100 : 0);
    if (milestoneSessions[pct]) {
      milestoneSessions[pct].add(e.session_id);
    }
  }

  // Average watch duration
  const sessionMaxDuration = new Map<string, number>();
  for (const e of allEvents) {
    if (e.watch_duration_seconds != null) {
      const current = sessionMaxDuration.get(e.session_id) || 0;
      if (Number(e.watch_duration_seconds) > current) {
        sessionMaxDuration.set(e.session_id, Number(e.watch_duration_seconds));
      }
    }
  }
  const durations = Array.from(sessionMaxDuration.values());
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

  const completionRate =
    plays.length > 0 ? Math.round((completions.length / plays.length) * 100) : 0;

  const report = {
    period: `${weekAgo.toISOString().slice(0, 10)} → ${now.toISOString().slice(0, 10)}`,
    video_id: "showroom-tour",
    total_plays: plays.length,
    unique_sessions: sessions.size,
    completions: completions.length,
    completion_rate_pct: completionRate,
    avg_watch_duration_seconds: avgDuration,
    funnel: {
      "25%": milestoneSessions[25].size,
      "50%": milestoneSessions[50].size,
      "75%": milestoneSessions[75].size,
      "100%": milestoneSessions[100].size,
    },
    drop_off_analysis: {
      "0→25%_drop":
        plays.length > 0
          ? `${Math.round(((plays.length - milestoneSessions[25].size) / plays.length) * 100)}%`
          : "N/A",
      "25→50%_drop":
        milestoneSessions[25].size > 0
          ? `${Math.round(((milestoneSessions[25].size - milestoneSessions[50].size) / milestoneSessions[25].size) * 100)}%`
          : "N/A",
      "50→75%_drop":
        milestoneSessions[50].size > 0
          ? `${Math.round(((milestoneSessions[50].size - milestoneSessions[75].size) / milestoneSessions[50].size) * 100)}%`
          : "N/A",
      "75→100%_drop":
        milestoneSessions[75].size > 0
          ? `${Math.round(((milestoneSessions[75].size - milestoneSessions[100].size) / milestoneSessions[75].size) * 100)}%`
          : "N/A",
    },
  };

  console.log("Weekly video audit report:", JSON.stringify(report, null, 2));

  // Send the report as an admin notification
  // Find admin user IDs
  const { data: admins } = await supabase
    .from("user_roles")
    .select("user_id")
    .in("role", ["admin", "super_admin"]);

  const adminIds = [...new Set((admins || []).map((a) => a.user_id))];

  const funnelLine = `25%: ${report.funnel["25%"]} → 50%: ${report.funnel["50%"]} → 75%: ${report.funnel["75%"]} → 100%: ${report.funnel["100%"]}`;

  for (const adminId of adminIds) {
    await supabase.from("notifications").insert({
      user_id: adminId,
      title: "Weekly Video Audit",
      type: "video_audit",
      message: `${report.period} | ${report.total_plays} plays, ${report.completion_rate_pct}% completion, avg ${report.avg_watch_duration_seconds}s | Funnel: ${funnelLine}`,
      link: "/trade/admin",
    });
  }

  return new Response(JSON.stringify(report), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
