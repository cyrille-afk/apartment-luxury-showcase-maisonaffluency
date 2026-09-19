// Launch-day cutover guardrail: verifies the production environment is armed.
//
// Admin-only. Reports, per required credential, whether it is present and
// whether it carries a *live* (not test/sandbox) shape. Never returns, logs or
// echoes any secret value — only presence, shape and a short fingerprint.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { loadStripeCreds } from "../_shared/stripeCreds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const env = (n: string) => (Deno.env.get(n) ?? "").trim();

/** Non-reversible tail fingerprint so operators can compare keys safely. */
const fingerprint = (v: string) => (v ? `…${v.slice(-4)}` : null);

type Check = {
  key: string;
  present: boolean;
  live: boolean;
  fingerprint: string | null;
  note: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: claimsData, error: authErr } = await anon.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string } | undefined;
    if (authErr || !claims?.sub) return json({ error: "Not authenticated" }, 401);
    const [{ data: isAdmin }, { data: isSuper }] = await Promise.all([
      admin.rpc("has_role", { _user_id: claims.sub, _role: "admin" }),
      admin.rpc("has_role", { _user_id: claims.sub, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuper) return json({ error: "Admin access required" }, 403);

    // ---------------------------------------------------------------- Stripe
    const stripe = await loadStripeCreds();
    const checks: Check[] = [];

    checks.push({
      key: "STRIPE_SECRET_KEY",
      present: Boolean(stripe.secretKey),
      live: stripe.liveMode,
      fingerprint: fingerprint(stripe.secretKey),
      note: stripe.secretKey
        ? `resolved from ${stripe.source}; ${stripe.liveMode ? "live production key" : "TEST key — live payments will not settle"}`
        : "missing — checkout cannot run",
    });

    checks.push({
      key: "STRIPE_WEBHOOK_SECRET",
      present: Boolean(stripe.webhookSecret),
      live: Boolean(stripe.webhookSecret) && stripe.liveMode,
      fingerprint: fingerprint(stripe.webhookSecret),
      note: stripe.webhookSecret
        ? "signing secret resolved for the active Stripe mode"
        : "missing — paid orders will never reach the queue",
    });

    // ---------------------------------------------------------------- Resend
    const resend = env("RESEND_API_KEY");
    checks.push({
      key: "RESEND_API_KEY",
      present: Boolean(resend),
      live: resend.startsWith("re_") && !resend.startsWith("re_test_"),
      fingerprint: fingerprint(resend),
      note: !resend
        ? "missing — no transactional email will be delivered"
        : resend.startsWith("re_test_")
          ? "Resend TEST key — messages are sandboxed"
          : "production Resend key",
    });

    // ---------------------------------------------------------------- Twilio
    // Live SMS/WhatsApp needs an account SID (AC…) plus an auth token or API key.
    const twilioSid = env("TWILIO_ACCOUNT_SID");
    const twilioAuth = env("TWILIO_AUTH_TOKEN") || env("TWILIO_API_KEY");
    checks.push({
      key: "TWILIO_ACCOUNT_SID",
      present: Boolean(twilioSid),
      live: /^AC[0-9a-f]{32}$/i.test(twilioSid),
      fingerprint: fingerprint(twilioSid),
      note: twilioSid
        ? /^AC/i.test(twilioSid)
          ? "production account SID"
          : "value does not look like a Twilio account SID (expects AC…)"
        : "missing — WhatsApp/SMS alerts will not send",
    });
    checks.push({
      key: "TWILIO_AUTH_TOKEN",
      present: Boolean(twilioAuth),
      live: Boolean(twilioAuth),
      fingerprint: fingerprint(twilioAuth),
      note: twilioAuth
        ? "auth credential present (TWILIO_AUTH_TOKEN or TWILIO_API_KEY)"
        : "missing — Twilio requests will be rejected",
    });
    checks.push({
      key: "TWILIO_WHATSAPP_FROM",
      present: Boolean(env("TWILIO_WHATSAPP_FROM")),
      live: Boolean(env("TWILIO_WHATSAPP_FROM")),
      fingerprint: null,
      note: env("TWILIO_WHATSAPP_FROM") ? "sender configured" : "missing — no WhatsApp sender",
    });

    const missing = checks.filter((c) => !c.present).map((c) => c.key);
    const notLive = checks.filter((c) => c.present && !c.live).map((c) => c.key);

    return json({
      ok: missing.length === 0 && notLive.length === 0,
      checked_at: new Date().toISOString(),
      stripe_mode: stripe.liveMode ? "live" : "test",
      stripe_credential_source: stripe.source,
      passed: checks.filter((c) => c.present && c.live).map((c) => c.key),
      missing,
      not_live: notLive,
      checks,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
