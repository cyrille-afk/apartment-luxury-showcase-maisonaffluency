import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Stores the generated pro-forma invoice PDF in the private `proforma-invoices`
 * bucket and emails the buyer a signed download link (attachments are not
 * supported by the email pipeline).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const body = await req.json().catch(() => ({}));
    const orderRef = str(body?.orderRef, 64);
    const orderId = str(body?.orderId, 64);
    const recipientEmail = str(body?.recipientEmail, 200);
    const recipientName = str(body?.recipientName, 160);
    const currency = (str(body?.currency, 8) || "usd").toUpperCase();
    const channelLabel = str(body?.channelLabel, 80) || "Bank transfer";
    const totalCents = Math.round(Number(body?.totalCents));
    const pdfBase64 = typeof body?.pdfBase64 === "string" ? body.pdfBase64 : "";

    if (!orderRef || !recipientEmail.includes("@")) {
      return json({ error: "Order reference and a valid email are required." }, 400);
    }

    /* Store the PDF (best effort — never block the email on storage). */
    let downloadUrl: string | null = null;
    if (pdfBase64) {
      try {
        const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
        const path = `orders/${orderRef}/proforma-${Date.now()}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("proforma-invoices")
          .upload(path, bytes, { contentType: "application/pdf", upsert: true });
        if (upErr) throw upErr;

        const { data: signed } = await supabase.storage
          .from("proforma-invoices")
          .createSignedUrl(path, 60 * 60 * 24 * 30);
        downloadUrl = signed?.signedUrl ?? null;

        if (orderId) {
          await supabase.from("shop_orders").update({ proforma_invoice_path: path }).eq("id", orderId);
        }
      } catch (storageErr) {
        console.error("Pro-forma storage failed:", storageErr);
      }
    }

    const totalFormatted = Number.isFinite(totalCents)
      ? new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
          totalCents / 100,
        )
      : "—";

    const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "proforma-invoice",
        recipientEmail,
        idempotencyKey: `proforma-${orderRef}`,
        templateData: {
          recipientName,
          orderRef,
          currency,
          totalFormatted,
          channelLabel,
          downloadUrl,
        },
      },
    });
    if (mailErr) {
      console.error("send-transactional-email failed:", mailErr);
      return json({ error: "Invoice stored but the email could not be sent.", downloadUrl }, 502);
    }

    return json({ ok: true, downloadUrl });
  } catch (err) {
    console.error("send-proforma-invoice error:", err);
    return json({ error: "Unexpected error." }, 500);
  }
});
