import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGISTICS_EMAIL = "logistics@maisonaffluency.com";
const INTERNAL_RECIPIENTS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];
const ACKNOWLEDGED_STATUS = "PO Acknowledged by Designer";

const page = (title: string, body: string) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f7f6f3;font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="background:#ffffff;max-width:520px;margin:24px;padding:48px 44px;text-align:center;border-top:3px solid #12352c;">
    <div style="font-family:Arial,sans-serif;font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#6e6e6e;margin-bottom:18px;">Maison Affluency · Trade Procurement</div>
    <h1 style="font-size:22px;font-weight:400;margin:0 0 14px;">${title}</h1>
    <p style="font-size:15px;line-height:24px;color:#2a2a2a;margin:0;">${body}</p>
  </div>
</body></html>`,
    { status: 200, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } },
  );

const invalidLink = () =>
  page("Invalid link", "This acknowledgement link is not valid. Please use the button in your purchase order email.");

async function postSlackAlert(webhookUrl: string, payload: {
  poNumber: string; designerName: string; totalCost: string; fulfillmentStatus: string;
}) {
  const body = {
    text: `📦 Designer PO Acknowledged — ${payload.poNumber}`,
    blocks: [
      { type: "header", text: { type: "plain_text", text: "📦 Designer PO Acknowledged", emoji: true } },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*PO Number*\n${payload.poNumber}` },
          { type: "mrkdwn", text: `*Designer*\n${payload.designerName}` },
          { type: "mrkdwn", text: `*Total Wholesale Value*\n${payload.totalCost}` },
          { type: "mrkdwn", text: `*Fulfillment Status*\n${payload.fulfillmentStatus}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "Designer has explicitly confirmed receipt of PO. Logistics team can now safely coordinate freight pick-up timelines.",
        },
      },
    ],
  };
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Slack webhook ${res.status}: ${await res.text()}`);
}

/**
 * One-click designer acknowledgement of a purchase order.
 * GET /functions/v1/acknowledge-purchase-order/:po_id?token=<acknowledgment_token>
 * (legacy ?token=<uuid> form is also accepted). No login required.
 * Records acknowledged_at, flips payables to 'PO Acknowledged by Designer',
 * posts a Slack logistics alert and emails the logistics team.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const segments = url.pathname.split("/").filter(Boolean);
  // Path form: .../acknowledge-purchase-order/<po_id>
  const fnIdx = segments.indexOf("acknowledge-purchase-order");
  const poId = fnIdx >= 0 && segments.length > fnIdx + 1 ? segments[fnIdx + 1] : null;

  let token = url.searchParams.get("token") ?? "";
  if (!token && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.token === "string") token = body.token;
  }
  token = token.trim();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return invalidLink();
  if (poId && !/^[0-9a-f-]{36}$/i.test(poId)) return invalidLink();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  let query = supabase
    .from("designer_purchase_orders")
    .select("id, po_number, designer_name, designer_email, acknowledged_at, currency, total_purchase_cost_cogs, line_count")
    .or(`acknowledgment_token.eq.${token},ack_token.eq.${token}`);
  if (poId) query = query.eq("id", poId);

  const { data: po, error } = await query.maybeSingle();

  if (error) {
    console.error("[PO-ACK] lookup failed:", error.message);
    return page("Something went wrong", "We could not record your acknowledgement. Please reply to the purchase order email instead.");
  }
  if (!po) return invalidLink();

  if (po.acknowledged_at) {
    return page(
      "Already confirmed",
      `Receipt of purchase order <strong>${po.po_number}</strong> was already confirmed on ${new Date(po.acknowledged_at).toUTCString()}. No further action is needed.`,
    );
  }

  const acknowledgedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("designer_purchase_orders")
    .update({ acknowledged_at: acknowledgedAt, requires_manual_followup: false, updated_at: acknowledgedAt })
    .eq("id", po.id)
    .is("acknowledged_at", null);
  if (updErr) {
    console.error("[PO-ACK] update failed:", updErr.message);
    return page("Something went wrong", "We could not record your acknowledgement. Please reply to the purchase order email instead.");
  }

  // Flip the payables ledger lines out of 'Pending Invoice Match'.
  const { error: payablesErr } = await supabase
    .from("purchase_orders_payable")
    .update({
      designer_invoice_status: ACKNOWLEDGED_STATUS,
      requires_manual_followup: false,
      followup_flagged_at: null,
      updated_at: acknowledgedAt,
    })
    .eq("purchase_order_id", po.id)
    .eq("designer_invoice_status", "pending_invoice_match");
  if (payablesErr) console.error("[PO-ACK] payables status update failed:", payablesErr.message);

  // Clear any escalation flag raised by the 48-hour follow-up worker.
  await supabase
    .from("purchase_orders_payable")
    .update({ requires_manual_followup: false, followup_flagged_at: null, updated_at: acknowledgedAt })
    .eq("purchase_order_id", po.id)
    .eq("requires_manual_followup", true);

  const money = `${String(po.currency ?? "usd").toUpperCase()} ${((po.total_purchase_cost_cogs ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  const alertPayload = {
    poNumber: po.po_number,
    designerName: po.designer_name ?? "Designer",
    totalCost: money,
    fulfillmentStatus: ACKNOWLEDGED_STATUS,
  };

  // Slack logistics alert (skipped gracefully until the webhook secret is configured).
  const slackWebhook = Deno.env.get("SLACK_LOGISTICS_WEBHOOK_URL")?.trim();
  if (slackWebhook) {
    try {
      await postSlackAlert(slackWebhook, alertPayload);
    } catch (e) {
      console.error("[PO-ACK] Slack alert failed:", (e as Error).message);
    }
  } else {
    console.warn("[PO-ACK] SLACK_LOGISTICS_WEBHOOK_URL not configured; skipping Slack alert.");
  }

  // Logistics team email with the alert subject line.
  const { error: logisticsErr } = await supabase.functions.invoke("send-transactional-email", {
    body: {
      templateName: "po-logistics-alert",
      recipientEmail: LOGISTICS_EMAIL,
      idempotencyKey: `po-logistics-${po.po_number}`,
      templateData: {
        poNumber: po.po_number,
        designerName: alertPayload.designerName,
        designerEmail: po.designer_email ?? null,
        acknowledgedAt: new Date(acknowledgedAt).toUTCString(),
        totalCost: money,
        fulfillmentStatus: ACKNOWLEDGED_STATUS,
      },
    },
  });
  if (logisticsErr) console.error(`[PO-ACK] logistics alert failed:`, logisticsErr.message ?? logisticsErr);

  // Existing internal alert — one send per recipient.
  for (const recipient of INTERNAL_RECIPIENTS) {
    const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "po-acknowledged-internal",
        recipientEmail: recipient,
        idempotencyKey: `po-ack-${po.po_number}-${recipient}`,
        templateData: {
          designerName: alertPayload.designerName,
          designerEmail: po.designer_email ?? null,
          poNumber: po.po_number,
          acknowledgedAt: new Date(acknowledgedAt).toUTCString(),
          totalCost: money,
          lineCount: po.line_count ?? 1,
        },
      },
    });
    if (mailErr) console.error(`[PO-ACK] alert to ${recipient} failed:`, mailErr.message ?? mailErr);
  }

  return page(
    "Receipt confirmed",
    `Thank you — receipt of purchase order <strong>${po.po_number}</strong> has been recorded and the Maison Affluency logistics team has been notified. Kindly issue your invoice quoting this reference.`,
  );
});
