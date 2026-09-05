import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["cyrille@maisonaffluency.com", "gregoire@maisonaffluency.com"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Records a bank-wire purchase request (1.5% concierge discount) and alerts the
 * team so wiring instructions can be issued manually.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseAnon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      );
      const { data } = await supabaseAnon.auth.getClaims(authHeader.replace("Bearer ", ""));
      const claims = data?.claims as Record<string, unknown> | undefined;
      if (claims?.sub) userId = String(claims.sub);
    }

    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
    const designer = typeof body?.designer === "string" ? body.designer.trim().slice(0, 120) : "";
    const finish = typeof body?.selectedFinish === "string" ? body.selectedFinish.slice(0, 250) : "";
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 160) : "";
    const email =
      typeof body?.email === "string" && body.email.includes("@") ? body.email.trim().slice(0, 200) : "";
    const phone = typeof body?.phone === "string" ? body.phone.trim().slice(0, 60) : "";
    const address = typeof body?.address === "string" ? body.address.trim().slice(0, 600) : "";
    const amountCents = Math.round(Number(body?.amountCents));

    if (!title) return json({ error: "Product is required." }, 400);
    if (!name || !email) return json({ error: "Name and email are required." }, 400);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return json({ error: "A valid amount is required." }, 400);
    }

    const reference = `WIRE-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { error: insertErr } = await supabase.from("orders").insert({
      user_id: userId,
      product_name: title,
      selected_finish: finish || null,
      customer_email: email,
      transaction_id: reference,
      amount_total: amountCents,
      currency: (typeof body?.currency === "string" ? body.currency : "usd").toLowerCase(),
      status: "wire_pending",
    });
    if (insertErr) {
      console.error("[request-wire-transfer] insert failed", insertErr);
      return json({ error: "Unable to record your request." }, 500);
    }

    const amountLabel = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(amountCents / 100);

    try {
      await sendLovableEmail({
        to: ADMIN_EMAILS,
        label: "wire-transfer-request",
        idempotencyKey: `wire-${reference}`,
        subject: `🏦 Wire transfer request ${reference} — ${title}`,
        html: `
          <div style="font-family:Georgia,serif;color:#14201c;">
            <h2 style="font-weight:400;">Bank wire purchase request</h2>
            <p><strong>Reference:</strong> ${escapeHtml(reference)}</p>
            <p><strong>Product:</strong> ${escapeHtml(designer)} ${escapeHtml(title)}<br/>
            <strong>Finish:</strong> ${escapeHtml(finish || "—")}<br/>
            <strong>Total (incl. 1.5% concierge discount):</strong> ${escapeHtml(amountLabel)}</p>
            <p><strong>Client:</strong> ${escapeHtml(name)}<br/>
            ${escapeHtml(email)}<br/>${escapeHtml(phone || "—")}</p>
            <p><strong>Delivery address:</strong><br/>${escapeHtml(address || "—")}</p>
          </div>`,
      });
    } catch (mailErr) {
      console.error("[request-wire-transfer] email failed", mailErr);
    }

    return json({ reference });
  } catch (err) {
    console.error("[request-wire-transfer] error", err);
    return json({ error: "Unable to submit your request." }, 500);
  }
});
