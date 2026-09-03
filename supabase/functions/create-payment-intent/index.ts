import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveAccountDiscount } from "../_shared/accountDiscount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Creates a PaymentIntent for the on-site (single page) luxury checkout.
 * Auth is optional: signed-in buyers are linked to their user id, guests are
 * identified by the email captured in the checkout form.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    // ---- Optional auth ----
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseAnon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      );
      const { data: claimsData } = await supabaseAnon.auth.getClaims(
        authHeader.replace("Bearer ", ""),
      );
      const claims = claimsData?.claims as Record<string, unknown> | undefined;
      if (claims?.sub) {
        userId = String(claims.sub);
        userEmail = typeof claims.email === "string" ? claims.email : null;
      }
    }

    // ---- Input validation ----
    const body = await req.json().catch(() => ({}));
    const email =
      typeof body?.email === "string" && body.email.includes("@")
        ? body.email.trim().slice(0, 200)
        : userEmail;
    const currency = (typeof body?.currency === "string" ? body.currency : "usd").toLowerCase();
    // PayNow is Singapore-only and SGD-only (Stripe requirement). Bank
    // transfers (customer_balance) are not available to SG merchants, so SGD
    // orders get PayNow instead.
    const requestedMethod: "card" | "paynow" = body?.paymentMethod === "paynow" ? "paynow" : "card";
    if (requestedMethod === "paynow" && currency !== "sgd") {
      return json({ error: "PayNow is available only on SGD-priced orders." }, 400);
    }

    type Item = { title: string; designer: string; finish: string; unitAmount: number; quantity: number };
    const parseItem = (raw: any): Item | null => {
      const title = typeof raw?.title === "string" ? raw.title.trim() : "";
      const price = Number(raw?.price);
      if (!title || title.length > 200) return null;
      if (!Number.isFinite(price) || price <= 0) return null;
      return {
        title: title.slice(0, 200),
        designer: typeof raw?.designer === "string" ? raw.designer.trim().slice(0, 120) : "",
        finish: typeof raw?.selectedFinish === "string" ? raw.selectedFinish.trim().slice(0, 250) : "",
        // `price` arrives as a major-unit amount (e.g. 7513) → convert to cents.
        unitAmount: Math.round(price * 100),
        quantity: Math.min(20, Math.max(1, Math.round(Number(raw?.quantity) || 1))),
      };
    };

    // Multi-line orders send `items`; single-line callers keep the flat shape.
    const rawItems = Array.isArray(body?.items) && body.items.length ? body.items : [body];
    if (rawItems.length > 20) return json({ error: "Too many items in one order." }, 400);
    const items: Item[] = [];
    for (const raw of rawItems) {
      const item = parseItem(raw);
      if (!item) return json({ error: "A valid product title and price are required." }, 400);
      items.push(item);
    }

    // ---- Account-level tier discount (re-derived server-side) ----
    // Clients send gross prices; the discount is applied here so the amount
    // charged equals the discounted total shown in the order summary.
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { pct: discountPct, label: discountLabel } = await resolveAccountDiscount(
      supabaseAdmin,
      userId,
    );
    // The discount is applied ONCE at cart level (never per unit): rounding a
    // per-line discount drifts by a few cents against the client-side total
    // and trips the checkout guardrail.
    const grossAmount = items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
    const discountCents = discountPct > 0 ? Math.round(grossAmount * discountPct) : 0;
    const goodsAmount = grossAmount - discountCents;

    // ---- Shipping (opt-in only) ----
    // Shipping is "To be Quoted by Advisor" until the buyer explicitly confirms
    // an advisor-issued quote. No estimate is ever invented server-side.
    const shippingConfirmed = body?.shippingConfirmed === true;
    const rawShipping = Number(body?.shippingCents);
    const shippingCents =
      shippingConfirmed && Number.isFinite(rawShipping) && rawShipping > 0
        ? Math.round(rawShipping)
        : 0;
    if (shippingCents > 5_000_000) return json({ error: "Shipping amount out of range." }, 400);
    const shippingLabel =
      typeof body?.shippingLabel === "string" ? body.shippingLabel.trim().slice(0, 120) : "";

    const amount = goodsAmount + shippingCents;
    if (amount < 100 || amount > 100_000_00 * 100) return json({ error: "Price out of range." }, 400);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Payments are not configured." }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Reuse an existing Stripe customer when we already know this buyer.
    let customerId: string | undefined;
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 1 });
      customerId = customers.data.length
        ? customers.data[0].id
        : (await stripe.customers.create({ email })).id;
    }

    const first = items[0];
    const description = items
      .map((i) => `${[i.designer, i.title].filter(Boolean).join(" — ")} ×${i.quantity}`)
      .join(" | ")
      .slice(0, 300);

    const metadata: Record<string, string> = {
        payment_type: "onsite_checkout",
        user_id: userId ?? "",
        product_title: first.title,
        designer: first.designer,
        selected_finish: first.finish,
        quantity: String(items.reduce((n, i) => n + i.quantity, 0)),
        item_count: String(items.length),
        discount_pct: String(discountPct),
        discount_label: discountLabel ?? "",
        shipping_cents: String(shippingCents),
        shipping_label: shippingLabel,
        line_items: JSON.stringify(
          items.map((i) => ({ t: i.title, f: i.finish, u: i.unitAmount, q: i.quantity })),
        ).slice(0, 500),
    };

    // Reuse the open PaymentIntent when the buyer only added a confirmed
    // shipping quote; fall back to a fresh intent when it can no longer change.
    const reuseId = typeof body?.paymentIntentId === "string" ? body.paymentIntentId : "";
    let intent: Stripe.PaymentIntent | null = null;
    if (reuseId.startsWith("pi_")) {
      try {
        const existing = await stripe.paymentIntents.retrieve(reuseId);
        const updatable =
          existing.status === "requires_payment_method" ||
          existing.status === "requires_confirmation";
        const sameMethod = (existing.payment_method_types ?? []).includes(requestedMethod);
        if (updatable && existing.currency === currency && sameMethod) {
          intent = await stripe.paymentIntents.update(reuseId, {
            amount,
            description,
            metadata,
          });
        }
      } catch (_e) {
        intent = null;
      }
    }

    if (!intent) {
      intent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        receipt_email: email ?? undefined,
        // Card-only keeps the Stripe pane clean: no auto-expanded Link pane.
        // Apple Pay / Google Pay still surface as card wallets via the
        // ExpressCheckoutElement, so express buyers are not affected.
        payment_method_types: [requestedMethod],
        description,
        metadata,
      });
    }


    return json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      currency,
      paymentMethod: requestedMethod,
      discountPct,
      discountLabel,
      goodsAmount,
      shippingCents,
      shippingLabel,
    });
  } catch (err) {
    console.error("[create-payment-intent] error", err);
    return json({ error: "Unable to start checkout." }, 500);
  }
});
