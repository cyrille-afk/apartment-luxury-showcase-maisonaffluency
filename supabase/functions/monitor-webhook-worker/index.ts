/**
 * monitor-webhook-worker — health watchdog for the asynchronous payment queue
 * ===========================================================================
 * Runs on a schedule (every 10 minutes). It:
 *   1. Calls the worker's `?health=1` probe — this exercises the same startup
 *      check (Stripe credentials + database reachability) the drain path uses.
 *   2. Reads the `webhook_worker_health` heartbeat (last successful run,
 *      consecutive failures, boot status).
 *   3. Tracks pending-event age: any queued event older than the stall
 *      threshold means paid orders are not being applied.
 *
 * On any unhealthy signal it alerts ops via Slack (primary) with a Resend email
 * fallback, and records the outcome in `admin_alert_log`. Alerts are throttled
 * to one per hour per condition signature so a sustained outage does not spam.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPS_RECIPIENTS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];
const ADMIN_URL = "https://www.maisonaffluency.com/trade/admin/queue";

/** A pending event older than this means the queue is stalled. */
const STALL_MINUTES = 15;
/** No successful worker run in this long (while work exists) is also a stall. */
const HEARTBEAT_STALE_MINUTES = 30;
/** One alert per hour per condition signature. */
const ALERT_THROTTLE_MINUTES = 60;

interface HealthProbe {
  healthy: boolean;
  boot: { stripe: boolean; error: string | null };
  database: { ok: boolean; error: string | null };
  pending: number;
  oldest_pending_age_seconds: number;
}

export interface EvaluateArgs {
  probe: HealthProbe | null;
  probeError: string | null;
  lastSuccessAt: string | null;
  consecutiveFailures: number;
  now: Date;
}

export interface Evaluation {
  healthy: boolean;
  reasons: string[];
  signature: string;
  oldestPendingMinutes: number;
}

