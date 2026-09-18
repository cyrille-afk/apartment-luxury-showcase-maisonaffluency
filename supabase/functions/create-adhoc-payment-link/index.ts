import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_CURRENCIES = ["USD", "EUR", "GBP", "SGD", "HKD", "AED", "CHF"];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: claimsData, error: authErr } = await anon.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
    if (authErr || !claims?.sub) throw new Error("Not authenticated");

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: claims.sub,
      _role: "admin",
    });
    const { data: isSuperAdmin } = await admin.rpc("has_role", {
      _user_id: claims.sub,
      _role: "super_admin",
    });
    if (!isAdmin && !isSuperAdmin) throw new Error("Admin access required");

    const body = await req.json();
    const currency = String(body.currency ?? "USD").toUpperCase();
    const amountCents = Math.round(Number(body.amountCents));
    const label = String(body.label ?? "Maison Affluency").slice(0, 120);
    const payerEmail = body.payerEmail ? String(body.payerEmail).slice(0, 255) : null;
    const quoteId = body.quoteId ? String(body.quoteId) : null;

    if (!ALLOWED_CURRENCIES.includes(currency)) throw new Error("Unsupported currency");
    if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 500_000_00) {
      throw new Error("Amount must be between 1 and 500,000");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://www.maisonaffluency.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: payerEmail ?? undefined,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: label },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        source: "sales_funnel_adhoc",
        created_by: claims.sub,
        quote_id: quoteId ?? "",
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/trade/admin/sales-funnel`,
    });

    if (quoteId) {
      await admin.from("quote_payment_links").insert({
        quote_id: quoteId,
        amount_cents: amountCents,
        currency,
        label,
        payer_email: payerEmail,
        status: "active",
        stripe_session_id: session.id,
        created_by: claims.sub,
      });
    }

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("[create-adhoc-payment-link]", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
