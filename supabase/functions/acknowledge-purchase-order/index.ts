import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGISTICS_RECIPIENTS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];

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

/**
 * One-click designer acknowledgement of a purchase order.
 * The PO email links here with ?token=<ack_token>. No login required.
 * Records acknowledged_at and alerts the internal logistics team by email.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token && req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.token === "string") token = body.token;
  }
  token = token.trim();
  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return page("Invalid link", "This acknowledgement link is not valid. Please use the button in your purchase order email.");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: po, error } = await supabase
    .from("designer_purchase_orders")
    .select("id, po_number, designer_name, designer_email, acknowledged_at, currency, total_purchase_cost_cogs, line_count")
    .eq("ack_token", token)
    .maybeSingle();

  if (error) {
    console.error("[PO-ACK] lookup failed:", error.message);
    return page("Something went wrong", "We could not record your acknowledgement. Please reply to the purchase order email instead.");
  }
  if (!po) {
    return page("Invalid link", "This acknowledgement link is not valid. Please use the button in your purchase order email.");
  }

  if (po.acknowledged_at) {
    return page(
      "Already confirmed",
      `Receipt of purchase order <strong>${po.po_number}</strong> was already confirmed on ${new Date(po.acknowledged_at).toUTCString()}. No further action is needed.`,
    );
  }

  const acknowledgedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("designer_purchase_orders")
    .update({ acknowledged_at: acknowledgedAt, updated_at: acknowledgedAt })
    .eq("id", po.id)
    .is("acknowledged_at", null);
  if (updErr) {
    console.error("[PO-ACK] update failed:", updErr.message);
    return page("Something went wrong", "We could not record your acknowledgement. Please reply to the purchase order email instead.");
  }

  // Internal logistics alert — one send per recipient.
  const money = `${String(po.currency ?? "usd").toUpperCase()} ${((po.total_purchase_cost_cogs ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  for (const recipient of LOGISTICS_RECIPIENTS) {
    const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "po-acknowledged-internal",
        recipientEmail: recipient,
        idempotencyKey: `po-ack-${po.po_number}-${recipient}`,
        templateData: {
          designerName: po.designer_name ?? "Designer",
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
