import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Returns the Stripe *publishable* key so the browser can mount Stripe Elements.
 * Publishable keys are safe to expose client-side.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const key = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";
  // Stripe Managed Payments uses `mk_` publishable keys; standard Stripe
  // accounts use `pk_test_` / `pk_live_`. Both are valid Stripe.js keys.
  const valid = /^(?:mk_|pk_(?:live|test)_)/.test(key);

  return new Response(
    JSON.stringify(
      valid ? { publishableKey: key } : { error: "Stripe publishable key is not configured." },
    ),
    {
      status: valid ? 200 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
