/**
 * Parked-job critical alert ("Parked Order Financial Trap" safeguard).
 *
 * Fired by the asynchronous queue worker at the exact moment a job exhausts its
 * exponential backoff pool (15s → 1m → 5m → 30m → 2h) and is parked as
 * `failed` / manual review. Without this, a paid order can silently stop
 * halfway through fulfilment (no supplier PO, no client email) with nobody
 * watching the queue table.
 *
 * Channels:
 *   1. Slack incoming webhook (rich Block Kit payload) — primary.
 *   2. Email to the operations alias — always sent when Slack is missing or
 *      failed, so a Slack outage or network blackout still surfaces the trap.
 * Every attempt is written to `admin_alert_log` for auditability.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";

// deno-lint-ignore no-explicit-any
type Supa = any;

export const OPS_RECIPIENTS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];
const ADMIN_BASE = "https://www.maisonaffluency.com/trade/admin";

export interface ParkedJobArgs {
  /** webhook_events.id (queue row) — used as the idempotency anchor. */
  queueRowId: string;
  /** Stripe event id. */
  eventId: string;
  eventType: string;
  attempts: number;
  maxAttempts: number;
  error: unknown;
  /** Raw Stripe event payload, used to recover quote/order context. */
  payload?: unknown;
  now?: Date;
}

export interface ParkedJobContext {
  quoteId: string | null;
  orderId: string | null;
  clientName: string;
  clientEmail: string | null;
  adminUrl: string;
}

/**
 * Best-effort classification of which downstream service blew up, from the
 * thrown error text. Keeps the Slack payload actionable ("Twilio is down")
 * instead of a bare stack trace.
 */
export function classifyFailedService(error: unknown): string {
  const msg = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  const table: Array<[RegExp, string]> = [
    [/twilio|whatsapp/, "Twilio / WhatsApp"],
    [/resend|send-transactional-email|email queue|transactional_emails/, "Resend / Email"],
    [/slack/, "Slack"],
    [/purchase[- _]?order|\bpo\b|dispatch-designer/, "Supplier PO Dispatch"],
    [/pdf|pdf-lib|fontkit/, "PDF Generator"],
    [/stripe/, "Stripe API"],
    [/storage|bucket|signed url/, "Storage"],
    [/supabase|postgres|pgrst|row-level security/, "Database"],
  ];
  for (const [re, label] of table) if (re.test(msg)) return label;
  return "Queue Worker (unclassified)";
}

/** Pull quote/order identity out of the Stripe payload, then enrich from the DB. */
export async function resolveParkedJobContext(
  supabase: Supa,
  payload: unknown,
): Promise<ParkedJobContext> {
  // deno-lint-ignore no-explicit-any
  const obj: any = (payload as any)?.data?.object ?? {};
  const meta = obj?.metadata ?? {};
  const quoteId: string | null = meta.quote_id ?? meta.quoteId ?? null;
  const orderId: string | null = meta.order_id ?? meta.shop_order_id ?? obj?.id ?? null;

  let clientName = meta.client_name ?? "";
  let clientEmail: string | null =
    obj?.customer_details?.email ?? obj?.receipt_email ?? meta.client_email ?? null;

  if (quoteId) {
    try {
      const { data } = await supabase
        .from("trade_quotes")
        .select("client_name, ship_to_email")
        .eq("id", quoteId)
        .maybeSingle();
      if (data?.client_name) clientName = data.client_name;
      if (!clientEmail && data?.ship_to_email) clientEmail = data.ship_to_email;
    } catch {
      /* context enrichment is best-effort — never block the alert */
    }
  }

  return {
    quoteId,
    orderId,
    clientName: (clientName || "").trim() || "Unknown client",
    clientEmail,
    adminUrl: quoteId ? `${ADMIN_BASE}/quotes/${quoteId}` : `${ADMIN_BASE}/sales-funnel`,
  };
}

/** Slack Block Kit payload — exported so its shape can be unit-asserted. */
export function buildSlackBlocks(args: {
  ctx: ParkedJobContext;
  service: string;
  errorMessage: string;
  eventId: string;
  eventType: string;
  attempts: number;
  timestamp: string;
}) {
  const ref = args.ctx.quoteId ?? args.ctx.orderId ?? args.eventId;
  const headline = `🛑 PARKED JOB — manual review required (${ref.slice(0, 12)})`;
  return {
    text: `${headline} — ${args.service} failed: ${args.errorMessage}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "🛑 Parked job — manual review" } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Order / Quote*\n${ref}` },
          { type: "mrkdwn", text: `*Client*\n${args.ctx.clientName}` },
          { type: "mrkdwn", text: `*Failed service*\n${args.service}` },
          { type: "mrkdwn", text: `*Attempts*\n${args.attempts} (backoff exhausted)` },
          { type: "mrkdwn", text: `*Event*\n${args.eventType} · ${args.eventId}` },
          { type: "mrkdwn", text: `*Timestamp*\n${args.timestamp}` },
        ],
      },
      {
        type: "section",
        text: { type: "mrkdwn", text: `*Error*\n\`\`\`${args.errorMessage.slice(0, 900)}\`\`\`` },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Open in admin dashboard" },
            url: args.ctx.adminUrl,
            style: "danger",
          },
        ],
      },
    ],
  };
}

