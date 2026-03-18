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

const STATUS_LABELS: Record<string, string> = {
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

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

    const { requestId, newStatus } = await req.json();
    if (!requestId || !newStatus) {
      return new Response(JSON.stringify({ error: "Missing requestId or newStatus" }), {
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
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the request
    const { data: request, error: reqError } = await adminClient
      .from("axonometric_requests")
      .select("*")
      .eq("id", requestId)
      .single();

    if (reqError || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fetch the requesting user's profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", request.user_id)
      .single();

    if (!profile?.email) {
      return new Response(JSON.stringify({ error: "User profile not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const firstName = profile.first_name || "there";
    const statusLabel = STATUS_LABELS[newStatus] || newStatus;
    const projectName = request.project_name || "your project";
    const requestType = request.request_type === "section" ? "Section → 3D" : "Elevation → 3D";
    const hasResult = newStatus === "completed" && request.result_image_url;

    const subject = newStatus === "completed"
      ? `✨ Your 3D render is ready — ${escapeHtml(projectName)}`
      : `🔄 3D Studio update — ${escapeHtml(projectName)}`;

    const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;background:#ffffff;">
      <!-- Header -->
      <div style="background:#141f1d;padding:28px 32px;text-align:center;">
        <h1 style="font-family:'Cinzel',Georgia,serif;font-size:18px;font-weight:400;color:#c9b99a;letter-spacing:3px;margin:0;">MAISON AFFLUENCY</h1>
      </div>

      <!-- Body -->
      <div style="padding:32px;background:#f9f7f5;">
        <h2 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:400;color:#1a1a1a;margin:0 0 8px;">
          ${newStatus === "completed" ? "Your 3D Render is Ready" : "Request Status Update"}
        </h2>
        <div style="width:40px;height:1px;background:#c9b99a;margin:16px 0;"></div>

        <p style="font-family:'Lora',Georgia,serif;font-size:14px;line-height:1.7;color:#444;margin:0 0 16px;">
          Hello ${escapeHtml(firstName)},
        </p>

        ${newStatus === "completed" ? `
        <p style="font-family:'Lora',Georgia,serif;font-size:14px;line-height:1.7;color:#444;margin:0 0 20px;">
          Your ${escapeHtml(requestType)} render for <strong>${escapeHtml(projectName)}</strong> has been completed. You can now view and download the result from your 3D Studio dashboard.
        </p>
        ` : `
        <p style="font-family:'Lora',Georgia,serif;font-size:14px;line-height:1.7;color:#444;margin:0 0 20px;">
          Your ${escapeHtml(requestType)} request for <strong>${escapeHtml(projectName)}</strong> has been updated to <strong>${escapeHtml(statusLabel)}</strong>.
        </p>
        `}

        <!-- Request details -->
        <div style="background:#ffffff;border:1px solid #e0dcd5;padding:16px 20px;margin:20px 0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Project</td>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:14px;color:#333;text-align:right;">${escapeHtml(projectName)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Type</td>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:14px;color:#333;text-align:right;">${escapeHtml(requestType)}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Status</td>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:14px;color:${newStatus === "completed" ? "#2d6b5e" : "#333"};text-align:right;font-weight:600;">${escapeHtml(statusLabel)}</td>
            </tr>
            ${request.admin_notes ? `
            <tr>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;">Notes</td>
              <td style="padding:6px 0;font-family:'Lora',Georgia,serif;font-size:13px;color:#555;text-align:right;">${escapeHtml(request.admin_notes)}</td>
            </tr>
            ` : ""}
          </table>
        </div>

        ${hasResult ? `
        <div style="text-align:center;margin:24px 0;">
          <img src="${request.result_image_url}" alt="3D Render Result" style="max-width:100%;border:1px solid #e0dcd5;" />
        </div>
        ` : ""}

        <!-- CTA -->
        <div style="text-align:center;margin:28px 0;">
          <a href="https://www.maisonaffluency.com/trade/axonometric-requests"
             style="display:inline-block;background:#2d6b5e;color:#ffffff;font-family:'Lora',Georgia,serif;font-size:13px;text-decoration:none;padding:12px 32px;letter-spacing:1px;text-transform:uppercase;">
            View in 3D Studio
          </a>
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:20px 32px;text-align:center;border-top:1px solid #e0dcd5;">
        <p style="font-family:'Lora',Georgia,serif;font-size:11px;color:#999;margin:0;">
          Maison Affluency · Singapore
        </p>
      </div>
    </div>`;

    // Enqueue the email
    const messageId = `axo-status-${requestId}-${newStatus}`;
    const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: profile.email,
        from: "Maison Affluency <notify@notify.www.maisonaffluency.com>",
        subject,
        html,
        purpose: "transactional",
        label: "axo-status-notification",
        message_id: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue email:", enqueueError);
      return new Response(JSON.stringify({ error: "Failed to queue email" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Log pending
    await adminClient.from("email_send_log").insert({
      message_id: messageId,
      template_name: "axo-status-notification",
      recipient_email: profile.email,
      status: "pending",
      metadata: { request_id: requestId, new_status: newStatus, project_name: request.project_name },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("Error in send-axo-status-notification:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