/** Pure decision logic — unit-assertable without network access. */
export function evaluateWorkerHealth(args: EvaluateArgs): Evaluation {
  const reasons: string[] = [];
  const probe = args.probe;
  const oldestPendingMinutes = Math.floor((probe?.oldest_pending_age_seconds ?? 0) / 60);

  if (args.probeError || !probe) {
    reasons.push(`Health probe unreachable: ${args.probeError ?? "no response"}`);
  } else {
    if (!probe.boot.stripe) reasons.push(`Startup check failed: ${probe.boot.error ?? "unknown"}`);
    if (!probe.database.ok) reasons.push(`Database unreachable: ${probe.database.error ?? "unknown"}`);
    if (oldestPendingMinutes >= STALL_MINUTES) {
      reasons.push(
        `Queue stalled: oldest pending event is ${oldestPendingMinutes} min old (${probe.pending} pending).`,
      );
    }
  }

  const pendingWork = (probe?.pending ?? 0) > 0;
  if (pendingWork) {
    const lastSuccessMs = args.lastSuccessAt ? new Date(args.lastSuccessAt).getTime() : null;
    const staleMinutes = lastSuccessMs
      ? Math.floor((args.now.getTime() - lastSuccessMs) / 60000)
      : null;
    if (staleMinutes === null) {
      reasons.push("No successful worker run has ever been recorded.");
    } else if (staleMinutes >= HEARTBEAT_STALE_MINUTES) {
      reasons.push(`Last successful worker run was ${staleMinutes} min ago while work is queued.`);
    }
  }

  if (args.consecutiveFailures >= 3) {
    reasons.push(`Worker has failed ${args.consecutiveFailures} consecutive invocations.`);
  }

  const signature = reasons
    .map((r) => r.replace(/\d+/g, "#"))
    .sort()
    .join(" | ");

  return { healthy: reasons.length === 0, reasons, signature, oldestPendingMinutes };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, serviceKey);
  const now = new Date();

  // ---- 1. Probe the worker ------------------------------------------------
  let probe: HealthProbe | null = null;
  let probeError: string | null = null;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/process-webhook-events?health=1`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    const text = await resp.text();
    try {
      probe = JSON.parse(text) as HealthProbe;
    } catch {
      probeError = `HTTP ${resp.status}: ${text.slice(0, 300)}`;
    }
    if (probe && !resp.ok && probe.healthy === undefined) {
      probeError = `HTTP ${resp.status}`;
      probe = null;
    }
  } catch (e) {
    probeError = e instanceof Error ? e.message : String(e);
  }

  // ---- 2. Heartbeat -------------------------------------------------------
  const { data: health } = await supabase
    .from("webhook_worker_health")
    .select("last_success_at, consecutive_failures, last_error, boot_ok")
    .eq("worker", "process-webhook-events")
    .maybeSingle();

  const evaluation = evaluateWorkerHealth({
    probe,
    probeError,
    lastSuccessAt: health?.last_success_at ?? null,
    consecutiveFailures: health?.consecutive_failures ?? 0,
    now,
  });

  const summary = {
    healthy: evaluation.healthy,
    reasons: evaluation.reasons,
    pending: probe?.pending ?? null,
    oldest_pending_minutes: evaluation.oldestPendingMinutes,
    last_success_at: health?.last_success_at ?? null,
    consecutive_failures: health?.consecutive_failures ?? 0,
    checked_at: now.toISOString(),
  };

  if (evaluation.healthy) {
    console.log("[WORKER-MONITOR] healthy", JSON.stringify(summary));
    return new Response(JSON.stringify({ ...summary, alerted: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  console.error("[WORKER-MONITOR] UNHEALTHY", JSON.stringify(summary));

  // ---- 3. Throttle --------------------------------------------------------
  const since = new Date(now.getTime() - ALERT_THROTTLE_MINUTES * 60_000).toISOString();
  const { data: recent } = await supabase
    .from("admin_alert_log")
    .select("id, payload, created_at")
    .eq("event", "webhook_worker_unhealthy")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);

  const alreadyAlerted = (recent ?? []).some(
    // deno-lint-ignore no-explicit-any
    (r: any) => r?.payload?.signature === evaluation.signature,
  );
  if (alreadyAlerted) {
    console.log("[WORKER-MONITOR] alert throttled (same signature within the hour)");
    return new Response(JSON.stringify({ ...summary, alerted: false, throttled: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  const headline = !probe || probeError
    ? "Queue worker health probe failed"
    : !probe.boot.stripe
    ? "Queue worker startup check failed"
    : evaluation.oldestPendingMinutes >= STALL_MINUTES
    ? `Queue stalled — oldest event ${evaluation.oldestPendingMinutes} min old`
    : "Queue worker is unhealthy";

  // ---- 4. Slack (primary) -------------------------------------------------
  let slack: "sent" | "failed" | "not_configured" = "not_configured";
  const webhook =
    Deno.env.get("SLACK_OPS_WEBHOOK_URL")?.trim() ||
    Deno.env.get("SLACK_LOGISTICS_WEBHOOK_URL")?.trim() ||
    Deno.env.get("SLACK_PAYMENTS_WEBHOOK_URL")?.trim();

  if (webhook) {
    try {
      const resp = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `⚠️ ${headline} — ${evaluation.reasons.join(" / ")}`,
          blocks: [
            { type: "header", text: { type: "plain_text", text: `⚠️ ${headline}` } },
            {
              type: "section",
              fields: [
                { type: "mrkdwn", text: `*Pending events*\n${probe?.pending ?? "unknown"}` },
                { type: "mrkdwn", text: `*Oldest pending*\n${evaluation.oldestPendingMinutes} min` },
                { type: "mrkdwn", text: `*Last success*\n${health?.last_success_at ?? "never"}` },
                { type: "mrkdwn", text: `*Consecutive failures*\n${health?.consecutive_failures ?? 0}` },
                { type: "mrkdwn", text: `*Startup check*\n${probe?.boot?.stripe === false ? "FAILED" : "OK"}` },
                { type: "mrkdwn", text: `*Checked at*\n${now.toISOString()}` },
              ],
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: `*Reasons*\n\`\`\`${evaluation.reasons.join("\n").slice(0, 900)}\`\`\`` },
            },
            {
              type: "actions",
              elements: [{
                type: "button",
                text: { type: "plain_text", text: "Open queue control centre" },
                url: ADMIN_URL,
                style: "danger",
              }],
            },
          ],
        }),
      });
      slack = resp.ok ? "sent" : "failed";
    } catch (e) {
      slack = "failed";
      console.error("[WORKER-MONITOR] Slack post failed:", e);
    }
  }

  // ---- 5. Email fallback (always) ----------------------------------------
  let email: "sent" | "failed" = "sent";
  try {
    const idempotencyKey = `worker-unhealthy-${now.toISOString().slice(0, 13)}-${
      evaluation.signature.slice(0, 40)
    }`;
    const results = await Promise.all(
      OPS_RECIPIENTS.map((recipient) =>
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "webhook-worker-unhealthy",
            recipientEmail: recipient,
            idempotencyKey,
            templateData: {
              headline,
              reasons: evaluation.reasons,
              bootOk: probe?.boot?.stripe !== false,
              databaseOk: probe?.database?.ok !== false,
              pending: probe?.pending ?? 0,
              oldestPendingMinutes: evaluation.oldestPendingMinutes,
              lastSuccessAt: health?.last_success_at ?? null,
              consecutiveFailures: health?.consecutive_failures ?? 0,
              errorMessage: probeError ?? probe?.boot?.error ?? health?.last_error ?? null,
              timestamp: now.toISOString(),
              adminUrl: ADMIN_URL,
              slackStatus: slack,
            },
          },
        })
      ),
    );
    // deno-lint-ignore no-explicit-any
    if (results.find((r: any) => r?.error)) email = "failed";
  } catch (e) {
    email = "failed";
    console.error("[WORKER-MONITOR] ops email failed:", e);
  }

  // ---- 6. Audit -----------------------------------------------------------
  try {
    await supabase.from("admin_alert_log").insert({
      channel: slack === "sent" ? "slack" : "email",
      event: "webhook_worker_unhealthy",
      status: slack === "sent" || email === "sent" ? "sent" : "failed",
      payload: { ...summary, signature: evaluation.signature, headline, slack, email },
      error: evaluation.reasons.join(" | ").slice(0, 2000),
    });
  } catch (e) {
    console.error("[WORKER-MONITOR] admin_alert_log insert failed:", e);
  }

  return new Response(JSON.stringify({ ...summary, alerted: true, slack, email }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
