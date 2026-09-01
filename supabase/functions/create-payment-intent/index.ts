import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

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

    const amount = items.reduce((sum, i) => sum + i.unitAmount * i.quantity, 0);
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

    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      receipt_email: email ?? undefined,
      automatic_payment_methods: { enabled: true },
      description,
      metadata: {
        payment_type: "onsite_checkout",
        user_id: userId ?? "",
        product_title: first.title,
        designer: first.designer,
        selected_finish: first.finish,
        quantity: String(items.reduce((n, i) => n + i.quantity, 0)),
        item_count: String(items.length),
        line_items: JSON.stringify(
          items.map((i) => ({ t: i.title, f: i.finish, u: i.unitAmount, q: i.quantity })),
        ).slice(0, 500),
      },
    });


    return json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount,
      currency,
    });
  } catch (err) {
    console.error("[create-payment-intent] error", err);
    return json({ error: "Unable to start checkout." }, 500);
  }
});
