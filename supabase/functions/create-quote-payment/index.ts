import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Stripe fee parameters — adjust per your Stripe account's rates.
 * Default: 3.4% + S$0.50 (Singapore domestic card rate).
 */
const STRIPE_PERCENT_FEE = 0.034;
const STRIPE_FIXED_FEE_CENTS = 50; // in minor currency units (SGD cents)

function calculateChargeWithFees(netCents: number): {
  chargeCents: number;
  feeCents: number;
} {
  const chargeCents = Math.ceil(
    (netCents + STRIPE_FIXED_FEE_CENTS) / (1 - STRIPE_PERCENT_FEE)
  );
  return { chargeCents, feeCents: chargeCents - netCents };
}

/** Fetch live FX rate from frankfurter.app */
async function fetchRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${from}&to=${to}`);
    const data = await res.json();
    if (data.rates?.[to]) return data.rates[to];
  } catch {
    // fall through to fallback
  }
  // Hardcoded fallback rates to SGD
  const fallback: Record<string, number> = {
    USD_SGD: 1.34,
    EUR_SGD: 1.46,
    GBP_SGD: 1.70,
  };
  return fallback[`${from}_${to}`] || 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { quoteId } = await req.json();
    if (!quoteId) throw new Error("quoteId is required");

    // Fetch quote
    const { data: quote, error: qErr } = await supabaseClient
      .from("trade_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("user_id", user.id)
      .single();

    if (qErr || !quote) throw new Error("Quote not found");
    if (quote.status !== "confirmed") throw new Error("Quote must be confirmed before payment");

    // Fetch quote items with products
    const { data: items } = await supabaseClient
      .from("trade_quote_items")
      .select("*, trade_products(product_name, brand_name, trade_price_cents, currency)")
      .eq("quote_id", quoteId);

    if (!items || items.length === 0) throw new Error("No items in quote");

    // Collect unique product currencies that need conversion to SGD
    const productCurrencies = new Set<string>();
    for (const item of items) {
      const cur = item.trade_products?.currency || "SGD";
      if (cur !== "SGD") productCurrencies.add(cur);
    }

    // Fetch all needed FX rates in parallel
    const rateMap: Record<string, number> = { SGD: 1 };
    await Promise.all(
      Array.from(productCurrencies).map(async (cur) => {
        rateMap[cur] = await fetchRate(cur, "SGD");
      })
    );

    // Calculate subtotal in SGD cents, converting each product's price
    let subtotalSgdCents = 0;
    for (const item of items) {
      const unitPrice = item.unit_price_cents ?? item.trade_products?.trade_price_cents ?? 0;
      const prodCurrency = item.trade_products?.currency || "SGD";
      const rate = rateMap[prodCurrency] || 1;
      const unitPriceSgd = Math.round(unitPrice * rate);
      subtotalSgdCents += unitPriceSgd * item.quantity;
    }

    // Apply GST (9%) — always SGD now
    let totalSgdCents = subtotalSgdCents;
    if (subtotalSgdCents > 0) {
      totalSgdCents = subtotalSgdCents + Math.round(subtotalSgdCents * 0.09);
    }

    // Add Stripe fees
    const { chargeCents, feeCents } = calculateChargeWithFees(totalSgdCents);

    // Init Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
    const origin = req.headers.get("origin") || "";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "sgd",
            product_data: {
              name: `Maison Affluency — ${quoteNumber}`,
              description: `${items.length} item${items.length > 1 ? "s" : ""} · converted to SGD · includes GST & processing fee`,
            },
            unit_amount: chargeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        quote_id: quoteId,
        net_amount_sgd_cents: String(totalSgdCents),
        fee_cents: String(feeCents),
      },
      success_url: `${origin}/trade/quotes?payment=success&quote=${quoteId}`,
      cancel_url: `${origin}/trade/quotes?payment=cancelled&quote=${quoteId}`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error in create-quote-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
