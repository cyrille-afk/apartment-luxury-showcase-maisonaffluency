import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InquiryRequest {
  name: string;
  firm?: string;
  company?: string;
  email: string;
  phone: string;
  message: string;
  subject?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, firm, company, email, phone, message, subject }: InquiryRequest = await req.json();
    const companyName = firm || company || "";

    console.log("Received inquiry from:", name, email);

    // Send notification email to Maison Affluency
    const notificationEmail = await resend.emails.send({
      from: "Maison Affluency <onboarding@resend.dev>",
      to: ["concierge@myaffluency.com"],
      subject: subject || `New Inquiry from ${name}${companyName ? ` - ${companyName}` : ""}`,
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
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #666;"><strong>Firm/Studio:</strong></td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;">${companyName || "Not provided"}</td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #666;"><strong>Email:</strong></td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;"><a href="mailto:${email}" style="color: #8B7355;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #666;"><strong>Phone:</strong></td>
              <td style="padding: 12px 0; border-bottom: 1px solid #e8e4de; color: #1a1a1a;">${phone || "Not provided"}</td>
            </tr>
          </table>
          
          <h3 style="color: #1a1a1a; font-size: 16px; margin-bottom: 12px;">Message:</h3>
          <div style="background-color: #fff; padding: 20px; border-left: 3px solid #C9A962; margin-bottom: 24px;">
            <p style="color: #333; line-height: 1.8; margin: 0;">${message.replace(/\n/g, "<br>")}</p>
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

    // Send confirmation email to the applicant
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
          
          <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 24px;">Dear ${name},</h1>
          
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
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
