// Temporary admin diagnostic: creates + confirms a €1 TEST-mode PaymentIntent
// so Stripe fires payment_intent.succeeded at the webhook. Test keys only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: c } = await admin.auth.getClaims(jwt);
  const uid = c?.claims?.sub;
  if (!uid) return json({ error: "unauthorized" }, 401);
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", uid).in("role", ["admin", "super_admin"]);
  if (!roles?.length) return json({ error: "forbidden" }, 403);
  const envKey = (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "").trim();
  const envOk = /^(sk|rk)_test_/.test(envKey);
  const { data: pc } = await admin.from("payment_credentials").select("test_secret_key").limit(1).maybeSingle();
  const key = envOk ? envKey : ((pc?.test_secret_key as string) ?? "").trim();
  if (!/^(sk|rk)_test_/.test(key)) return json({ error: "no test key", envKeyLooksTest: envOk }, 400);
  const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  const pi = await stripe.paymentIntents.create({
    amount: 100, currency: "eur", payment_method: "pm_card_visa", confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    description: "Webhook verification test", metadata: { source: "stripe-test-ping" },
  });
  return json({ keySource: envOk ? "secret" : "payment_settings", id: pi.id, status: pi.status, livemode: pi.livemode });
});
