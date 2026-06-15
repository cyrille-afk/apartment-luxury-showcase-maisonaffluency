// Scheduled security monitor.
// Reads recent security_audit_events, detects spikes/unusual patterns,
// and emails admins when thresholds are exceeded. Dedupes via security_alert_state.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-cron-secret",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

// Thresholds (per scan window — default 15 min)
const WINDOW_MINUTES = 15;
const ALERT_THRESHOLDS = {
  edge_unauthorized_per_function: 10, // ≥10 401s on a single function
  edge_forbidden_per_user: 5,         // ≥5 403s by a single user
  total_unauthorized: 30,             // ≥30 401s total
  storage_unexpected_writes: 1,       // ANY suspicious storage write
};
const ALERT_COOLDOWN_MIN = 30; // do not re-alert same kind for 30 min

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth: cron secret OR service role bearer
  const cronSecret = req.headers.get("x-cron-secret");
  const auth = req.headers.get("authorization") ?? "";
  const expectedCron = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isCron = !!(expectedCron && cronSecret === expectedCron);
  const isService = !!(serviceKey && auth === `Bearer ${serviceKey}`);
  if (!isCron && !isService) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { data: events, error } = await supabase
    .from("security_audit_events")
    .select("event_type, source, user_id, ip, details, occurred_at")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(2000);

  if (error) {
    console.error("security monitor query error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const unauthorized = events!.filter(e => e.event_type === "edge_unauthorized");
  const forbidden = events!.filter(e => e.event_type === "edge_forbidden");
  const storageBad = events!.filter(e => e.event_type === "storage_unexpected_write");

  const byFunc: Record<string, number> = {};
  for (const e of unauthorized) byFunc[e.source] = (byFunc[e.source] ?? 0) + 1;
  const byUser: Record<string, number> = {};
  for (const e of forbidden) {
    const k = e.user_id ?? "anon";
    byUser[k] = (byUser[k] ?? 0) + 1;
  }

  const triggered: { key: string; title: string; html: string }[] = [];

  // Rule 1: 401 spike per function
  for (const [fn, count] of Object.entries(byFunc)) {
    if (count >= ALERT_THRESHOLDS.edge_unauthorized_per_function) {
      triggered.push({
        key: `edge_unauth:${fn}`,
        title: `Unauthorized spike on edge function "${fn}"`,
        html: `<p><strong>${count}</strong> unauthorized (401) attempts on <code>${fn}</code> in the last ${WINDOW_MINUTES} min.</p>`,
      });
    }
  }
  // Rule 2: 403 per user
  for (const [u, count] of Object.entries(byUser)) {
    if (count >= ALERT_THRESHOLDS.edge_forbidden_per_user) {
      triggered.push({
        key: `edge_forbidden:${u}`,
        title: `Forbidden access pattern from user ${u}`,
        html: `<p>User <code>${u}</code> received <strong>${count}</strong> 403 responses in the last ${WINDOW_MINUTES} min — possible privilege probing.</p>`,
      });
    }
  }
  // Rule 3: total 401s
  if (unauthorized.length >= ALERT_THRESHOLDS.total_unauthorized) {
    triggered.push({
      key: "edge_unauth:total",
      title: `Global unauthorized burst: ${unauthorized.length} in ${WINDOW_MINUTES} min`,
      html: `<p><strong>${unauthorized.length}</strong> total 401 responses across all edge functions.</p>`,
    });
  }
  // Rule 4: any unexpected storage write
  if (storageBad.length >= ALERT_THRESHOLDS.storage_unexpected_writes) {
    const rows = storageBad.slice(0, 20).map(e =>
      `<tr><td style="padding:4px 8px;">${e.source}</td><td style="padding:4px 8px;">${(e.details as any)?.reason ?? ""}</td><td style="padding:4px 8px;font-family:monospace;">${(e.details as any)?.object_name ?? ""}</td><td style="padding:4px 8px;">${e.user_id ?? "anon"}</td></tr>`
    ).join("");
    triggered.push({
      key: "storage_unexpected",
      title: `Unexpected storage writes detected (${storageBad.length})`,
      html: `<p><strong>${storageBad.length}</strong> unexpected storage writes in the last ${WINDOW_MINUTES} min:</p>
        <table style="border-collapse:collapse;font-size:13px;">
          <thead><tr><th style="text-align:left;padding:4px 8px;">Bucket</th><th style="text-align:left;padding:4px 8px;">Reason</th><th style="text-align:left;padding:4px 8px;">Object</th><th style="text-align:left;padding:4px 8px;">User</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`,
    });
  }

  // Filter via cooldown
  const sent: string[] = [];
  const skipped: string[] = [];
  if (triggered.length > 0) {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const cutoff = new Date(Date.now() - ALERT_COOLDOWN_MIN * 60_000).toISOString();
    for (const t of triggered) {
      const { data: state } = await supabase
        .from("security_alert_state")
        .select("last_alerted_at")
        .eq("id", t.key)
        .maybeSingle();
      if (state?.last_alerted_at && state.last_alerted_at > cutoff) {
        skipped.push(t.key);
        continue;
      }
      const html = `
        <div style="font-family:Georgia,serif;max-width:640px;margin:0 auto;padding:32px;background:#faf9f7;">
          <h2 style="font-size:18px;color:#1a1a1a;margin:0 0 16px;">⚠ Security alert — ${t.title}</h2>
          <div style="background:#fff;border:1px solid #e8e5e0;border-radius:4px;padding:20px;">
            ${t.html}
            <p style="font-size:12px;color:#666;margin-top:16px;">Window: last ${WINDOW_MINUTES} minutes • Project: Maison Affluency</p>
          </div>
          <p style="font-size:11px;color:#999;margin-top:16px;text-align:center;">Maison Affluency — Automated security monitor</p>
        </div>`;
      await Promise.allSettled(
        ADMIN_EMAILS.map(to =>
          resend.emails.send({
            from: "Maison Affluency <noreply@notify.www.maisonaffluency.com>",
            to,
            subject: `[Security] ${t.title}`,
            html,
          })
        )
      );
      await supabase.from("security_alert_state").upsert({
        id: t.key,
        last_alerted_at: new Date().toISOString(),
        payload: { title: t.title },
      });
      sent.push(t.key);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      window_minutes: WINDOW_MINUTES,
      counts: {
        unauthorized: unauthorized.length,
        forbidden: forbidden.length,
        storage_unexpected: storageBad.length,
      },
      alerts_sent: sent,
      alerts_skipped_cooldown: skipped,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
