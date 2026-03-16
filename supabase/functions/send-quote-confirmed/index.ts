import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char)
  );

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { quoteId } = await req.json();
    if (!quoteId) {
      return new Response(JSON.stringify({ error: "Missing quoteId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const [quoteRes, profileRes, itemsRes] = await Promise.all([
      adminClient.from("trade_quotes").select("*").eq("id", quoteId).single(),
      adminClient.from("profiles").select("first_name, last_name, email, company").eq("id", user.id).single(),
      adminClient.from("trade_quote_items").select("quantity, unit_price_cents, trade_products(product_name, brand_name)").eq("quote_id", quoteId),
    ]);

    const quote = quoteRes.data;
    const profile = profileRes.data;
    const items = (itemsRes.data || []) as any[];

    if (!quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
    const userName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : user.email;
    const company = profile?.company || "N/A";
    const currency = quote.currency || "SGD";
    const clientName = quote.client_name || "";
    const notes = quote.notes || "";

    let subtotalCents = 0;
    const itemRows = items.map((item: any) => {
      const product = Array.isArray(item.trade_products) ? item.trade_products[0] : item.trade_products;
      const name = product?.product_name || "Unknown";
      const brand = product?.brand_name || "";
      const unitPrice = item.unit_price_cents || 0;
      const lineTotal = unitPrice * item.quantity;
      subtotalCents += lineTotal;
      const priceStr = unitPrice > 0 ? `${currency} ${(unitPrice / 100).toFixed(2)}` : "—";
      const totalStr = lineTotal > 0 ? `${currency} ${(lineTotal / 100).toFixed(2)}` : "—";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;">${escapeHtml(name)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#666;">${escapeHtml(brand)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;text-align:right;">${priceStr}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;color:#333;text-align:right;">${totalStr}</td>
      </tr>`;
    }).join("");

    const subtotalStr = `${currency} ${(subtotalCents / 100).toFixed(2)}`;

    const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="border-bottom:1px solid #e0dcd5;padding-bottom:20px;margin-bottom:24px;">
        <h1 style="font-size:22px;font-weight:normal;color:#1a1a1a;margin:0 0 4px;">✅ Order Confirmed</h1>
        <p style="font-size:13px;color:#888;margin:0;">${escapeHtml(quoteNumber)} · ${escapeHtml(currency)}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <tr>
          <td style="padding:6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Client</td>
          <td style="padding:6px 0;font-size:14px;color:#333;">${escapeHtml(userName)}${company !== "N/A" ? ` · ${escapeHtml(company)}` : ""}</td>
        </tr>
        ${clientName ? `<tr>
          <td style="padding:6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Project</td>
          <td style="padding:6px 0;font-size:14px;color:#333;">${escapeHtml(clientName)}</td>
        </tr>` : ""}
        ${notes ? `<tr>
          <td style="padding:6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;">Notes</td>
          <td style="padding:6px 0;font-size:14px;color:#333;font-style:italic;">"${escapeHtml(notes)}"</td>
        </tr>` : ""}
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        <thead>
          <tr style="background:#f8f7f5;">
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:normal;">Product</th>
            <th style="padding:8px 12px;text-align:left;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:normal;">Brand</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:normal;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:normal;">Unit</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.08em;font-weight:normal;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr style="background:#f8f7f5;">
            <td colspan="4" style="padding:8px 12px;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Subtotal</td>
            <td style="padding:8px 12px;font-size:14px;color:#1a1a1a;text-align:right;font-weight:bold;">${subtotalStr}</td>
          </tr>
        </tbody>
      </table>

      <div style="text-align:center;padding:16px 0;">
        <a href="https://apartment-luxury-showcase-maisonaffluency.lovable.app/trade/quotes-admin" style="display:inline-block;padding:10px 28px;background:#1a1a1a;color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;border-radius:4px;">
          View Order
        </a>
      </div>

      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:32px;border-top:1px solid #e0dcd5;padding-top:16px;">
        Maison Affluency · Trade Portal
      </p>
    </div>`;

    const { error: emailError } = await resend.emails.send({
      from: "Maison Affluency <trade@myaffluency.com>",
      to: ["gregoire@myaffluency.com"],
      subject: `✅ Order Confirmed ${quoteNumber} — ${userName}${company !== "N/A" ? ` (${company})` : ""}`,
      html,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      return new Response(JSON.stringify({ error: "Failed to send email", details: emailError }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
