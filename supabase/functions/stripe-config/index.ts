import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Returns the Stripe *publishable* key so the browser can mount Stripe Elements.
 * Publishable keys are safe to expose client-side, so a literal fallback is fine.
 */
const FALLBACK_PUBLISHABLE_KEY =
  "pk_live_51Rl10BS0Atf7jTffjQ155TVJhioTG62NnP9YB0WOpd3EWVAtXXOxpf2ivL9ATZByI5tYfZfZ7E6tsDgueWDQWHRa00ZmcV781i";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const envKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY") || "";
  const key = /^pk_(live|test)_/.test(envKey) ? envKey : FALLBACK_PUBLISHABLE_KEY;
  const valid = /^pk_(live|test)_/.test(key);

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
