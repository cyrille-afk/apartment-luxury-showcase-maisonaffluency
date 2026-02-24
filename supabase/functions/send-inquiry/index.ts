import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { z } from "https://esm.sh/zod@3.22.4";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "https://maisonaffluency.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (per IP, resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // max requests
const RATE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

// HTML escape to prevent injection in email templates
const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char)
  );

// Input validation schema
const InquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  firm: z.string().trim().max(100).optional().default(""),
  company: z.string().trim().max(100).optional().default(""),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().max(30).optional().default(""),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
  subject: z.string().trim().max(200).optional(),
});

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(clientIp)) {
    return new Response(
      JSON.stringify({ error: "Too many requests. Please try again later." }),
      { status: 429, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }

  try {
    const body = await req.json();
    const parsed = InquirySchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => i.message).join(", ");
      return new Response(
        JSON.stringify({ error: `Validation failed: ${errors}` }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { name, firm, company, email, phone, message, subject } = parsed.data;
    const companyName = firm || company || "";

    // Sanitize all user inputs before embedding in HTML
    const safeName = escapeHtml(name);
    const safeCompany = escapeHtml(companyName);
    const safeEmail = escapeHtml(email);
    const safePhone = escapeHtml(phone);
    const safeMessage = escapeHtml(message).replace(/\n/g, "<br>");

    console.log("Received inquiry from:", safeName, safeEmail);

    const notificationEmail = await resend.emails.send({
      from: "Maison Affluency <onboarding@resend.dev>",
      to: ["concierge@myaffluency.com"],
      subject: subject || `New Inquiry from ${safeName}${safeCompany ? ` - ${safeCompany}` : ""}`,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #faf9f7;">
          <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e8e4de;">
            <img 
              src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-email-logo.jpeg" 
              alt="Affluency - Unique by Design" 
              style="max-width: 280px; height: auto;"
            />
          </div>
          
          <h2 style="color: #1a1a1a; font-size: 20px; margin-bottom: 24px; border-bottom: 2px solid #C9A962; padding-bottom: 12px;">New Trade Program Application</h2>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #666; width: 140px;"><strong>Name:</strong></td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;">${safeName}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #666;"><strong>Firm/Studio:</strong></td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;">${safeCompany || "Not provided"}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #666;"><strong>Email:</strong></td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;"><a href="mailto:${safeEmail}" style="color: #8B7355;">${safeEmail}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #666;"><strong>Phone:</strong></td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;">${safePhone || "Not provided"}</td>
            </tr>
          </table>
          
          <h3 style="color: #1a1a1a; font-size: 16px; margin-bottom: 12px;">Message:</h3>
          <div style="background-color: #fff; padding: 20px; border-left: 3px solid #C9A962; margin-bottom: 24px;">
            <p style="color: #333; line-height: 1.8; margin: 0;">${safeMessage}</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e8e4de; margin: 32px 0 20px;" />
          
          <p style="color: #888; font-size: 12px; line-height: 1.6; text-align: center;">
            Maison Affluency Singapore<br>
            <em>Unique by Design</em>
          </p>
        </div>
      `,
    });

    console.log("Notification email sent:", notificationEmail);

    const confirmationEmail = await resend.emails.send({
      from: "Maison Affluency <onboarding@resend.dev>",
      to: [email],
      subject: "Welcome to Maison Affluency Trade Program",
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background-color: #faf9f7;">
          <div style="text-align: center; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid #e8e4de;">
            <img 
              src="https://dcrauiygaezoduwdjmsm.supabase.co/storage/v1/object/public/assets/affluency-logo.png" 
              alt="Maison Affluency" 
              style="max-width: 180px; height: auto;"
            />
          </div>
          
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Dear ${safeName},</h1>
          
          <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
            Thank you for your interest in joining the Maison Affluency Trade Program.
          </p>
          
          <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
            We have received your application and our team will review it shortly. 
            A dedicated Client Advisor will be in touch with you within the next 48 hours 
            to discuss how we can best support your design practice.
          </p>
          
          <p style="color: #333; line-height: 1.8; margin-bottom: 20px;">
            In the meantime, if you have any questions, please don't hesitate to reach out 
            to us at <a href="mailto:concierge@myaffluency.com" style="color: #8B7355;">concierge@myaffluency.com</a>.
          </p>
          
          <p style="color: #333; line-height: 1.8; margin-bottom: 8px;">
            We look forward to partnering with you.
          </p>
          
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

    console.log("Confirmation email sent to applicant:", confirmationEmail);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-inquiry function:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again later." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
