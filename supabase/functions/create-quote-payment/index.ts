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
 * For non-SGD we use the same formula but with the equivalent fixed fee in minor units.
 */
const STRIPE_PERCENT_FEE = 0.034;
const STRIPE_FIXED_FEE_MINOR: Record<string, number> = {
  SGD: 50,  // S$0.50
  USD: 30,  // US$0.30
  EUR: 25,  // €0.25
  GBP: 20,  // £0.20
};

function calculateChargeWithFees(netCents: number, currency: string): {
  chargeCents: number;
  feeCents: number;
} {
  const fixedFee = STRIPE_FIXED_FEE_MINOR[currency.toUpperCase()] ?? 50;
  const chargeCents = Math.ceil(
    (netCents + fixedFee) / (1 - STRIPE_PERCENT_FEE)
  );
  return { chargeCents, feeCents: chargeCents - netCents };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;
    if (authErr || !user?.email) throw new Error("User not authenticated");

    const { quoteId } = await req.json();
    if (!quoteId) throw new Error("quoteId is required");

    console.log("[create-quote-payment] User:", user.id, "Quote:", quoteId);

    // Fetch quote — use service role to bypass RLS, but verify ownership
    const { data: quote, error: qErr } = await supabaseClient
      .from("trade_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("user_id", user.id)
      .single();

    if (qErr || !quote) {
      console.error("[create-quote-payment] Quote lookup failed:", qErr?.message);
      throw new Error("Quote not found");
    }
    if (quote.status !== "confirmed") throw new Error("Quote must be confirmed before payment");

    // Fetch quote items with products
    const { data: items } = await supabaseClient
      .from("trade_quote_items")
      .select("*, trade_products(product_name, brand_name, trade_price_cents, currency)")
      .eq("quote_id", quoteId);

    if (!items || items.length === 0) throw new Error("No items in quote");

    // Use the quote's own currency — charge in the same currency the user sees
    const currency = (quote.currency || "SGD").toLowerCase();
    const currencyUpper = currency.toUpperCase();

    // Calculate subtotal in the quote's currency (prices are already in that currency)
    let subtotalCents = 0;
    for (const item of items) {
      const unitPrice = item.unit_price_cents ?? item.trade_products?.trade_price_cents ?? 0;
      subtotalCents += unitPrice * item.quantity;
    }

    // Apply GST for SGD only
    let totalCents = subtotalCents;
    if (currency === "sgd" && subtotalCents > 0) {
      totalCents = subtotalCents + Math.round(subtotalCents * 0.09);
    }

    // Add Stripe processing fees
    const { chargeCents, feeCents } = calculateChargeWithFees(totalCents, currencyUpper);

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
            currency, // charge in the quote's original currency
            product_data: {
              name: `Maison Affluency — ${quoteNumber}`,
              description: `${items.length} item${items.length > 1 ? "s" : ""} · includes processing fee${currency === "sgd" ? " & GST" : ""}`,
            },
            unit_amount: chargeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        quote_id: quoteId,
        currency: currencyUpper,
        net_amount_cents: String(totalCents),
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
