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
    // Verify the caller is an authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminId = claimsData.claims.sub;

    // Check admin role using service role client
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { applicantEmail, applicantName, companyName, status } = await req.json();

    if (!applicantEmail || !status || !["approved", "rejected"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid parameters" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const safeName = escapeHtml(applicantName || "");
    const safeCompany = escapeHtml(companyName || "");
    const greeting = safeName ? `Dear ${safeName},` : "Dear Applicant,";

    const isApproved = status === "approved";

    const subject = isApproved
      ? "Welcome to the Maison Affluency Trade Program"
      : "Maison Affluency Trade Program — Application Update";

    const bodyHtml = isApproved
      ? `
        <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
          We are pleased to inform you that your application${safeCompany ? ` for <strong>${safeCompany}</strong>` : ""} to the Maison Affluency Trade Program has been approved.
        </p>
        <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
          You now have full access to exclusive trade pricing, our curated product library, branded quote builder, and dedicated concierge support.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://maisonaffluency.com/trade/login" 
             style="display: inline-block; padding: 14px 32px; background-color: #1a1a1a; color: #ffffff; text-decoration: none; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; border-radius: 24px;">
            Access Your Trade Portal
          </a>
        </div>
        <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
          A dedicated Client Advisor will reach out to you shortly to introduce themselves and discuss how we can best support your projects.
        </p>
      `
      : `
        <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
          Thank you for your interest in the Maison Affluency Trade Program${safeCompany ? ` with <strong>${safeCompany}</strong>` : ""}.
        </p>
        <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
          After careful review, we are unable to approve your application at this time. This decision may be based on the information provided or our current program capacity.
        </p>
        <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
          If you believe this was made in error, or if your circumstances have changed, we welcome you to reach out to discuss your application further at 
          <a href="mailto:concierge@myaffluency.com" style="color: #8B7355;">concierge@myaffluency.com</a>.
        </p>
      `;

    const emailResult = await resend.emails.send({
      from: "Maison Affluency <onboarding@resend.dev>",
      to: [applicantEmail],
      subject,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #faf9f7;">
          <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e8e4de;">
            <img 
              src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-logo.jpeg" 
              alt="Affluency - Unique by Design" 
              style="max-width: 280px; height: auto;"
            />
          </div>
          
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">${greeting}</h1>
          
          ${bodyHtml}
          
          <p style="color: #333; line-height: 1.8; margin-top: 32px;">
            Warm regards,<br>
            <strong>The Maison Affluency Team</strong>
          </p>
          
          <hr style="border: none; border-top: 1px solid #e8e4de; margin: 40px 0 20px;" />
          
          <p style="color: #888; font-size: 12px; line-height: 1.6; text-align: center;">
            Maison Affluency Singapore<br>
            <em>Unique by Design</em>
          </p>
        </div>
      `,
    });

    console.log("Status notification email sent:", emailResult);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-application-status:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred." }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
