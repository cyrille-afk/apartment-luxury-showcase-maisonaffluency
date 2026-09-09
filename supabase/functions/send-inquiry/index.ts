import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAILS = ["concierge@myaffluency.com", "cyrille@maisonaffluency.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// HTML escape no longer required — templates render via React Email and escape props automatically.

// Input validation schema
const InquirySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  firm: z.string().trim().max(100).optional().default(""),
  company: z.string().trim().max(100).optional().default(""),
  email: z.string().trim().email("Invalid email address").max(255),
  phone: z.string().trim().max(30).optional().default(""),
  message: z.string().trim().min(10, "Message must be at least 10 characters").max(2000),
  subject: z.string().trim().max(200).optional(),
  turnstileToken: z.string().trim().min(10).max(4096).optional(),
  // Optional product context — set by public "Price upon Request" flow so
  // admins can generate a draft quote directly from the inquiry inbox.
  productId: z.string().uuid().optional(),
  productSlug: z.string().trim().max(200).optional(),
  productName: z.string().trim().max(200).optional(),
  designerName: z.string().trim().max(200).optional(),
  selectedFinish: z.string().trim().max(500).optional(),
  source: z.enum(["public_product", "concierge_lead", "contact_form"]).optional(),
});

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

// Fire-and-forget WhatsApp alert for product quote requests. Uses the same
// Twilio connector gateway as the trade-application alerts; delivery failures
// are logged to admin_alert_log so no lead is ever silently lost.
async function sendQuoteWhatsAppAlert(
  supabase: any,
  inquiry: { id: string; name: string; email: string; phone: string; productName?: string; selectedFinish?: string },
) {
  const to = Deno.env.get("ADMIN_WHATSAPP_TO");
  const from = Deno.env.get("TWILIO_WHATSAPP_FROM");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const twilioKey = Deno.env.get("TWILIO_API_KEY");
  if (!to || !from || !lovableKey || !twilioKey) return;

  const body = `🚨 *New Quote Request on Maison Affluency!*
• *Product:* ${inquiry.productName || "(unknown)"}
• *Finish:* ${inquiry.selectedFinish || "Not specified"}
• *Client:* ${inquiry.name}
• *Client Email:* ${inquiry.email}
• *Client Phone:* ${inquiry.phone || "Not provided"}

View details in the dashboard.`;

  try {
    const res = await fetch(`${TWILIO_GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`Quote WhatsApp alert failed [${res.status}]: ${errBody}`);
      await supabase.from("admin_alert_log").insert({
        channel: "twilio_whatsapp",
        event: "quote_request",
        status: "failed",
        payload: { inquiry_id: inquiry.id, product: inquiry.productName, email: inquiry.email },
        error: `Twilio ${res.status}: ${String(errBody).slice(0, 2000)}`,
      });
      return;
    }
    let sid: string | null = null;
    try { sid = (await res.json())?.sid ?? null; } catch (_) { /* non-JSON */ }
    await supabase.from("admin_alert_log").insert({
      channel: "twilio_whatsapp",
      event: "quote_request",
      status: "sent",
      provider_message_id: sid,
      payload: { inquiry_id: inquiry.id, to, from, message: body },
      error: null,
    });
  } catch (err) {
    console.error("Quote WhatsApp alert error:", err);
    try {
      await supabase.from("admin_alert_log").insert({
        channel: "twilio_whatsapp",
        event: "quote_request",
        status: "failed",
        payload: { inquiry_id: inquiry.id, product: inquiry.productName, email: inquiry.email },
        error: String(err instanceof Error ? err.message : err).slice(0, 2000),
      });
    } catch (_) { /* non-fatal */ }
  }
}

async function verifyTurnstile(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.warn("TURNSTILE_SECRET_KEY not configured — skipping verification");
    return true;
  }
  if (!token) return false;
  try {
    const form = new FormData();
    form.append("secret", secret);
    form.append("response", token);
    if (ip && ip !== "unknown") form.append("remoteip", ip);
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!data.success) console.warn("Turnstile verification failed:", data["error-codes"]);
    return !!data.success;
  } catch (err) {
    console.error("Turnstile verify error:", err);
    return false;
  }
}

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

    const {
      name, firm, company, email, phone, message, subject, turnstileToken,
      productId, productSlug, productName, designerName, selectedFinish, source,
    } = parsed.data;

    // Signed-in callers (e.g. the trade registration form, which submits right
    // after sign-up) are already authenticated, so the bot check is skipped.
    let isAuthenticated = false;
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : "";
    if (bearer && bearer !== Deno.env.get("SUPABASE_ANON_KEY")) {
      try {
        const authClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        const { data: claimsData } = await authClient.auth.getClaims(bearer);
        isAuthenticated = !!claimsData?.claims?.sub;
      } catch (_e) {
        isAuthenticated = false;
      }
    }

    if (!isAuthenticated) {
      const turnstileOk = await verifyTurnstile(turnstileToken, clientIp);
      if (!turnstileOk) {
        return new Response(
          JSON.stringify({ error: "Bot check failed. Please retry." }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }


    const companyName = firm || company || "";
    console.log("Received inquiry from:", name, email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const idStem = crypto.randomUUID();

    // Persist the inquiry so it appears in the admin side, not just email.
    const userAgent = req.headers.get("user-agent") || null;
    const resolvedSource = source || (productId || productSlug ? "public_product" : "contact_form");
    const { error: insertErr } = await supabase.from("inquiries").insert({
      id: idStem,
      name,
      company: companyName || null,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
      source: resolvedSource,
      product_id: productId || null,
      product_slug: productSlug || null,
      product_name: productName || null,
      designer_name: designerName || null,
      selected_finish: selectedFinish || null,
      status: "new",
      ip_address: clientIp === "unknown" ? null : clientIp,
      user_agent: userAgent,
    });
    if (insertErr) {
      console.error("Inquiry insert failed:", insertErr);
      throw new Error(`Inquiry insert failed: ${insertErr.message}`);
    }



    // 1. Admin notification → concierge + owner inbox
    for (const adminEmail of ADMIN_EMAILS) {
      const { error: notifyErr } = await supabase.functions.invoke(
        "send-transactional-email",
        {
          body: {
            templateName: "inquiry-notification",
            recipientEmail: adminEmail,
            idempotencyKey: `inquiry-notify-${idStem}-${adminEmail}`,
            templateData: {
              name,
              company: companyName,
              email,
              phone,
              message,
              subject,
              productName,
              designerName,
              selectedFinish,
            },
          },
        }
      );
      if (notifyErr) console.error(`Notification enqueue failed for ${adminEmail}:`, notifyErr);
    }

    // 2. Confirmation → visitor
    const { error: confirmErr } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "inquiry-confirmation",
          recipientEmail: email,
          idempotencyKey: `inquiry-confirm-${idStem}`,
          templateData: { name, message },
        },
      }
    );
    if (confirmErr) console.error("Confirmation enqueue failed:", confirmErr);


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
