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

const SITE_URL = "https://apartment-luxury-showcase-maisonaffluency.lovable.app";

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

    const { boardId } = await req.json();
    if (!boardId) {
      return new Response(JSON.stringify({ error: "Missing boardId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch board (verify ownership)
    const { data: board, error: boardError } = await adminClient
      .from("client_boards")
      .select("*")
      .eq("id", boardId)
      .eq("user_id", user.id)
      .single();

    if (boardError || !board) {
      return new Response(JSON.stringify({ error: "Board not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!board.client_email) {
      return new Response(JSON.stringify({ success: true, sent: false, message: "No client email on board" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch sender profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name, last_name, company")
      .eq("id", user.id)
      .single();

    const senderName = profile
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Your designer"
      : "Your designer";
    const senderCompany = profile?.company || "";

    // Fetch item count
    const { count: itemCount } = await adminClient
      .from("client_board_items")
      .select("*", { count: "exact", head: true })
      .eq("board_id", boardId);

    // Check suppression
    const { data: suppressed } = await adminClient
      .from("suppressed_emails")
      .select("id")
      .eq("email", board.client_email)
      .limit(1);

    if (suppressed && suppressed.length > 0) {
      console.log("Email suppressed for", board.client_email);
      return new Response(JSON.stringify({ success: true, sent: false, message: "Email suppressed" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const boardLink = `${SITE_URL}/board/${board.share_token}`;
    const boardTitle = board.title || "Curated Selection";
    const clientName = board.client_name || "";

    const subject = `${escapeHtml(senderName)} has curated a selection for you — ${escapeHtml(boardTitle)}`;

    const html = `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;background:#fff;">
  <!-- Header -->
  <div style="background:#1a2e2a;padding:32px 40px;text-align:center;">
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:normal;color:#f5f0e8;letter-spacing:2px;margin:0;">MAISON AFFLUENCY</h1>
    <p style="font-family:Georgia,serif;font-size:10px;color:#c9b99a;letter-spacing:0.2em;text-transform:uppercase;margin:8px 0 0;">Curated Luxury Furnishings</p>
  </div>

  <!-- Body -->
  <div style="padding:40px;background:#faf8f5;">
    ${clientName ? `<p style="font-size:14px;color:#1a2e2a;margin:0 0 16px;">Dear ${escapeHtml(clientName)},</p>` : ""}

    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">
      ${escapeHtml(senderName)}${senderCompany ? ` from ${escapeHtml(senderCompany)}` : ""} has prepared a curated selection of luxury furnishings for your review.
    </p>

    <div style="border-left:3px solid #1a2e2a;padding-left:16px;margin-bottom:28px;background:#fff;padding:16px 16px 16px 20px;border-radius:0 4px 4px 0;">
      <p style="font-size:18px;color:#1a2e2a;margin:0 0 4px;font-style:italic;font-family:Georgia,serif;">${escapeHtml(boardTitle)}</p>
      <p style="font-size:13px;color:#888;margin:0;">${itemCount || 0} piece${(itemCount || 0) === 1 ? "" : "s"} selected for you</p>
    </div>

    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 32px;">
      Please take a moment to review the selection. You can <strong>approve or decline</strong> each piece and leave comments to share your preferences.
    </p>

    <div style="text-align:center;margin-bottom:32px;">
      <a href="${boardLink}" style="display:inline-block;padding:14px 36px;background:#2d5a4e;color:#f5f0e8;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;font-family:Arial,sans-serif;border-radius:2px;">
        Review Your Selection
      </a>
    </div>

    <p style="font-size:12px;color:#aaa;line-height:1.5;margin:0;text-align:center;">
      No account needed — simply click the button above to view and respond.
    </p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #e0dcd5;padding:24px 40px;text-align:center;background:#fff;">
    <p style="font-size:11px;color:#aaa;margin:0 0 4px;">
      This email was sent on behalf of ${escapeHtml(senderName)} via Maison Affluency
    </p>
    <p style="font-size:11px;color:#ccc;margin:0;">
      <a href="${SITE_URL}" style="color:#999;text-decoration:underline;">maisonaffluency.com</a>
    </p>
  </div>
</div>`;

    const messageId = `board-shared-${boardId}-${Date.now()}`;
    const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: board.client_email,
        from: "Maison Affluency <trade@notify.www.maisonaffluency.com>",
        sender_domain: "notify.www.maisonaffluency.com",
        subject,
        html,
        purpose: "transactional",
        label: "board-shared",
        message_id: messageId,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Enqueue error:", enqueueError);
      return new Response(JSON.stringify({ error: "Failed to queue email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    await adminClient.from("email_send_log").insert({
      message_id: messageId,
      template_name: "board-shared",
      recipient_email: board.client_email,
      status: "pending",
    });

    return new Response(JSON.stringify({ success: true, sent: true }), {
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
