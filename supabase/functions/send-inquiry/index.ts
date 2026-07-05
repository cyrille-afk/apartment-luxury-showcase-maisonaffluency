import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_EMAIL = "concierge@myaffluency.com";

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
});

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

    const { name, firm, company, email, phone, message, subject, turnstileToken } = parsed.data;

    const turnstileOk = await verifyTurnstile(turnstileToken, clientIp);
    if (!turnstileOk) {
      return new Response(
        JSON.stringify({ error: "Bot check failed. Please retry." }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const companyName = firm || company || "";
    console.log("Received inquiry from:", name, email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const idStem = crypto.randomUUID();

    // Persist the inquiry so it appears in the admin side, not just email.
    const userAgent = req.headers.get("user-agent") || null;
    const { error: insertErr } = await supabase.from("inquiries").insert({
      id: idStem,
      name,
      company: companyName || null,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
      source: "send-inquiry",
      ip_address: clientIp === "unknown" ? null : clientIp,
      user_agent: userAgent,
    });
    if (insertErr) console.error("Inquiry insert failed:", insertErr);


    // 1. Admin notification → concierge inbox
    const { error: notifyErr } = await supabase.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "inquiry-notification",
          recipientEmail: ADMIN_EMAIL,
          idempotencyKey: `inquiry-notify-${idStem}`,
          templateData: {
            name,
            company: companyName,
            email,
            phone,
            message,
            subject,
          },
        },
      }
    );
    if (notifyErr) console.error("Notification enqueue failed:", notifyErr);

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