export interface ParkedJobAlertResult {
  slack: "sent" | "failed" | "not_configured";
  email: "sent" | "failed" | "skipped";
  service: string;
}

/**
 * Dispatch the critical alert. Never throws: an alerting failure must not
 * corrupt the worker loop or the queue row state.
 */
export async function notifyParkedQueueJob(
  supabase: Supa,
  args: ParkedJobArgs,
): Promise<ParkedJobAlertResult> {
  const now = args.now ?? new Date();
  const timestamp = now.toISOString();
  const errorMessage = (args.error instanceof Error ? args.error.message : String(args.error ?? ""))
    .slice(0, 2000) || "(no error message)";
  const service = classifyFailedService(args.error);

  let ctx: ParkedJobContext = {
    quoteId: null,
    orderId: null,
    clientName: "Unknown client",
    clientEmail: null,
    adminUrl: `${ADMIN_BASE}/sales-funnel`,
  };
  try {
    ctx = await resolveParkedJobContext(supabase, args.payload);
  } catch (e) {
    console.error("[PARKED-ALERT] context resolution failed:", e);
  }

  // ---------- 1) Slack ----------
  let slack: ParkedJobAlertResult["slack"] = "not_configured";
  const webhook =
    Deno.env.get("SLACK_OPS_WEBHOOK_URL")?.trim() ||
    Deno.env.get("SLACK_LOGISTICS_WEBHOOK_URL")?.trim() ||
    Deno.env.get("SLACK_PAYMENTS_WEBHOOK_URL")?.trim();

  const body = buildSlackBlocks({
    ctx,
    service,
    errorMessage,
    eventId: args.eventId,
    eventType: args.eventType,
    attempts: args.attempts,
    timestamp,
  });

  if (webhook) {
    try {
      const resp = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      slack = resp.ok ? "sent" : "failed";
      if (!resp.ok) console.error(`[PARKED-ALERT] Slack HTTP ${resp.status}`);
    } catch (e) {
      slack = "failed";
      console.error("[PARKED-ALERT] Slack post failed:", e);
    }
  } else {
    console.warn("[PARKED-ALERT] No Slack webhook configured; email fallback only.");
  }

  // ---------- 2) Email fallback (always, so a Slack blackout is covered) ----------
  let email: ParkedJobAlertResult["email"] = "skipped";
  try {
    const templateData = {
      reference: ctx.quoteId ?? ctx.orderId ?? args.eventId,
      quoteId: ctx.quoteId,
      orderId: ctx.orderId,
      clientName: ctx.clientName,
      clientEmail: ctx.clientEmail,
      failedService: service,
      errorMessage,
      eventId: args.eventId,
      eventType: args.eventType,
      attempts: args.attempts,
      maxAttempts: args.maxAttempts,
      timestamp,
      adminUrl: ctx.adminUrl,
      slackStatus: slack,
    };
    const idempotencyKey = `queue-job-parked-${args.queueRowId}`;
    const results = await Promise.all(
      OPS_RECIPIENTS.map((recipient) =>
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "queue-job-parked",
            recipientEmail: recipient,
            idempotencyKey,
            templateData,
          },
        }),
      ),
    );
    // deno-lint-ignore no-explicit-any
    const anyError = results.find((r: any) => r?.error);
    email = anyError ? "failed" : "sent";
    if (anyError) console.error("[PARKED-ALERT] ops email failed:", anyError.error);
  } catch (e) {
    email = "failed";
    console.error("[PARKED-ALERT] ops email error:", e);
  }

  // ---------- 3) Audit trail ----------
  try {
    await supabase.from("admin_alert_log").insert({
      channel: slack === "sent" ? "slack" : "email",
      event: "queue_job_parked",
      status: slack === "sent" || email === "sent" ? "sent" : "failed",
      payload: {
        queue_row_id: args.queueRowId,
        event_id: args.eventId,
        event_type: args.eventType,
        quote_id: ctx.quoteId,
        order_id: ctx.orderId,
        client_name: ctx.clientName,
        failed_service: service,
        attempts: args.attempts,
        max_attempts: args.maxAttempts,
        admin_url: ctx.adminUrl,
        slack: slack,
        email: email,
        timestamp,
      },
      error: slack === "failed" || email === "failed" ? errorMessage : null,
    });
  } catch (e) {
    console.error("[PARKED-ALERT] admin_alert_log insert failed:", e);
  }

  console.error(
    `[PARKED-ALERT] job parked — service=${service} slack=${slack} email=${email} ref=${
      ctx.quoteId ?? ctx.orderId ?? args.eventId
    }`,
  );

  return { slack, email, service };
}

/** Convenience client factory for standalone invocation/tests. */
export function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}
