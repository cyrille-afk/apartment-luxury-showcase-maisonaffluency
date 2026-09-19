/**
 * Internal payment alerts (Slack + email + WhatsApp).
 *
 * These used to run inline inside `stripe-webhook`, where a slow Slack or
 * Twilio call could push the handler past Stripe's timeout and cause a retry
 * storm. They now live behind the async queue and are executed by the
 * `notify-payment-alerts` function, invoked by `process-webhook-events`.
 *
 * Every path is idempotent: emails carry a deterministic idempotencyKey keyed
 * on the Stripe session / payment intent, so a replay never double-sends.
 */

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { formatCurrency } from "./transactional-email-templates/currency.ts";
import { sendAdminWhatsApp } from "./twilioWhatsAppSender.ts";

type Supa = ReturnType<typeof createClient>;

const INTERNAL_RECIPIENTS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];
const FUNNEL_URL = "https://www.maisonaffluency.com/trade/admin/sales-funnel";

const fmt = (cents: number) =>
  ((cents ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface InternalPaymentArgs {
  label: string;
  amountCents: number;
  currency: string;
  payerEmail?: string | null;
  quoteRef?: string | null;
  cardStage?: string | null;
  paymentIntentId: string;
  sessionId?: string | null;
}

export async function notifyInternalPaymentReceived(supabase: Supa, args: InternalPaymentArgs) {
  try {
    const templateData = {
      label: args.label,
      amountFormatted: fmt(args.amountCents),
      currency: (args.currency || "USD").toUpperCase(),
      payerEmail: args.payerEmail ?? null,
      quoteRef: args.quoteRef ?? null,
      cardStage: args.cardStage ?? null,
      sessionId: args.sessionId ?? args.paymentIntentId,
      paidAt: new Date().toISOString(),
      funnelUrl: FUNNEL_URL,
    };

    const idempotencyKey = `funnel-payment-received-internal-${args.paymentIntentId}`;

    for (const recipient of INTERNAL_RECIPIENTS) {
      const { error } = await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "funnel-payment-received-internal",
          recipientEmail: recipient,
          idempotencyKey,
          templateData,
        },
      });
      if (error) console.error(`[PAYMENT-ALERTS] internal payment notify failed for ${recipient}:`, error);
    }
  } catch (e) {
    console.error("[PAYMENT-ALERTS] notifyInternalPaymentReceived error:", e);
    throw e;
  }
}

export interface DepositClearedArgs {
  quoteId: string;
  paymentKind: "deposit" | "balance";
  amountCents: number;
  currency: string;
  payerEmail?: string | null;
  sessionId: string;
  isLive: boolean;
}

/**
 * 🚨 Deposit-cleared team alert.
 * Slack (SLACK_PAYMENTS_WEBHOOK_URL → SLACK_LOGISTICS_WEBHOOK_URL) + internal
 * email + WhatsApp broadcast. Test-mode sessions are tagged "[TEST ALERT]".
 */
