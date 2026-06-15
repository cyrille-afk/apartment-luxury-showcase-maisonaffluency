import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const { data: claims, error: authError } = await supabaseClient.auth.getClaims(token);
    if (authError || !claims) {
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

    const { data: quote } = await adminClient
      .from("trade_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();
    if (!quote) {
      return new Response(JSON.stringify({ error: "Quote not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const callerId = (claims.claims as { sub?: string } | undefined)?.sub;
    if (!callerId || quote.user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: requesterProfile } = await adminClient
      .from("profiles")
      .select("first_name, last_name, email, company")
      .eq("id", quote.user_id)
      .single();

    const { data: items } = await adminClient
      .from("trade_quote_items")
      .select("quantity, unit_price_cents, trade_products(product_name, brand_name)")
      .eq("quote_id", quoteId);

    const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
    const userName = requesterProfile
      ? `${requesterProfile.first_name || ""} ${requesterProfile.last_name || ""}`.trim() || requesterProfile.email
      : "there";
    const currency = quote.currency || "SGD";
    const adminNotes = quote.admin_notes || "";

    let subtotalCents = 0;
    const itemRows = (items || []).map((item: any) => {
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
    const subject = `💰 Quote ${quoteNumber} priced — ready for your review`;

    const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="border-bottom:1px solid #e0dcd5;padding-bottom:20px;margin-bottom:24px;">
        <h1 style="font-size:22px;font-weight:normal;color:#1a1a1a;margin:0 0 4px;">Your quote has been priced</h1>
        <p style="font-size:13px;color:#888;margin:0;">${escapeHtml(quoteNumber)} · ${escapeHtml(currency)}</p>
      </div>

      <p style="font-size:14px;color:#333;margin:0 0 18px;">Hello ${escapeHtml(userName)},</p>
      <p style="font-size:14px;color:#333;margin:0 0 18px;">
        Our team has finished pricing your quote. Please log in to the trade portal to review the line items, request changes if needed, or accept and confirm to start the order.
      </p>

      ${adminNotes ? `<div style="background:#fafaf7;border-left:3px solid #c9a84c;padding:12px 16px;margin:0 0 20px;">
        <p style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Notes from Maison Affluency</p>
        <p style="font-size:13px;color:#333;margin:0;font-style:italic;">"${escapeHtml(adminNotes)}"</p>
      </div>` : ""}

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;border:1px solid #eee;">
        <thead>
          <tr style="background:#fafaf7;">
            <th style="padding:8px 12px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">Product</th>
            <th style="padding:8px 12px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">Brand</th>
            <th style="padding:8px 12px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:center;">Qty</th>
            <th style="padding:8px 12px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Unit</th>
            <th style="padding:8px 12px;font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Total</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
        <tfoot>
          <tr><td colspan="4" style="padding:10px 12px;font-size:13px;color:#333;text-align:right;font-weight:600;">Subtotal</td>
              <td style="padding:10px 12px;font-size:13px;color:#333;text-align:right;font-weight:600;">${escapeHtml(subtotalStr)}</td></tr>
        </tfoot>
      </table>

      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:32px;border-top:1px solid #e0dcd5;padding-top:16px;">
        Maison Affluency · Trade Portal
      </p>
    </div>`;

    // Recipients: requesting user + studio admins (super_admin role)
    const recipients = new Set<string>();
    if (requesterProfile?.email) recipients.add(requesterProfile.email);

    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);
    const adminUserIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];
    if (adminUserIds.length > 0) {
      const { data: adminProfiles } = await adminClient
        .from("profiles")
        .select("email")
        .in("id", adminUserIds);
      for (const p of adminProfiles || []) {
        if ((p as any).email) recipients.add((p as any).email);
      }
    }

    for (const recipientEmail of recipients) {
      const messageId = `quote-priced-${quoteId}-${recipientEmail.split("@")[0]}`;
      const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: recipientEmail,
          from: "Maison Affluency Trade <trade@notify.www.maisonaffluency.com>",
          sender_domain: "notify.www.maisonaffluency.com",
          subject,
          html,
          purpose: "transactional",
          label: "quote-priced",
          message_id: messageId,
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        },
      });
      if (enqueueError) console.error("Enqueue error for", recipientEmail, enqueueError);

      await adminClient.from("email_send_log").insert({
        message_id: messageId,
        template_name: "quote-priced",
        recipient_email: recipientEmail,
        status: "pending",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("send-quote-priced error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
