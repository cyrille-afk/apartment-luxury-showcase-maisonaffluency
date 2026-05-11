import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://maisonaffluency.com";
const TRADE_LANDING_PATH = "/trade/landing";

serve(async (req) => {
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

    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (claimsError || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isAdmin = (callerRoles || []).some(
      (r: any) => r.role === "admin" || r.role === "super_admin"
    );
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { documentId } = await req.json();
    if (!documentId || typeof documentId !== "string") {
      return new Response(JSON.stringify({ error: "Missing documentId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: doc, error: docErr } = await admin
      .from("trade_documents")
      .select("id, title, brand_name, cover_image_url, is_featured_public")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Get all trade users
    const { data: tradeUserRows, error: rolesErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "trade_user");
    if (rolesErr) throw rolesErr;
    const userIds = Array.from(new Set((tradeUserRows || []).map((r: any) => r.user_id)));

    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, recipients: 0 }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email, first_name")
      .in("id", userIds);

    const ctaUrl = `${SITE_URL}${TRADE_LANDING_PATH}`;
    const notificationTitle = "New featured issue available";
    const notificationMessage = doc.title
      ? `${doc.title}${doc.brand_name ? ` · ${doc.brand_name}` : ""}`
      : "A new complimentary magazine issue is now featured in your Trade Lounge.";

    // In-app notifications
    const notificationRows = userIds.map((uid) => ({
      user_id: uid,
      type: "featured_magazine",
      title: notificationTitle,
      message: notificationMessage,
      link: TRADE_LANDING_PATH,
      metadata: {
        document_id: doc.id,
        issue_title: doc.title,
        brand_name: doc.brand_name,
        cover_image_url: doc.cover_image_url,
        action_label: "Read this issue",
        action_link: TRADE_LANDING_PATH,
      },
    }));

    const { error: insErr } = await admin.from("notifications").insert(notificationRows);
    if (insErr) console.error("notification insert error", insErr);

    // Emails
    let emailsSent = 0;
    let emailsFailed = 0;
    await Promise.all(
      (profiles || [])
        .filter((p: any) => !!p.email)
        .map(async (p: any) => {
          try {
            const { error } = await admin.functions.invoke("send-transactional-email", {
              body: {
                templateName: "featured-magazine-update",
                recipientEmail: p.email,
                idempotencyKey: `featured-magazine-${doc.id}-${p.id}`,
                templateData: {
                  firstName: p.first_name || undefined,
                  issueTitle: doc.title,
                  brandName: doc.brand_name,
                  coverImageUrl: doc.cover_image_url,
                  ctaUrl,
                },
              },
            });
            if (error) {
              emailsFailed++;
              console.error(`email failed for ${p.email}`, error);
            } else {
              emailsSent++;
            }
          } catch (e) {
            emailsFailed++;
            console.error(`email exception for ${p.email}`, e);
          }
        })
    );

    return new Response(
      JSON.stringify({
        ok: true,
        recipients: userIds.length,
        notifications_inserted: notificationRows.length,
        emails_sent: emailsSent,
        emails_failed: emailsFailed,
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (e) {
    console.error("notify-featured-magazine error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
