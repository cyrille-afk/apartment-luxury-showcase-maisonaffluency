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
 * Currency → Stripe bank-transfer rail. Stripe generates a *virtual* account
 * for the buyer in the local rail, so the routing block shown at checkout is
 * always native to the checkout currency.
 */
function bankTransferOptions(currency: string): Record<string, unknown> | null {
  switch (currency) {
    case "eur":
      return { type: "eu_bank_transfer", eu_bank_transfer: { country: "DE" } };
    case "gbp":
      return { type: "gb_bank_transfer" };
    case "usd":
      return { type: "us_bank_transfer" };
    case "jpy":
      return { type: "jp_bank_transfer" };
    case "mxn":
      return { type: "mx_bank_transfer" };
    default:
      return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
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

    const body = await req.json().catch(() => ({}));
    const email =
      typeof body?.email === "string" && body.email.includes("@")
        ? body.email.trim().slice(0, 200)
        : userEmail;
    if (!email) return json({ error: "An email address is required to generate wire details." }, 400);

    const currency = (typeof body?.currency === "string" ? body.currency : "usd").toLowerCase();
    const transfer = bankTransferOptions(currency);
    if (!transfer) return json({ error: "unsupported_currency", currency }, 200);

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
        unitAmount: Math.round(price * 100),
        quantity: Math.min(20, Math.max(1, Math.round(Number(raw?.quantity) || 1))),
      };
    };

    const rawItems = Array.isArray(body?.items) && body.items.length ? body.items : [body];
    if (rawItems.length > 20) return json({ error: "Too many items in one order." }, 400);
    const items: Item[] = [];
    for (const raw of rawItems) {
      const item = parseItem(raw);
      if (!item) return json({ error: "A valid product title and price are required." }, 400);
      items.push(item);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { pct: discountPct, label: discountLabel } = await resolveAccountDiscount(
      supabaseAdmin,
      userId,
    );
    if (discountPct > 0) {
      for (const i of items) i.unitAmount = Math.round(i.unitAmount * (1 - discountPct));
    }

    const goodsAmount = items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
    const shippingConfirmed = body?.shippingConfirmed === true;
    const rawShipping = Number(body?.shippingCents);
    const shippingCents =
      shippingConfirmed && Number.isFinite(rawShipping) && rawShipping > 0
        ? Math.round(rawShipping)
        : 0;
    const amount = goodsAmount + shippingCents;
    if (amount < 100) return json({ error: "Price out of range." }, 400);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Payments are not configured." }, 500);
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email, limit: 1 });
    const customerId = customers.data.length
      ? customers.data[0].id
      : (await stripe.customers.create({ email })).id;

    const description = items
      .map((i) => `${[i.designer, i.title].filter(Boolean).join(" — ")} ×${i.quantity}`)
      .join(" | ")
      .slice(0, 300);

    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.create({
        amount,
        currency,
        customer: customerId,
        description,
        payment_method_types: ["customer_balance"],
        payment_method_data: { type: "customer_balance" },
        payment_method_options: {
          customer_balance: {
            funding_type: "bank_transfer",
            bank_transfer: transfer as any,
          },
        },
        confirm: true,
        metadata: {
          payment_type: "onsite_bank_transfer",
          user_id: userId ?? "",
          discount_pct: String(discountPct),
          discount_label: discountLabel ?? "",
          shipping_cents: String(shippingCents),
        },
      });
    } catch (err) {
      console.error("[create-bank-transfer-intent] stripe error", err);
      return json({ error: "bank_transfer_unavailable", detail: (err as Error)?.message ?? "" }, 200);
    }

    const next = intent.next_action as any;
    const instructions = next?.display_bank_transfer_instructions;
    if (!instructions) return json({ error: "bank_transfer_unavailable" }, 200);

    return json({
      paymentIntentId: intent.id,
      amount,
      currency,
      reference: instructions.reference ?? null,
      hostedInstructionsUrl: instructions.hosted_instructions_url ?? null,
      financialAddresses: instructions.financial_addresses ?? [],
      amountRemaining: instructions.amount_remaining ?? amount,
      discountPct,
      discountLabel,
    });
  } catch (err) {
    console.error("[create-bank-transfer-intent] error", err);
    return json({ error: "Unable to generate wire details." }, 500);
  }
});
