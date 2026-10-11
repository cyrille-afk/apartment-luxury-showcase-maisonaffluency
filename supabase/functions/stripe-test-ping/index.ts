// Temporary admin diagnostic: creates + confirms a €1 TEST-mode PaymentIntent
// so Stripe fires payment_intent.succeeded at the webhook. Test keys only.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import Stripe from "https://esm.sh/stripe@18.5.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const token = Deno.env.get("E2E_SETUP_TOKEN") ?? "";
  if (!token || req.headers.get("x-setup-token") !== token) return json({ error: "forbidden" }, 403);
  const key = (Deno.env.get("STRIPE_TEST_SECRET_KEY") ?? "").trim();
  if (!key.startsWith("sk_test_")) return json({ error: "test key missing or not sk_test_" }, 400);
  const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });
  const pi = await stripe.paymentIntents.create({
    amount: 100, currency: "eur", payment_method: "pm_card_visa", confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    description: "Webhook verification test", metadata: { source: "stripe-test-ping" },
  });
  return json({ id: pi.id, status: pi.status, livemode: pi.livemode });
});
