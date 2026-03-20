import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAILS = [
  "cyrille@maisonaffluency.com",
  "gregoire@maisonaffluency.com",
];

const STATUS_LABELS: Record<string, string> = {
  idea: "Idea",
  planning: "Planning",
  drafting: "Drafting",
  review: "Review",
  ready: "Ready",
};

const CATEGORY_LABELS: Record<string, string> = {
  designer_interview: "Designer Interview",
  collection_story: "Collection Story",
  design_trend: "Design Trend",
  project_showcase: "Project Showcase",
  international_editorial: "International Editorial",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const resend = new Resend(resendApiKey);

    // Get today's date in YYYY-MM-DD
    const today = new Date().toISOString().split("T")[0];

    // Query overdue pipeline items: target_date < today AND status not terminal
    const { data: overdueItems, error } = await supabase
      .from("journal_pipeline")
      .select("id, title, target_date, status, category, designer_or_brand, author")
      .lt("target_date", today)
      .not("status", "in", '("published","killed")')
      .order("target_date", { ascending: true });

    if (error) {
      console.error("Query error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!overdueItems || overdueItems.length === 0) {
      return new Response(
        JSON.stringify({ message: "No overdue articles", count: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Build email
    const articleRows = overdueItems
      .map((item) => {
        const daysOverdue = Math.floor(
          (new Date(today).getTime() - new Date(item.target_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const urgency =
          daysOverdue > 14 ? "#c53030" : daysOverdue > 7 ? "#d69e2e" : "#718096";

        return `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #edf2f7;font-size:14px;color:#2d3748;">${item.title}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#718096;">${CATEGORY_LABELS[item.category] || item.category}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #edf2f7;font-size:13px;">
              <span style="background:#edf2f7;color:#4a5568;padding:2px 8px;border-radius:12px;font-size:12px;">${STATUS_LABELS[item.status] || item.status}</span>
            </td>
            <td style="padding:10px 12px;border-bottom:1px solid #edf2f7;font-size:13px;color:#718096;">${item.target_date}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #edf2f7;font-size:13px;font-weight:600;color:${urgency};">${daysOverdue}d</td>
          </tr>`;
      })
      .join("");

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:680px;margin:0 auto;background:#ffffff;">
        <div style="padding:32px 24px 20px;border-bottom:2px solid #1a202c;">
          <h1 style="margin:0;font-size:20px;font-weight:600;color:#1a202c;letter-spacing:0.5px;">Maison Affluency — Editorial Pipeline</h1>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 8px;font-size:15px;color:#2d3748;">
            <strong>${overdueItems.length}</strong> article${overdueItems.length > 1 ? "s" : ""} overdue as of ${today}.
          </p>
          <p style="margin:0 0 24px;font-size:13px;color:#a0aec0;">
            Review and update statuses in the Trade Portal → Journal.
          </p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #edf2f7;border-radius:6px;">
            <thead>
              <tr style="background:#f7fafc;">
                <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #edf2f7;">Title</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #edf2f7;">Category</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #edf2f7;">Status</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #edf2f7;">Due</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:0.5px;border-bottom:2px solid #edf2f7;">Overdue</th>
              </tr>
            </thead>
            <tbody>${articleRows}</tbody>
          </table>
          <div style="margin-top:24px;text-align:center;">
            <a href="https://maisonaffluency.com/trade/journal" style="display:inline-block;padding:10px 28px;background:#1a202c;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;border-radius:24px;letter-spacing:0.5px;">Open Editorial Pipeline</a>
          </div>
        </div>
        <div style="padding:16px 24px;border-top:1px solid #edf2f7;">
          <p style="margin:0;font-size:11px;color:#a0aec0;text-align:center;">
            This is an automated notification from Maison Affluency. Sent daily at 9 AM SGT.
          </p>
        </div>
      </div>
    `;

    const { error: emailError } = await resend.emails.send({
      from: "Maison Affluency <notify@notify.www.maisonaffluency.com>",
      to: ADMIN_EMAILS,
      subject: `📝 ${overdueItems.length} Overdue Article${overdueItems.length > 1 ? "s" : ""} — Editorial Pipeline`,
      html: htmlBody,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: emailError }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sent overdue pipeline alert: ${overdueItems.length} articles to ${ADMIN_EMAILS.join(", ")}`);

    return new Response(
      JSON.stringify({ message: "Overdue notification sent", count: overdueItems.length }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
