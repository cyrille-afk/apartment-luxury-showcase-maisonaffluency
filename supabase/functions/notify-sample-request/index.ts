import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

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
    );

    const { data: claimsData, error: authError } = await supabaseClient.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string } | undefined;
    const user = claims?.sub ? { id: claims.sub } : null;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "Missing requestId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const [reqRes, profileRes] = await Promise.all([
      adminClient.from("trade_sample_requests").select("*").eq("id", requestId).single(),
      adminClient.from("profiles").select("first_name, last_name, email, company").eq("id", user.id).single(),
    ]);

    const sampleReq = reqRes.data as any;
    const profile = profileRes.data as any;

    if (!sampleReq) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (sampleReq.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const refNumber = `SR-${requestId.slice(0, 6).toUpperCase()}`;
    const userName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Trade member";
    const company = profile?.company || "N/A";
    const productName = sampleReq.product_name || "—";
    const brandName = sampleReq.brand_name || "—";
    const clientName = sampleReq.client_name || "";
    const projectName = sampleReq.project_name || "";
    const shipTo = [sampleReq.shipping_address, sampleReq.shipping_city, sampleReq.shipping_country]
      .filter(Boolean).join(", ");
    const returnBy = sampleReq.return_by || "";
    const notes = sampleReq.notes || "";

    const subject = `📦 New Sample Request ${refNumber} — ${userName}${company !== "N/A" ? ` (${company})` : ""}`;

    const row = (label: string, value: string, italic = false) => value ? `<tr>
      <td style="padding:6px 0;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.05em;width:120px;">${escapeHtml(label)}</td>
      <td style="padding:6px 0;font-size:14px;color:#333;${italic ? "font-style:italic;" : ""}">${escapeHtml(value)}</td>
    </tr>` : "";

    const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;">
      <div style="border-bottom:1px solid #e0dcd5;padding-bottom:20px;margin-bottom:24px;">
        <h1 style="font-size:22px;font-weight:normal;color:#1a1a1a;margin:0 0 4px;">New Sample Request</h1>
        <p style="font-size:13px;color:#888;margin:0;">${escapeHtml(refNumber)}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
        ${row("Requested by", `${userName}${company !== "N/A" ? ` · ${company}` : ""}`)}
        ${row("Product", productName)}
        ${row("Brand", brandName)}
        ${row("Client", clientName)}
        ${row("Project", projectName)}
        ${row("Ship to", shipTo)}
        ${row("Return by", returnBy)}
        ${row("Notes", notes ? `"${notes}"` : "", true)}
      </table>

      <div style="text-align:center;padding:16px 0;">
        <a href="https://apartment-luxury-showcase-maisonaffluency.lovable.app/trade/admin" style="display:inline-block;padding:10px 28px;background:#1a1a1a;color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.1em;border-radius:4px;">
          Review Request
        </a>
      </div>

      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:32px;border-top:1px solid #e0dcd5;padding-top:16px;">
        Maison Affluency · Trade Portal
      </p>
    </div>`;

    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);

    const adminUserIds = [...new Set((adminRoles || []).map((r: any) => r.user_id))];
    let adminEmails: string[] = [];
    if (adminUserIds.length > 0) {
      const { data: adminProfiles } = await adminClient
        .from("profiles")
        .select("email")
        .in("id", adminUserIds);
      adminEmails = [...new Set((adminProfiles || []).map((p: any) => p.email).filter(Boolean))];
    }
    if (adminEmails.length === 0) {
      adminEmails = ["gregoire@maisonaffluency.com"];
    }

    for (const recipientEmail of adminEmails) {
      const messageId = `sample-request-${requestId}-${recipientEmail.split("@")[0]}`;
      const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: recipientEmail,
          from: "Maison Affluency Trade <trade@notify.www.maisonaffluency.com>",
          sender_domain: "notify.www.maisonaffluency.com",
          subject,
          html,
          purpose: "transactional",
          label: "sample-request",
          message_id: messageId,
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqueueError) {
        console.error("Enqueue error for", recipientEmail, enqueueError);
      }

      await adminClient.from("email_send_log").insert({
        message_id: messageId,
        template_name: "sample-request",
        recipient_email: recipientEmail,
        status: "pending",
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
