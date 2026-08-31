// Frictionless quote/customisation intake for the public product modal.
//
// Actions:
//   { action: "check_email", email }  -> { exists: boolean }   (rate limited)
//   { action: "submit", email, brief, files[], product context } -> { success }
//
// Files are uploaded with the service role into the private `floor-plans`
// bucket under `quote-briefs/<id>/`, and 7-day signed links are appended to
// the inquiry body so the concierge team can open them from the inbox.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Best-effort in-memory rate limiting (per edge instance).
const buckets = new Map<string, { count: number; resetAt: number }>();
function limited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  b.count++;
  return b.count > max;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_FILES = 5;
const MAX_BYTES = 12 * 1024 * 1024; // per file, decoded

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return json({ error: "A valid email address is required" }, 400);
  }

  // ---------- Account lookup ----------
  if (body?.action === "check_email") {
    if (limited(`check:${ip}`, 30, 10 * 60 * 1000)) {
      return json({ error: "Too many requests" }, 429);
    }
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, trade_tier")
      .ilike("email", email)
      .limit(1);
    if (error) {
      console.error("check_email failed", error);
      return json({ exists: false });
    }
    const profile = data?.[0] ?? null;
    return json({
      exists: Boolean(profile),
      firstName: profile?.first_name || "",
      tier: profile?.trade_tier || "standard",
    });
  }

  // ---------- Brief submission ----------
  if (body?.action !== "submit") return json({ error: "Unknown action" }, 400);

  if (limited(`submit:${ip}`, 6, 15 * 60 * 1000)) {
    return json({ error: "Too many requests. Please try again later." }, 429);
  }

  const brief = String(body?.brief ?? "").trim().slice(0, 4000);
  const productName = body?.productName ? String(body.productName).slice(0, 200) : null;
  const designerName = body?.designerName ? String(body.designerName).slice(0, 200) : null;
  const pageUrl = body?.pageUrl ? String(body.pageUrl).slice(0, 500) : null;

  const rawFiles: any[] = Array.isArray(body?.files) ? body.files.slice(0, MAX_FILES) : [];
  const inquiryId = crypto.randomUUID();
  const links: string[] = [];

  for (const f of rawFiles) {
    try {
      const name = String(f?.name ?? "file").replace(/[^\w.\-]+/g, "_").slice(0, 120);
      const dataUrl = String(f?.dataUrl ?? "");
      const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
      if (!base64) continue;
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      if (bin.byteLength > MAX_BYTES) {
        links.push(`${name} — skipped (over 12 MB)`);
        continue;
      }
      const path = `quote-briefs/${inquiryId}/${name}`;
      const { error: upErr } = await supabase.storage
        .from("floor-plans")
        .upload(path, bin, {
          contentType: String(f?.type || "application/octet-stream"),
          upsert: true,
        });
      if (upErr) {
        console.error("brief upload failed", upErr);
        links.push(`${name} — upload failed`);
        continue;
      }
      const { data: signed } = await supabase.storage
        .from("floor-plans")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      links.push(`${name}: ${signed?.signedUrl ?? path}`);
    } catch (e) {
      console.error("brief file error", e);
    }
  }

  const messageLines = [
    productName ? `Product: ${productName}` : "",
    designerName ? `Designer: ${designerName}` : "",
    pageUrl ? `Page: ${pageUrl}` : "",
    "",
    brief || "(No brief description provided.)",
    links.length ? "" : "",
    links.length ? "Attachments:" : "",
    ...links.map((l) => `- ${l}`),
  ].filter((l) => l !== undefined);

  const message = messageLines.join("\n").trim();
  const derivedName = email.split("@")[0].replace(/[._-]+/g, " ").slice(0, 100) || "Trade enquiry";

  const { error: insertErr } = await supabase.from("inquiries").insert({
    id: inquiryId,
    name: derivedName,
    email,
    message,
    subject: productName ? `Quote / customisation – ${productName}` : "Quote / customisation request",
    source: "public_product",
    product_name: productName,
    designer_name: designerName,
    status: "new",
    ip_address: ip === "unknown" ? null : ip,
    user_agent: req.headers.get("user-agent"),
  });
  if (insertErr) {
    console.error("inquiry insert failed", insertErr);
    return json({ error: "Could not record your brief. Please try again." }, 500);
  }

  supabase.functions
    .invoke("send-transactional-email", {
      body: {
        templateName: "inquiry-notification",
        recipientEmail: "concierge@myaffluency.com",
        idempotencyKey: `brief-notify-${inquiryId}`,
        templateData: {
          name: derivedName,
          company: "",
          email,
          phone: "",
          message,
          subject: productName ? `Quote / customisation – ${productName}` : "Quote / customisation request",
        },
      },
    })
    .catch((e: unknown) => console.error("notify failed", e));

  supabase.functions
    .invoke("send-transactional-email", {
      body: {
        templateName: "inquiry-confirmation",
        recipientEmail: email,
        idempotencyKey: `brief-confirm-${inquiryId}`,
        templateData: { name: derivedName, message: brief },
      },
    })
    .catch((e: unknown) => console.error("confirmation failed", e));

  // New (guest) email → send the standard onboarding verification link.
  try {
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1);
    if ((existing?.length ?? 0) === 0) {
      const origin = (() => {
        try {
          return pageUrl ? new URL(pageUrl).origin : "https://maisonaffluency.com";
        } catch {
          return "https://maisonaffluency.com";
        }
      })();
      await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/trade/launch?next=/trade`,
      });
    }
  } catch (e) {
    console.error("guest onboarding link failed", e);
  }

  return json({ success: true, id: inquiryId });

});
