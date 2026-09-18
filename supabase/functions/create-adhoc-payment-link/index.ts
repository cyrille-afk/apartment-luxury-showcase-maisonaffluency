import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getStripe } from "../_shared/stripeClient.ts";

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
    const cardId = body.cardId ? String(body.cardId).slice(0, 120) : null;
    const cardStage = body.cardStage ? String(body.cardStage).slice(0, 60) : null;
    const paymentKind = body.paymentKind === "deposit" ? "deposit" : "full";
    const testMode = Boolean(body.testMode);
    const expectedTotalCents = Number.isFinite(Number(body.expectedTotalCents))
      ? Math.round(Number(body.expectedTotalCents))
      : null;

    if (!ALLOWED_CURRENCIES.includes(currency)) throw new Error("Unsupported currency");
    if (!Number.isFinite(amountCents) || amountCents < 100 || amountCents > 500_000_00) {
      throw new Error("Amount must be between 1 and 500,000");
    }

    const { stripe } = await getStripe(testMode ? "test" : "auto");

    // Reuse mode: return the URL of the latest active/paid link for a quote
    // instead of minting a new checkout session (used to resend emails).
    // Durable shareable links always point at our own /pay/:token page, which
    // mints a fresh Stripe session on click. Raw checkout.stripe.com URLs are
    // single-use, expire, and get mangled by email clients.
    const rawOrigin = req.headers.get("origin") || "";
    const publicOrigin = /^https:\/\/(www\.)?maisonaffluency\.com$/.test(rawOrigin)
      ? rawOrigin
      : "https://www.maisonaffluency.com";

    if (body.reuseExisting && quoteId) {
      const { data: existing } = await admin
        .from("quote_payment_links")
        .select("token, stripe_session_id, amount_cents, currency, status")
        .eq("quote_id", quoteId)
        .in("status", ["active", "paid"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!existing?.token) {
        throw new Error("No existing payment link stored for this quote");
      }
      const payUrl = `${publicOrigin}/pay/${existing.token}`;
      return new Response(
        JSON.stringify({
          url: payUrl,
          payUrl,
          token: existing.token,
          sessionId: existing.stripe_session_id,
          amountCents: existing.amount_cents,
          currency: existing.currency,
          reused: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    const origin = rawOrigin || "https://www.maisonaffluency.com";

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
        source: testMode ? "sales_funnel_adhoc_test" : "sales_funnel_adhoc",
        created_by: claims.sub,
        quote_id: quoteId ?? "",
        cardId: cardId ?? "",
        card_stage: cardStage ?? "",
        payment_kind: paymentKind,
      },
      payment_intent_data: {
        metadata: {
          source: testMode ? "sales_funnel_adhoc_test" : "sales_funnel_adhoc",
          cardId: cardId ?? "",
          card_stage: cardStage ?? "",
          payment_kind: paymentKind,
          quote_id: quoteId ?? "",
        },
      },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/payment-failed?reason=cancelled&session_id={CHECKOUT_SESSION_ID}`,
    });

    let payToken: string | null = null;
    if (quoteId) {
      const { data: inserted, error: linkErr } = await admin
        .from("quote_payment_links")
        .insert({
          quote_id: quoteId,
          amount_cents: amountCents,
          currency,
          label,
          payer_email: payerEmail,
          status: "active",
          stripe_session_id: session.id,
          created_by: claims.sub,
        })
        .select("token")
        .single();
      if (linkErr) console.error("[create-adhoc-payment-link] link insert", linkErr);
      payToken = inserted?.token ?? null;
    }

    if (cardId) {
      const { error: cardErr } = await admin.from("funnel_card_payments").insert({
        card_id: cardId,
        card_stage: cardStage,
        label,
        amount_cents: amountCents,
        expected_total_cents: expectedTotalCents ?? (paymentKind === "full" ? amountCents : null),
        currency,
        payment_kind: paymentKind,
        status: "pending",
        stripe_session_id: session.id,
        payer_email: payerEmail,
        quote_id: quoteId,
        created_by: claims.sub,
      });
      if (cardErr) console.error("[create-adhoc-payment-link] card payment insert", cardErr);
    }

    const payUrl = payToken ? `${publicOrigin}/pay/${payToken}` : session.url;

    return new Response(JSON.stringify({ url: payUrl, payUrl, token: payToken, stripeUrl: session.url, sessionId: session.id }), {
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
