import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json().catch(() => ({}));
    const token = typeof body.token === "string" ? body.token.trim() : "";
    const action = body.action === "checkout" ? "checkout" : "info";
    if (!token || token.length < 8 || token.length > 128) {
      return json({ error: "Invalid payment link" }, 400);
    }

    const { data: link } = await supabase
      .from("quote_payment_links")
      .select("id, quote_id, amount_cents, currency, label, payer_email, payer_name, status, expires_at, paid_at")
      .eq("token", token)
      .maybeSingle();

    if (!link) return json({ error: "This payment link is not valid." }, 404);
    if (link.status === "paid" || link.paid_at) {
      return json({ error: "This payment has already been completed.", state: "paid" }, 409);
    }
    if (link.status !== "active") {
      return json({ error: "This payment link is no longer active.", state: "inactive" }, 409);
    }
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return json({ error: "This payment link has expired.", state: "expired" }, 409);
    }

    const { data: quote } = await supabase
      .from("trade_quotes")
      .select("id, client_name")
      .eq("id", link.quote_id)
      .maybeSingle();

    const quoteNumber = `QU-${link.quote_id.slice(0, 6).toUpperCase()}`;
    const currency = (link.currency || "EUR").toLowerCase();

    if (action === "info") {
      return json({
        quoteNumber,
        clientName: quote?.client_name ?? link.payer_name ?? null,
        amountCents: link.amount_cents,
        currency: currency.toUpperCase(),
        label: link.label,
      });
    }

    const { stripe } = await getStripe("auto");

    const origin = req.headers.get("origin") || "https://www.maisonaffluency.com";

    const session = await stripe.checkout.sessions.create({
      customer_email: link.payer_email || undefined,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Maison Affluency — ${quoteNumber}`,
              description: link.label,
            },
            unit_amount: link.amount_cents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        metadata: {
          quote_id: link.quote_id,
          payment_link_id: link.id,
          payment_type: "guest_quote_link",
        },
      },
      metadata: {
        quote_id: link.quote_id,
        payment_link_id: link.id,
        payment_type: "guest_quote_link",
      },
      success_url: `${origin}/pay/${token}?payment=success`,
      cancel_url: `${origin}/pay/${token}?payment=cancelled`,
    });

    await supabase
      .from("quote_payment_links")
      .update({ stripe_session_id: session.id })
      .eq("id", link.id);

    return json({ url: session.url });
  } catch (error) {
    console.error("[guest-quote-checkout]", error);
    return json({ error: "An unexpected error occurred" }, 500);
  }
});
