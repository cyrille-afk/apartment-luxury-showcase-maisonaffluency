import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

serve(async (req: Request) => {
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
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { fileUrl, fileType, projectName } = await req.json();

    // Get user profile for display name
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: profile } = await adminClient
      .from("profiles")
      .select("first_name, last_name, company, email")
      .eq("id", user.id)
      .single();

    const userName = profile
      ? `${profile.first_name} ${profile.last_name}`.trim() || profile.email
      : user.email || "A trade user";
    const company = profile?.company || "";
    const ext = fileType?.toUpperCase() || "3D";

    // Find admin user IDs
    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    const adminUserIds = adminRoles?.map((r: any) => r.user_id) || [];

    // Insert in-app notifications for all admins
    if (adminUserIds.length > 0) {
      const notifications = adminUserIds.map((adminId: string) => ({
        user_id: adminId,
        type: "3d_file_upload",
        title: `New ${ext} file uploaded`,
        message: `${userName}${company ? ` (${company})` : ""} uploaded a ${ext} file${projectName ? ` for project "${projectName}"` : ""}. Please process in 3ds Max.`,
        link: "/trade/axonometric-requests",
      }));

      await adminClient.from("notifications").insert(notifications);
    }

    // Send email notification via queue
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      for (const email of ADMIN_EMAILS) {
        try {
          await adminClient.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: email,
              subject: `3D Studio: New ${ext} file uploaded by ${userName}`,
              html: `
                <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 32px;">
                  <h2 style="font-size: 18px; color: #1a1a1a; margin-bottom: 16px;">New ${ext} File Upload</h2>
                  <p style="font-size: 14px; color: #555; line-height: 1.6;">
                    <strong>${userName}</strong>${company ? ` from <strong>${company}</strong>` : ""} has uploaded a <strong>.${fileType}</strong> file
                    ${projectName ? ` for project <strong>"${projectName}"</strong>` : ""} in the 3D Studio.
                  </p>
                  <p style="font-size: 14px; color: #555; line-height: 1.6;">
                    Please download and process this file in 3ds Max, then upload the rendered views back to the platform.
                  </p>
                  ${fileUrl ? `<p style="font-size: 13px; color: #888; margin-top: 16px;"><a href="${fileUrl}" style="color: #b8860b;">Download file</a></p>` : ""}
                  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
                  <p style="font-size: 12px; color: #999;">Maison Affluency · 3D Studio Notification</p>
                </div>
              `,
              from_name: "Maison Affluency 3D Studio",
            },
          });
        } catch (e) {
          console.error(`Failed to enqueue email to ${email}:`, e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    console.error("notify-3d-upload error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
