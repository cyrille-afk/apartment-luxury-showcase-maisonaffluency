// Developer-only storefront checkout audit endpoint.
//
// Scope is deliberately narrow: it creates a Stripe Checkout Session for a
// throwaway verification product and reports back the raw session URL.
// It NEVER touches email templates, PDF publication or the /pay token routes —
// keeping checkout URL generation isolated from document delivery.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getStripe } from "../_shared/stripeClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SITE_URL = "https://www.maisonaffluency.com";

// Zero-decimal currencies must not be multiplied by 100.
const ZERO_DECIMAL = new Set(["jpy", "krw", "vnd", "clp", "isk"]);

// Minimal live verification amounts per currency (major units).
const LIVE_VERIFICATION_AMOUNT: Record<string, number> = {
  hkd: 10,
  usd: 2,
  eur: 2,
  gbp: 2,
  sgd: 2,
  aed: 10,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    // ---- Admin-only ----
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { auth: { persistSession: false } },
    );
    const { data: claimsData, error: authErr } = await anon.auth.getClaims(token);
    const claims = claimsData?.claims as { sub?: string; email?: string } | undefined;
    if (authErr || !claims?.sub) return json({ error: "Not authenticated" }, 401);

    const [{ data: isAdmin }, { data: isSuperAdmin }] = await Promise.all([
      admin.rpc("has_role", { _user_id: claims.sub, _role: "admin" }),
      admin.rpc("has_role", { _user_id: claims.sub, _role: "super_admin" }),
    ]);
    if (!isAdmin && !isSuperAdmin) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const action = String((body as any).action ?? "checkout");

    // ---- Audit an existing session (post-redirect webhook verification) ----
    if (action === "audit") {
      const sessionId = String((body as any).sessionId ?? "").trim();
      if (!/^cs_(test|live)_[A-Za-z0-9]{10,}$/.test(sessionId)) {
        return json({ error: "Invalid session identifier." }, 400);
      }
      const testMode = Boolean((body as any).testMode);
      const { stripe, liveMode } = await getStripe(testMode ? "test" : "auto");
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"],
      });

      // `orders.transaction_id` is the Checkout Session id written by the
      // stripe-webhook direct_checkout branch. Duplicates are tolerated by the
      // webhook, so read the newest row rather than assuming exactly one.
      const { data: orders, error: orderErr } = await admin
        .from("orders")
        .select("id, product_name, amount_total, currency, status, customer_email, created_at")
        .eq("transaction_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (orderErr) console.error("[dev-checkout-test] order lookup failed", orderErr);
      const order = orders?.[0] ?? null;

      const zeroDecimal = ZERO_DECIMAL.has(String(session.currency ?? "").toLowerCase());

      return json({
        mode: liveMode ? "live" : "test",
        session: {
          id: session.id,
          status: session.status,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency,
          zeroDecimal,
          email: session.customer_details?.email ?? session.customer_email ?? null,
          receiptEmail:
            (session.payment_intent && typeof session.payment_intent !== "string"
              ? (session.payment_intent as { receipt_email?: string | null }).receipt_email
              : null) ?? null,
          url: session.url ?? null,
        },
        orderRecorded: Boolean(order),
        orderLookupFailed: Boolean(orderErr),
        order,
      });
    }

    // ---- Create a verification checkout session ----
    const testMode = Boolean((body as any).testMode);
    const currency = String((body as any).currency ?? "hkd").toLowerCase().slice(0, 3);
    const { stripe, liveMode, source } = await getStripe(testMode ? "test" : "auto");

    if (!testMode && !liveMode) {
      return json(
        { error: "Live mode requested but no live Stripe key is configured. Add it in Payment Settings." },
        400,
      );
    }

    const majorAmount = testMode
      ? (LIVE_VERIFICATION_AMOUNT[currency] ?? 10)
      : (LIVE_VERIFICATION_AMOUNT[currency] ?? 10);
    const unitAmount = ZERO_DECIMAL.has(currency)
      ? Math.round(majorAmount)
      : Math.round(majorAmount * 100);

    const origin = req.headers.get("origin") || SITE_URL;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: claims.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            product_data: {
              name: liveMode
                ? "Checkout Verification (Internal)"
                : "[TEST] Checkout Verification (Internal)",
              description: "Temporary internal verification of the storefront checkout pipeline.",
            },
          },
        },
      ],
      // Same handler path as the real storefront so the audit exercises
      // the production webhook branch end to end.
      success_url: `${origin}/dev-checkout-test?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/dev-checkout-test?cancelled=1`,
      metadata: {
        payment_type: "direct_checkout",
        user_id: String(claims.sub),
        product_title: liveMode ? "Checkout Verification (Internal)" : "[TEST] Checkout Verification (Internal)",
        selected_finish: "",
        dev_checkout_audit: "true",
      },
    });

    return json({
      // Raw Stripe URL only — no email, PDF or token indirection on this path.
      url: session.url,
      sessionId: session.id,
      mode: liveMode ? "live" : "test",
      source,
      amount: majorAmount,
      currency: currency.toUpperCase(),
    });
  } catch (err) {
    console.error("[dev-checkout-test] error", err);
    return json({ error: (err as Error)?.message || "Unable to start verification checkout." }, 500);
  }
});
