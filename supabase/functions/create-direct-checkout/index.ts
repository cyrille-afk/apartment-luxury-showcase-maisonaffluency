import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SITE_URL = "https://www.maisonaffluency.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ---- Auth (JWT validated in code) ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required." }, 401);

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    const claims = claimsData?.claims as Record<string, unknown> | undefined;
    if (claimsError || !claims?.sub) return json({ error: "Invalid session." }, 401);
    const userEmail = typeof claims.email === "string" ? claims.email : null;

    // ---- Input validation ----
    const body = await req.json().catch(() => ({}));
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const selectedFinish =
      typeof body?.selectedFinish === "string" ? body.selectedFinish.trim().slice(0, 250) : "";
    const rawPrice = Number(body?.price);
    const currency = (typeof body?.currency === "string" ? body.currency : "usd").toLowerCase();
    const quantity = Math.min(20, Math.max(1, Math.round(Number(body?.quantity) || 1)));

    if (!title || title.length > 200) return json({ error: "A valid product title is required." }, 400);
    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      return json({ error: "A valid price is required." }, 400);
    }
    // `price` arrives as a major-unit amount (e.g. 57000) → convert to cents.
    const unitAmount = Math.round(rawPrice * 100);
    if (unitAmount < 100 || unitAmount > 100_000_00 * 100) {
      return json({ error: "Price out of range." }, 400);
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Payments are not configured." }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse an existing Stripe customer when we already know this buyer.
    let customerId: string | undefined;
    if (userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length) customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || SITE_URL;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail ?? undefined,
      mode: "payment",
      line_items: [
        {
          quantity,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: title.slice(0, 250),
              description: selectedFinish ? `Finish: ${selectedFinish}` : undefined,
            },
          },
        },
      ],
      success_url: `${origin}/order-confirmation?status=paid&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout-cancelled`,
      metadata: {
        payment_type: "direct_checkout",
        user_id: String(claims.sub),
        product_title: title.slice(0, 200),
        selected_finish: selectedFinish || "",
      },
    });

    return json({ url: session.url });
  } catch (err) {
    console.error("[create-direct-checkout] error", err);
    return json({ error: "Unable to start checkout." }, 500);
  }
});
