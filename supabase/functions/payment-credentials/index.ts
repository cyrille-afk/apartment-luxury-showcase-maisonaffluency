import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const mask = (value?: string | null) => {
  if (!value) return null;
  const head = value.slice(0, 8);
  const tail = value.slice(-4);
  return `${head}…${tail}`;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    if (authErr || !claims?.sub) throw new Error("Not authenticated");

    const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
      admin.rpc("has_role", { _user_id: claims.sub, _role: "admin" }),
      admin.rpc("has_role", { _user_id: claims.sub, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuperAdmin) throw new Error("Admin access required");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action ?? "status");

    if (action === "save") {
      const publishable = String(body.publishableKey ?? "").replace(/\s/g, "");
      const secret = String(body.secretKey ?? "").replace(/\s/g, "");
      const webhook = String(body.webhookSecret ?? "").replace(/\s/g, "");

      if (!publishable.startsWith("pk_live_")) throw new Error("Publishable key must start with pk_live_");
      if (!secret.startsWith("sk_live_") && !secret.startsWith("rk_live_")) {
        throw new Error("Secret key must start with sk_live_");
      }
      if (!webhook.startsWith("whsec_")) throw new Error("Webhook signing secret must start with whsec_");

      const { error } = await admin.from("payment_credentials").upsert({
        id: "live",
        live_publishable_key: publishable,
        live_secret_key: secret,
        live_webhook_secret: webhook,
        live_mode: true,
        updated_by: claims.sub,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    }

    if (action === "set_mode") {
      const { error } = await admin
        .from("payment_credentials")
        .update({ live_mode: Boolean(body.liveMode), updated_at: new Date().toISOString() })
        .eq("id", "live");
      if (error) throw error;
    }

    const { data: row } = await admin
      .from("payment_credentials")
      .select("live_publishable_key, live_secret_key, live_webhook_secret, live_mode, updated_at")
      .eq("id", "live")
      .maybeSingle();

    const projectRef = (Deno.env.get("SUPABASE_URL") ?? "").replace(/^https?:\/\//, "").split(".")[0];

    return new Response(
      JSON.stringify({
        liveMode: Boolean(row?.live_mode),
        publishableKey: mask(row?.live_publishable_key as string | null),
        secretKey: mask(row?.live_secret_key as string | null),
        webhookSecret: mask(row?.live_webhook_secret as string | null),
        updatedAt: row?.updated_at ?? null,
        webhookUrl: `https://${projectRef}.supabase.co/functions/v1/stripe-webhook`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("[payment-credentials]", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