export async function notifyDepositCleared(supabase: Supa, args: DepositClearedArgs) {
  const { data: quote } = await supabase
    .from("trade_quotes")
    .select("client_name, currency, ship_to_email, client_id")
    .eq("id", args.quoteId)
    .maybeSingle();

  const clientName = (quote?.client_name as string | null)?.trim() || "Client";
  const currency = (args.currency || (quote?.currency as string) || "USD").toUpperCase();

  const { data: items } = await supabase
    .from("trade_quote_items")
    .select("product_id, quantity")
    .eq("quote_id", args.quoteId);

  let itemsSummary = "";
  if (items && items.length > 0) {
    const pickIds = [...new Set(items.map((i: any) => i.product_id).filter(Boolean))];
    const { data: picks } = pickIds.length
      ? await supabase.from("designer_curator_picks").select("id, title, designer_name").in("id", pickIds)
      : { data: [] as any[] };
    const byId = new Map((picks ?? []).map((p: any) => [p.id, p]));
    itemsSummary = items
      .map((i: any) => {
        const p: any = byId.get(i.product_id);
        const title = [p?.designer_name, p?.title].filter(Boolean).join(" ") || "Item";
        return `${i.quantity ?? 1} × ${title}`;
      })
      .join(", ");
  }

  const quoteRef = args.quoteId.slice(0, 8);
  const amountFormatted = fmt(args.amountCents);
  const headline = args.paymentKind === "balance" ? "BALANCE CLEARED" : "NEW DEPOSIT CLEARED";
  const alertLine =
    `${args.isLive ? "🚨" : "🧪 [TEST ALERT]"} ${headline}: Quote ${quoteRef} for ${clientName} ` +
    `has successfully paid ${formatCurrency(amountFormatted, currency)} via Stripe.` +
    (itemsSummary ? `\nItems: ${itemsSummary}` : "") +
    `\nReview: ${FUNNEL_URL}`;

  // ----- 1) Slack / Teams outgoing webhook (optional) -----
  const slackWebhook =
    Deno.env.get("SLACK_PAYMENTS_WEBHOOK_URL")?.trim() ||
    Deno.env.get("SLACK_LOGISTICS_WEBHOOK_URL")?.trim();
  if (slackWebhook) {
    try {
      const resp = await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: alertLine,
          blocks: [
            { type: "section", text: { type: "mrkdwn", text: alertLine } },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Open Sales Funnel" },
                  url: FUNNEL_URL,
                  style: "primary",
                },
              ],
            },
          ],
        }),
      });
      if (!resp.ok) console.error(`[PAYMENT-ALERTS] deposit Slack alert HTTP ${resp.status}`);
      else console.log("[PAYMENT-ALERTS] Deposit alert posted to Slack");
    } catch (e) {
      console.error("[PAYMENT-ALERTS] deposit Slack alert failed:", e);
    }
  } else {
    console.warn("[PAYMENT-ALERTS] No SLACK_PAYMENTS_WEBHOOK_URL configured; email alert only.");
  }

  // ----- 2) Internal email alert (always) -----
  const templateData = {
    headline,
    clientName,
    quoteRef,
    amountFormatted,
    currency,
    itemsSummary: itemsSummary || "—",
    payerEmail: args.payerEmail ?? (quote?.ship_to_email as string | null) ?? null,
    paymentKind: args.paymentKind,
    isLive: args.isLive,
    paidAt: new Date().toISOString(),
    funnelUrl: FUNNEL_URL,
  };
  const idempotencyKey = `deposit-cleared-internal-${args.sessionId}`;
  for (const recipient of INTERNAL_RECIPIENTS) {
    const { error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "deposit-cleared-internal",
        recipientEmail: recipient,
        idempotencyKey,
        templateData,
      },
    });
    if (error) console.error(`[PAYMENT-ALERTS] deposit alert email failed for ${recipient}:`, error);
  }

  // ----- 3) WhatsApp operational broadcast -----
  const whatsappBody = [
    `${args.isLive ? "🚨" : "🧪 [TEST ALERT]"} ${headline}`,
    ``,
    `Quote ${quoteRef} for ${clientName} has successfully paid ${formatCurrency(amountFormatted, currency)} via Stripe.`,
    itemsSummary ? `Items: ${itemsSummary}` : null,
    ``,
    `Review: ${FUNNEL_URL}`,
  ].filter(Boolean).join("\n");

  try {
    const waResult = await sendAdminWhatsApp({ body: whatsappBody });
    if (!waResult.ok) console.error(`[PAYMENT-ALERTS] deposit WhatsApp alert failed: ${waResult.error}`);
    else console.log("[PAYMENT-ALERTS] Deposit alert posted to WhatsApp");

    await supabase.from("admin_alert_log").insert({
      channel: "twilio_whatsapp",
      event: args.paymentKind === "balance" ? "deposit_balance_cleared" : "deposit_cleared",
      status: waResult.ok ? "sent" : "failed",
      provider_message_id: waResult.sid,
      payload: {
        quote_id: args.quoteId,
        session_id: args.sessionId,
        client_name: clientName,
        amount_cents: args.amountCents,
        currency,
        items_summary: itemsSummary,
        is_live: args.isLive,
        funnel_url: FUNNEL_URL,
      },
      error: waResult.error,
    });
  } catch (e) {
    console.error("[PAYMENT-ALERTS] deposit WhatsApp alert error:", e);
  }
}
