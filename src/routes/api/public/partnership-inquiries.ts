import { createFileRoute } from "@tanstack/react-router";
import {
  PARTNERSHIP_INQUIRY_EMAIL,
  validatePartnershipInquiry,
} from "@/lib/partnershipInquiry";

// Public endpoint for the developer pitch inquiry form. Anonymous visitors may
// submit; reading stored inquiries stays behind the admin-only SELECT policy.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = buckets.get(ip);
  if (!entry || now > entry.resetAt) {
    buckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT;
}

/** Subject lines must stay single-line; collapse any whitespace runs. */
function singleLine(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export const Route = createFileRoute("/api/public/partnership-inquiries")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const ip =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          "unknown";
        if (isRateLimited(ip)) {
          return Response.json(
            { error: "Too many inquiries from this connection. Please try again later." },
            { status: 429 },
          );
        }

        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json(
            { error: "The inquiry could not be read. Please try again." },
            { status: 400 },
          );
        }

        const result = validatePartnershipInquiry(payload);
        if (!result.ok) {
          // Automated submissions are acknowledged without being stored.
          if (result.spam) return Response.json({ ok: true });
          return Response.json(
            { error: "Please check the highlighted fields.", fieldErrors: result.errors },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("partnership_inquiries")
          .insert({ ...result.data, source: "developer_pitch" })
          .select("id")
          .single();

        if (error || !data) {
          return Response.json(
            { error: "Your inquiry could not be sent. Please try again." },
            { status: 500 },
          );
        }

        // The stored inquiry is the record of truth; the owner email is
        // best-effort and its recipient is fixed inside the email template.
        try {
          await supabaseAdmin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "inquiry-notification",
              recipientEmail: PARTNERSHIP_INQUIRY_EMAIL,
              idempotencyKey: `partnership-inquiry-${data.id}`,
              templateData: {
                name: result.data.name,
                company: singleLine(result.data.company, 120) || undefined,
                email: result.data.email,
                phone: singleLine(result.data.phone, 30) || undefined,
                message: result.data.message,
                subject: singleLine(
                  `New partnership inquiry — ${result.data.company || result.data.name}`,
                  200,
                ),
              },
            },
          });
        } catch {
          // Delivery failure leaves the stored inquiry intact for the admin inbox.
        }

        return Response.json({ ok: true, id: data.id });
      },
    },
  },
});
