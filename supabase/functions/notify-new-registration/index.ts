import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, first_name, last_name, company } = await req.json();

    const displayName = [first_name, last_name].filter(Boolean).join(" ") || "Unknown";

    const html = `
      <div style="font-family: 'Georgia', serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #faf9f7;">
        <h2 style="font-family: 'Georgia', serif; font-size: 20px; color: #1a1a1a; margin-bottom: 24px;">
          New User Registration
        </h2>
        <div style="background: #ffffff; border: 1px solid #e8e5e0; border-radius: 4px; padding: 24px;">
          <p style="font-size: 14px; color: #444; line-height: 1.6; margin: 0 0 12px;">
            A new user has just registered on Maison Affluency:
          </p>
          <table style="width: 100%; font-size: 14px; color: #333; line-height: 1.8;">
            <tr><td style="font-weight: 600; width: 100px; vertical-align: top;">Name</td><td>${displayName}</td></tr>
            <tr><td style="font-weight: 600; vertical-align: top;">Email</td><td>${email || "N/A"}</td></tr>
            ${company ? `<tr><td style="font-weight: 600; vertical-align: top;">Company</td><td>${company}</td></tr>` : ""}
          </table>
        </div>
        <p style="font-size: 11px; color: #999; margin-top: 24px; text-align: center;">
          Maison Affluency — Admin Notification
        </p>
      </div>
    `;

    const results = await Promise.allSettled(
      ADMIN_EMAILS.map((adminEmail) =>
        resend.emails.send({
          from: "Maison Affluency <noreply@notify.www.maisonaffluency.com>",
          to: adminEmail,
          subject: `New Registration: ${displayName}`,
          html,
        })
      )
    );

    const errors = results
      .filter((r) => r.status === "rejected")
      .map((r: any) => r.reason?.message);

    return new Response(
      JSON.stringify({ success: true, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in notify-new-registration:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
