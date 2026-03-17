import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const STRIPE_PERCENT_FEE = 0.034;
const STRIPE_FIXED_FEE_MINOR: Record<string, number> = {
  SGD: 50,
  USD: 30,
  EUR: 25,
  GBP: 20,
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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabaseClient.auth.getUser(token);
    const user = userData?.user;
    if (authErr || !user?.email) throw new Error("User not authenticated");

    const { quoteId, paymentType = "deposit" } = await req.json();
    if (!quoteId) throw new Error("quoteId is required");
    if (!["deposit", "balance"].includes(paymentType)) throw new Error("Invalid paymentType");

    console.log("[create-quote-payment] User:", user.id, "Quote:", quoteId, "Type:", paymentType);

    const { data: quote, error: qErr } = await supabaseClient
      .from("trade_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("user_id", user.id)
      .single();

    if (qErr || !quote) throw new Error("Quote not found");

    // Validate status: deposit requires "confirmed", balance requires "deposit_paid"
    if (paymentType === "deposit" && quote.status !== "confirmed") {
      throw new Error("Quote must be confirmed before deposit payment");
    }
    if (paymentType === "balance" && quote.status !== "deposit_paid") {
      throw new Error("Deposit must be paid before balance payment");
    }

    const { data: items } = await supabaseClient
      .from("trade_quote_items")
      .select("*, trade_products(product_name, brand_name, trade_price_cents, currency)")
      .eq("quote_id", quoteId);

    if (!items || items.length === 0) throw new Error("No items in quote");

    const currency = (quote.currency || "SGD").toLowerCase();
    const currencyUpper = currency.toUpperCase();

    let subtotalCents = 0;
    for (const item of items) {
      const unitPrice = item.unit_price_cents ?? item.trade_products?.trade_price_cents ?? 0;
      subtotalCents += unitPrice * item.quantity;
    }

    // Apply GST for SGD
    let totalCents = subtotalCents;
    if (currency === "sgd" && subtotalCents > 0) {
      totalCents = subtotalCents + Math.round(subtotalCents * 0.09);
    }

    // Calculate the portion: 60% deposit or 40% balance
    const portionCents = paymentType === "deposit"
      ? Math.round(totalCents * 0.6)
      : Math.round(totalCents * 0.4);

    // Add Stripe processing fees on the portion
    const { chargeCents } = calculateChargeWithFees(portionCents, currencyUpper);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
    const origin = req.headers.get("origin") || "";
    const label = paymentType === "deposit" ? "60% Deposit" : "40% Balance";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Maison Affluency — ${quoteNumber} · ${label}`,
              description: `${items.length} item${items.length > 1 ? "s" : ""} · ${label.toLowerCase()} · includes processing fee${currency === "sgd" ? " & GST" : ""}`,
            },
            unit_amount: chargeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        quote_id: quoteId,
        payment_type: paymentType,
        currency: currencyUpper,
        net_amount_cents: String(portionCents),
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
