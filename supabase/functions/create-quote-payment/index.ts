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
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const { data: claimsData, error: authErr } = await anonClient.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
    const user = claims?.sub && claims.email ? { id: claims.sub, email: claims.email } : null;
    if (authErr || !user?.email) throw new Error("User not authenticated");

    const { quoteId, paymentType = "deposit", shippingCents = 0 } = await req.json();
    if (!quoteId) throw new Error("quoteId is required");
    if (!["deposit", "balance"].includes(paymentType)) throw new Error("Invalid paymentType");
    let shippingCentsSafe = Math.max(0, Math.round(Number(shippingCents) || 0));

    console.log("[create-quote-payment] User:", user.id, "Quote:", quoteId, "Type:", paymentType);

    const { data: quote, error: qErr } = await supabaseClient
      .from("trade_quotes")
      .select("*")
      .eq("id", quoteId)
      .eq("user_id", user.id)
      .single();

    if (qErr || !quote) throw new Error("Quote not found");

    if (paymentType === "deposit" && !["priced", "confirmed"].includes(quote.status)) {
      throw new Error("Quote must be priced or confirmed before deposit payment");
    }
    if (paymentType === "balance" && quote.status !== "deposit_paid") {
      throw new Error("Deposit must be paid before balance payment");
    }

    const billingMode: "agent_commission" | "net_buy" = quote.billing_mode || "agent_commission";

    // Net-buy: managed freight is MANDATORY and locked from a saved shipping_quote.
    // Server-side freight always wins over client-supplied numbers — this is the audit lock.
    if (billingMode === "net_buy") {
      if (!quote.managed_freight_quote_id) {
        throw new Error(
          "Managed freight quote required for net-buy checkout. Attach a freight estimate to this quote before paying.",
        );
      }
      const { data: freight, error: fErr } = await supabaseClient
        .from("shipping_quotes")
        .select("id, total_cents, currency, status")
        .eq("id", quote.managed_freight_quote_id)
        .maybeSingle();
      if (fErr || !freight) {
        throw new Error("Locked managed freight quote not found");
      }
      if (freight.status === "cancelled" || freight.status === "expired") {
        throw new Error(`Managed freight quote is ${freight.status} — re-quote before paying`);
      }
      if ((freight.currency || "").toUpperCase() !== (quote.currency || "").toUpperCase()) {
        throw new Error(
          `Freight quote currency (${freight.currency}) does not match order currency (${quote.currency}). Re-quote in ${quote.currency}.`,
        );
      }
      shippingCentsSafe = Math.max(0, Math.round(Number(freight.total_cents) || 0));
    }

    const { data: items } = await supabaseClient
      .from("trade_quote_items")
      .select("*, trade_products(product_name, brand_name, trade_price_cents, currency)")
      .eq("quote_id", quoteId);

    if (!items || items.length === 0) throw new Error("No items in quote");

    const currency = (quote.currency || "SGD").toLowerCase();
    const currencyUpper = currency.toUpperCase();

    // MSRP subtotal (full retail). Both modes need this as the baseline.
    let msrpSubtotalCents = 0;
    for (const item of items) {
      const unitPrice = item.unit_price_cents ?? item.trade_products?.trade_price_cents ?? 0;
      msrpSubtotalCents += unitPrice * item.quantity;
    }

    // Determine subtotal the payer actually owes:
    //   agent_commission → end-client pays full MSRP (designer collects commission separately via Connect transfer)
    //   net_buy          → designer firm pays MSRP minus net_discount_pct
    const netDiscountPct = Number(quote.net_discount_pct ?? 0);
    const commissionPct = Number(quote.commission_pct ?? 0);

    const payerSubtotalCents =
      billingMode === "net_buy"
        ? Math.round(msrpSubtotalCents * (1 - netDiscountPct / 100))
        : msrpSubtotalCents;

    // GST only applies on the SGD path (Maison-of-record).
    let payerTotalCents = payerSubtotalCents;
    if (currency === "sgd" && payerSubtotalCents > 0) {
      payerTotalCents += Math.round(payerSubtotalCents * 0.09);
    }
    payerTotalCents += shippingCentsSafe;

    // 60% deposit / 40% balance split on the payer-owed total.
    const portionCents = paymentType === "deposit"
      ? Math.round(payerTotalCents * 0.6)
      : Math.round(payerTotalCents * 0.4);

    const { chargeCents } = calculateChargeWithFees(portionCents, currencyUpper);

    // ----------- Mode-specific Stripe Connect routing ------------
    let connectedAccountId: string | null = null;
    let payerEmail = user.email;
    let payerDescription = "";

    if (billingMode === "agent_commission") {
      // End-client is the payer. Pull billing block.
      const ec = (quote.end_client_billing ?? {}) as Record<string, string>;
      if (!ec.email) throw new Error("End-client email missing — capture client billing before charging");
      payerEmail = ec.email;
      payerDescription = `${ec.name ?? "End client"} · agent commission`;

      // Look up designer's Stripe Connect account (must be verified)
      if (!quote.designer_payout_account_id) {
        throw new Error("Designer payout account not selected on quote");
      }
      const { data: payout } = await supabaseClient
        .from("studio_payout_accounts")
        .select("stripe_connect_account_id, stripe_connect_status, currency")
        .eq("id", quote.designer_payout_account_id)
        .single();
      if (!payout?.stripe_connect_account_id) {
        throw new Error("Designer has not completed Stripe Connect onboarding");
      }
      if (payout.stripe_connect_status !== "verified") {
        throw new Error(`Designer Stripe Connect account status is "${payout.stripe_connect_status}" — must be verified`);
      }
      connectedAccountId = payout.stripe_connect_account_id;
    } else {
      // net_buy: designer firm pays. Standard platform charge, no transfer.
      payerDescription = "Designer net purchase · white-labelled to end client";
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: payerEmail, limit: 1 });
    const customerId = customers.data[0]?.id;

    const quoteNumber = `QU-${quoteId.slice(0, 6).toUpperCase()}`;
    const origin = req.headers.get("origin") || "";
    const label = paymentType === "deposit" ? "60% Deposit" : "40% Balance";

    // Commission portion (only meaningful in agent mode). Pro-rate by the portion being charged now.
    const commissionPortionCents =
      billingMode === "agent_commission"
        ? Math.round(msrpSubtotalCents * (commissionPct / 100) * (paymentType === "deposit" ? 0.6 : 0.4))
        : 0;

    // application_fee_amount = what stays on the platform.
    // Net to designer connected account = chargeCents − application_fee_amount.
    // We route the commission portion to the designer; everything else (cost of goods + fees + GST + shipping)
    // stays on the platform so Maison can pay the supplier and freight.
    const applicationFeeAmount =
      billingMode === "agent_commission"
        ? Math.max(0, chargeCents - commissionPortionCents)
        : undefined;

    const paymentIntentData: Record<string, any> = {
      metadata: {
        quote_id: quoteId,
        payment_type: paymentType,
        billing_mode: billingMode,
        currency: currencyUpper,
        msrp_subtotal_cents: String(msrpSubtotalCents),
        payer_total_cents: String(payerTotalCents),
        portion_cents: String(portionCents),
        commission_pct: String(commissionPct),
        net_discount_pct: String(netDiscountPct),
        commission_portion_cents: String(commissionPortionCents),
      },
    };

    if (billingMode === "agent_commission" && connectedAccountId) {
      paymentIntentData.transfer_data = { destination: connectedAccountId };
      paymentIntentData.application_fee_amount = applicationFeeAmount;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : payerEmail,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `Maison Affluency — ${quoteNumber} · ${label}`,
              description: `${items.length} item${items.length > 1 ? "s" : ""} · ${payerDescription} · includes processing fee${currency === "sgd" ? " & GST" : ""}`,
            },
            unit_amount: chargeCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: paymentIntentData,
      metadata: {
        quote_id: quoteId,
        payment_type: paymentType,
        billing_mode: billingMode,
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
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
