/**
 * monitor-concierge-email — alerts ops when concierge/inquiry/quote emails fail.
 * Runs every 10 minutes. Looks at the latest status per message in the last
 * 24h; flags dlq/failed/bounced/suppressed, or pending > 20 min. Each failed
 * message is alerted once (ids remembered in admin_alert_log).
 * Slack first, email fallback to Cyrille + Grégoire.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireCronOrAdmin } from "../_shared/auth.ts";
import { isConciergeEmail, isDeliveryFailure } from "./rules.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const OPS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];
const ADMIN_URL = "https://www.maisonaffluency.com/trade/admin/email-deliverability";
const EVENT = "concierge_email_failed";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const auth = await requireCronOrAdmin(req, "monitor-concierge-email");
  if (!auth.ok) return json(auth.body, auth.status);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600_000).toISOString();

  const { data: rows, error } = await db
    .from("email_send_log")
    .select("message_id, template_name, recipient_email, status, error_message, created_at")
    .gte("created_at", since)
    .not("message_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) return json({ error: error.message }, 500);

  // Latest row per message_id.
  const latest = new Map<string, any>();
  for (const r of rows ?? []) if (!latest.has(r.message_id)) latest.set(r.message_id, r);

  const failed = [...latest.values()].filter(
    (r) => isConciergeEmail(r.template_name, r.recipient_email) && isDeliveryFailure(r.status, r.created_at, now),
  );

  // Skip messages already alerted.
  const { data: prior } = await db.from("admin_alert_log").select("payload")
    .eq("event", EVENT).gte("created_at", new Date(now.getTime() - 48 * 3600_000).toISOString()).limit(500);
  const seen = new Set<string>();
  for (const p of prior ?? []) for (const id of (p as any)?.payload?.message_ids ?? []) seen.add(id);
  const fresh = failed.filter((r) => !seen.has(r.message_id));
  if (!fresh.length) return json({ checked: latest.size, failed: failed.length, alerted: false });

  const failures = fresh.map((r) => ({
    template: r.template_name, recipient: r.recipient_email,
    status: r.status === "pending" ? "stuck pending" : r.status,
    error: r.error_message, at: r.created_at,
  }));

  let slack: "sent" | "failed" | "not_configured" = "not_configured";
  const hook = Deno.env.get("SLACK_OPS_WEBHOOK_URL")?.trim() || Deno.env.get("SLACK_PAYMENTS_WEBHOOK_URL")?.trim();
  if (hook) {
    try {
      const lines = failures.slice(0, 15).map((f) => `• ${f.template} → ${f.recipient} — *${f.status}*${f.error ? ` (${f.error.slice(0, 120)})` : ""}`);
      const r = await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: `⚠️ ${failures.length} concierge email(s) not delivered\n${lines.join("\n")}\n<${ADMIN_URL}|Open admin>` }) });
      slack = r.ok ? "sent" : "failed";
    } catch { slack = "failed"; }
  }

  let email: "sent" | "failed" = "sent";
  const key = `concierge-fail-${fresh.map((r) => r.message_id).sort().join(",").slice(0, 80)}`;
  for (const to of OPS) {
    const { error: e } = await db.functions.invoke("send-transactional-email", {
      body: { templateName: "concierge-delivery-alert", recipientEmail: to, idempotencyKey: `${key}-${to}`,
        templateData: { count: failures.length, failures, adminUrl: ADMIN_URL, slackStatus: slack } },
    });
    if (e) email = "failed";
  }

  await db.from("admin_alert_log").insert({
    channel: slack === "sent" ? "slack" : "email", event: EVENT,
    status: slack === "sent" || email === "sent" ? "sent" : "failed",
    payload: { message_ids: fresh.map((r) => r.message_id), failures, slack, email },
  });
  return json({ checked: latest.size, failed: failed.length, alerted: fresh.length, slack, email });
});
