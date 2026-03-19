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
    // Auth: verify caller is admin
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

    const { presentationId } = await req.json();
    if (!presentationId) {
      return new Response(JSON.stringify({ error: "Missing presentationId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify caller is admin
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = (callerRoles || []).some((r: any) =>
      r.role === "admin" || r.role === "super_admin"
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch presentation
    const { data: presentation, error: presError } = await adminClient
      .from("presentations")
      .select("*")
      .eq("id", presentationId)
      .single();
    if (presError || !presentation) {
      return new Response(JSON.stringify({ error: "Presentation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Mark linked axonometric requests as completed
    const { data: slides } = await adminClient
      .from("presentation_slides")
      .select("gallery_item_id")
      .eq("presentation_id", presentationId)
      .not("gallery_item_id", "is", null);

    if (slides && slides.length > 0) {
      const galleryIds = slides.map((s: any) => s.gallery_item_id).filter(Boolean);
      if (galleryIds.length > 0) {
        const { data: galleryItems } = await adminClient
          .from("axonometric_gallery")
          .select("request_id")
          .in("id", galleryIds)
          .not("request_id", "is", null);

        if (galleryItems && galleryItems.length > 0) {
          const requestIds = [...new Set(galleryItems.map((g: any) => g.request_id).filter(Boolean))];
          if (requestIds.length > 0) {
            await adminClient
              .from("axonometric_requests")
              .update({ status: "completed", updated_at: new Date().toISOString() })
              .in("id", requestIds)
              .in("status", ["pending", "in_progress"]);
            console.log(`Marked ${requestIds.length} axonometric request(s) as completed`);
          }
        }
      }
    }

    // Fetch shared users
    const { data: shares } = await adminClient
      .from("presentation_shares")
      .select("shared_with_email, shared_with_user_id")
      .eq("presentation_id", presentationId);

    const sharedUsers = shares || [];
    if (sharedUsers.length === 0) {
      return new Response(JSON.stringify({ success: true, notified: 0, message: "No shared users to notify" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const viewLink = `${SITE_URL}/trade/presentations/${presentationId}/view`;
    const title = presentation.title || "Untitled Presentation";
    const clientName = presentation.client_name || "";
    const projectName = presentation.project_name || "";

    let notified = 0;

    for (const share of sharedUsers) {
      const recipientEmail = share.shared_with_email;
      const recipientUserId = share.shared_with_user_id;

      // 1. Create in-app notification if user exists
      if (recipientUserId) {
        await adminClient.from("notifications").insert({
          user_id: recipientUserId,
          type: "presentation_ready",
          title: "Your presentation is ready",
          message: `"${title}" has been published and is ready to view.`,
          link: `/trade/presentations/${presentationId}/view`,
        });
      }

      // 2. Send branded email
      const subject = `Your Presentation Is Ready — ${escapeHtml(title)}`;
      const html = `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;background:#fff;">
  <!-- Header -->
  <div style="background:#1a1a1a;padding:32px 40px;text-align:center;">
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:normal;color:#fff;letter-spacing:2px;margin:0;">MAISON AFFLUENCY</h1>
  </div>

  <!-- Body -->
  <div style="padding:40px;">
    <p style="font-size:14px;color:#888;text-transform:uppercase;letter-spacing:0.1em;margin:0 0 8px;">Trade Portal</p>
    <h2 style="font-size:22px;font-weight:normal;color:#1a1a1a;margin:0 0 24px;">Your Presentation Is Ready</h2>

    <div style="border-left:2px solid #1a1a1a;padding-left:16px;margin-bottom:24px;">
      <p style="font-size:16px;color:#1a1a1a;margin:0 0 4px;font-style:italic;">${escapeHtml(title)}</p>
      ${clientName ? `<p style="font-size:13px;color:#888;margin:0 0 2px;">For ${escapeHtml(clientName)}</p>` : ""}
      ${projectName ? `<p style="font-size:13px;color:#888;margin:0;">Project: ${escapeHtml(projectName)}</p>` : ""}
    </div>

    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 32px;">
      A curated presentation has been prepared for you. Click below to view the full deck, download images, and leave comments.
    </p>

    <div style="text-align:center;margin-bottom:32px;">
      <a href="${viewLink}" style="display:inline-block;padding:12px 32px;background:#1a1a1a;color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;font-family:Arial,sans-serif;">
        View Presentation
      </a>
    </div>

    <p style="font-size:12px;color:#aaa;line-height:1.5;margin:0;">
      You can also access all your presentations from the Trade Portal dashboard.
    </p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #e0dcd5;padding:20px 40px;text-align:center;">
    <p style="font-size:11px;color:#aaa;margin:0;">
      Maison Affluency · Trade Portal<br/>
      <a href="${SITE_URL}/trade" style="color:#888;text-decoration:underline;">Visit Trade Portal</a>
    </p>
  </div>
</div>`;

      const messageId = `presentation-published-${presentationId}-${recipientEmail.split("@")[0]}`;
      const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          to: recipientEmail,
          from: "Maison Affluency Trade <trade@notify.www.maisonaffluency.com>",
          sender_domain: "notify.www.maisonaffluency.com",
          subject,
          html,
          purpose: "transactional",
          label: "presentation-published",
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
        template_name: "presentation-published",
        recipient_email: recipientEmail,
        status: "pending",
      });

      notified++;
    }

    return new Response(JSON.stringify({ success: true, notified }), {
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
