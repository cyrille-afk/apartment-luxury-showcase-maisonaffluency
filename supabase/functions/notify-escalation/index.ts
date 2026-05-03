import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Msg = { role: string; content: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { sentiment, intent, excerpt } = (await req.json()) as {
      sentiment: string;
      intent: string;
      excerpt: Msg[];
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Resolve user from auth header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    let userId: string | null = null;
    let userEmail: string | null = null;
    let userName = "A trade user";
    let company = "";
    if (token) {
      const { data: u } = await supabase.auth.getUser(token);
      userId = u?.user?.id || null;
      userEmail = u?.user?.email || null;
      if (userId) {
        const { data: p } = await supabase
          .from("profiles")
          .select("first_name, last_name, company, email")
          .eq("id", userId)
          .maybeSingle();
        if (p) {
          userName = [p.first_name, p.last_name].filter(Boolean).join(" ") || userEmail || userName;
          company = p.company || "";
          userEmail = userEmail || p.email || null;
        }
      }
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Insert escalation row
    const { data: escalation, error: insErr } = await supabase
      .from("trade_concierge_escalations")
      .insert({
        user_id: userId,
        trigger_sentiment: sentiment || "frustrated",
        trigger_intent: intent || "complaint",
        conversation_excerpt: excerpt || [],
      })
      .select("id")
      .single();
    if (insErr) console.error("insert escalation failed:", insErr);

    // 2. Notify all admins via in-app notifications
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);
    const adminIds = Array.from(new Set((admins || []).map((a: any) => a.user_id)));
    if (adminIds.length && escalation?.id) {
      const link = `/trade/admin-dashboard?escalation=${escalation.id}`;
      await supabase.from("notifications").insert(
        adminIds.map((aid) => ({
          user_id: aid,
          title: "Concierge escalation requested",
          message: `${userName}${company ? ` (${company})` : ""} flagged as ${sentiment}/${intent} — needs human follow-up.`,
          type: "concierge_escalation",
          link,
        })),
      );
      await supabase
        .from("trade_concierge_escalations")
        .update({ notified_admins: true })
        .eq("id", escalation.id);
    }

    // 3. Email concierge@maisonaffluency.com via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (RESEND_API_KEY) {
      const lines = (excerpt || [])
        .map((m) => `<p style="margin:6px 0"><strong>${m.role}:</strong> ${escapeHtml(m.content || "")}</p>`)
        .join("");
      const html = `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1a2820;max-width:600px">
          <h2 style="color:#1a4d3a;margin:0 0 8px">Concierge escalation</h2>
          <p style="margin:0 0 4px"><strong>User:</strong> ${escapeHtml(userName)}${company ? ` (${escapeHtml(company)})` : ""}</p>
          ${userEmail ? `<p style="margin:0 0 4px"><strong>Email:</strong> ${escapeHtml(userEmail)}</p>` : ""}
          <p style="margin:0 0 12px"><strong>Signal:</strong> ${escapeHtml(sentiment)} / ${escapeHtml(intent)}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0"/>
          <h3 style="margin:0 0 6px;color:#1a4d3a">Last messages</h3>
          ${lines || "<p>(no excerpt)</p>"}
        </div>`;
      try {
        const r = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Maison Affluency Concierge <concierge@maisonaffluency.com>",
            to: ["concierge@maisonaffluency.com"],
            reply_to: userEmail || undefined,
            subject: `Concierge escalation — ${userName} (${sentiment})`,
            html,
          }),
        });
        if (r.ok && escalation?.id) {
          await supabase
            .from("trade_concierge_escalations")
            .update({ notified_email: true })
            .eq("id", escalation.id);
        } else if (!r.ok) {
          console.error("resend failed:", r.status, await r.text());
        }
      } catch (e) {
        console.error("resend error:", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, escalation_id: escalation?.id || null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-escalation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
