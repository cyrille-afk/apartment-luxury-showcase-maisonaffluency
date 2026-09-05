import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { sendLovableEmail } from "../_shared/lovableEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

/** Escape HTML special characters to prevent injection in admin email bodies. */
function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatAmount(amountCents: unknown, currency: unknown): string {
  const cents = Number(amountCents);
  const cur = (typeof currency === "string" && currency ? currency : "usd").toUpperCase();
  if (!Number.isFinite(cents)) return `— ${cur}`;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cur,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${cur}`;
  }
}

function formatDate(value: unknown): string {
  const d = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toUTCString();
  return `${d.toISOString().slice(0, 10)} at ${d.toISOString().slice(11, 16)} UTC`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only the database trigger (service-role bearer) may reach this endpoint.
  const authHeader = req.headers.get("Authorization") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!serviceKey || authHeader !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const productName = String(body?.product_name ?? "Unknown product");
    const finish = body?.selected_finish ? String(body.selected_finish) : "—";
    const customerEmail = body?.customer_email ? String(body.customer_email) : "—";
    const transactionId = body?.transaction_id ? String(body.transaction_id) : "—";
    const status = body?.status ? String(body.status) : "—";
    const amount = formatAmount(body?.amount_total, body?.currency);
    const placedAt = formatDate(body?.created_at);

    const subjectProduct = productName.replace(/[\r\n]+/g, " ").slice(0, 120);
    const subject = `🚨 NEW LUXURY ORDER COMPLETED - ${subjectProduct}`;

    const row = (label: string, value: string) => `
      <tr>
        <td style="font-weight:600;width:170px;vertical-align:top;padding:6px 0;">${escapeHtml(label)}</td>
        <td style="padding:6px 0;">${escapeHtml(value)}</td>
      </tr>`;

    const html = `
      <div style="font-family:'Georgia',serif;max-width:600px;margin:0 auto;padding:32px;background:#faf9f7;">
        <h2 style="font-size:20px;color:#1a1a1a;margin:0 0 8px;">🚨 New Luxury Order Completed</h2>
        <p style="font-size:13px;color:#777;margin:0 0 24px;">Immediate action required — confirm logistics with the client.</p>
        <div style="background:#ffffff;border:1px solid #e8e5e0;border-radius:4px;padding:24px;">
          <table style="width:100%;font-size:14px;color:#333;line-height:1.6;">
            ${row("Product ordered", productName)}
            ${row("Selected finish", finish)}
            ${row("Order total", amount)}
            ${row("Customer email", customerEmail)}
            ${row("Date & time", placedAt)}
            ${row("Transaction ID", transactionId)}
            ${row("Status", status)}
          </table>
        </div>
        <p style="font-size:11px;color:#999;margin-top:24px;text-align:center;">
          Maison Affluency — Admin Notification
        </p>
      </div>
    `;

    const emailResult = await sendLovableEmail({
      to: ADMIN_EMAILS,
      subject,
      html,
      label: "new-order-notification",
    });

    const errors = emailResult.failed.map((f) => `${f.email}: ${f.error}`);

    if (errors.length) console.error("[notify-new-order] send errors", errors);

    return new Response(JSON.stringify({ success: true, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[notify-new-order] error", error);
    return new Response(JSON.stringify({ error: "Unable to send order notification." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
