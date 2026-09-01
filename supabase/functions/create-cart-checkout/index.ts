import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveAccountDiscount } from "../_shared/accountDiscount.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });


interface IncomingItem {
  pickId: string;
  productSlug?: string;
  designerSlug?: string;
  title?: string;
  designerName?: string;
  finishLabel?: string | null;
  /** Structured variant axes as selected on the product page. */
  variant?: { base?: string | null; top?: string | null; size?: string | null } | null;
  /** Unit price displayed in the cart, in cents. Validated against the catalog. */
  expectedUnitPriceCents?: number | null;
  imageUrl?: string | null;
  leadTime?: string | null;
  quantity?: number;
}

/** Every price on this platform is quoted and charged in USD. */
const CHECKOUT_CURRENCY = "usd";


serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const rawItems: IncomingItem[] = Array.isArray(body?.items) ? body.items : [];
    const method: "card" | "bank_transfer" = body?.method === "bank_transfer" ? "bank_transfer" : "card";
    const email: string | null = typeof body?.email === "string" ? body.email.trim() : null;
    const fullName: string | null = typeof body?.fullName === "string" ? body.fullName.trim() : null;
    const notes: string | null = typeof body?.notes === "string" ? body.notes.slice(0, 2000) : null;

    if (!rawItems.length) return json({ error: "Your cart is empty." }, 400);
    if (rawItems.length > 40) return json({ error: "Too many items." }, 400);

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Optional session — orders are attached to the account when signed in.
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabaseAnon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
      const { data: claims } = await supabaseAnon.auth.getClaims(authHeader.replace("Bearer ", ""));
      userId = (claims?.claims?.sub as string) || null;
      userEmail = (claims?.claims?.email as string) || null;
    }
    const buyerEmail = email || userEmail;
    if (!buyerEmail) return json({ error: "An email address is required." }, 400);

    // ---- Server-side price resolution (never trust client prices) ----
    const pickIds = Array.from(new Set(rawItems.map((i) => String(i.pickId || "")).filter(Boolean)));
    if (!pickIds.length) return json({ error: "Invalid cart." }, 400);

    const { data: priced, error: priceErr } = await supabaseAdmin
      .from("trade_products_public_rrp")
      .select("id, source_pick_id, rrp_price_cents, currency, rrp_size_variants")
      .or(pickIds.map((id) => `source_pick_id.eq.${id},id.eq.${id}`).join(","));
    if (priceErr) {
      console.error("[create-cart-checkout] price lookup failed", priceErr);
      return json({ error: "Unable to price your cart right now." }, 500);
    }

    const byPick = new Map<string, any>();
    for (const row of priced || []) {
      if (row.source_pick_id) byPick.set(row.source_pick_id, row);
      if (row.id) byPick.set(row.id, row);
    }

    const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

    // Resolution rules (no currency conversion, no silent fallbacks):
    //  1. The cart's displayed unit price wins when it exists verbatim in the
    //     catalog (base RRP or any variant price) — Stripe then charges the
    //     exact figure the collector saw.
    //  2. Otherwise the dual-axis selection (base × top × size) is resolved.
    //  3. If a finish was configured and neither path matches, the line is
    //     rejected rather than charged at the cheapest base price.
    const mismatched: string[] = [];

    const lines = rawItems.map((item) => {
      const row = byPick.get(String(item.pickId));
      if (!row) return null;
      const qty = Math.min(50, Math.max(1, Math.round(Number(item.quantity) || 1)));
      const basePrice = Number(row.rrp_price_cents) || 0;
      const variants: any[] = Array.isArray(row.rrp_size_variants) ? row.rrp_size_variants : [];
      const variantPrices = variants
        .map((v) => Number(v?.price_cents))
        .filter((c) => Number.isFinite(c) && c > 0);
      const catalogPrices = new Set<number>([...(basePrice > 0 ? [basePrice] : []), ...variantPrices]);

      let unit = 0;

      // 1. Exact sync with the cart figure, validated against the catalog.
      const expected = Math.round(Number(item.expectedUnitPriceCents) || 0);
      if (expected > 0 && catalogPrices.has(expected)) unit = expected;

      // 2. Structured dual-axis resolution.
      const sel = item.variant || {};
      const selBase = norm(sel.base);
      const selTop = norm(sel.top);
      const selSize = norm(sel.size);
      if (!unit && (selBase || selTop || selSize)) {
        const match = variants.find((v) => {
          if (selBase && norm(v?.base) !== selBase) return false;
          if (selTop && norm(v?.top) !== selTop) return false;
          if (selSize && norm(v?.label) !== selSize) return false;
          return true;
        });
        const c = Number(match?.price_cents);
        if (Number.isFinite(c) && c > 0) unit = c;
      }

      // 3. Legacy free-text finish label — every axis token must be present.
      const finish = norm(item.finishLabel);
      if (!unit && finish) {
        const match = variants.find((v) =>
          [v?.base, v?.top, v?.label]
            .filter(Boolean)
            .every((f: string) => finish.includes(norm(f))),
        );
        const c = Number(match?.price_cents);
        if (Number.isFinite(c) && c > 0) unit = c;
      }

      if (!unit && !finish && !selBase && !selTop && !selSize && variants.length === 0) {
        unit = basePrice;
      }

      if (!unit) {
        if (expected > 0 || finish || selBase || selTop || selSize) {
          mismatched.push((item.title || "A piece").slice(0, 120));
          return null;
        }
        unit = basePrice;
      }
      if (!unit || unit <= 0) return null;
      return {
        pick_id: String(item.pickId),
        product_slug: item.productSlug || null,
        designer_slug: item.designerSlug || null,
        title: (item.title || "Collectible piece").slice(0, 200),
        designer_name: item.designerName || null,
        finish_label: item.finishLabel || null,
        image_url: item.imageUrl || null,
        lead_time: item.leadTime || null,
        quantity: qty,
        unit_price_cents: unit,
        line_total_cents: unit * qty,
        currency: CHECKOUT_CURRENCY,
      };
    }).filter(Boolean) as any[];

    if (mismatched.length) {
      console.error("[create-cart-checkout] price/finish mismatch", mismatched);
      return json(
        {
          error: `The configuration for ${mismatched.join(", ")} is no longer priced in the catalogue. Please reopen the piece and reselect your finish.`,
        },
        409,
      );
    }

    if (!lines.length) return json({ error: "These pieces are price upon request — please send an enquiry instead." }, 400);

    const currency = CHECKOUT_CURRENCY;
    const grossSubtotal = lines.reduce((s, l) => s + l.line_total_cents, 0);


    // ---- Account-level tier discount (re-derived server-side) -------------
    // Never trust a discount sent by the client: eligibility comes from
    // `user_roles` / `profiles.trade_status`, the rate from `trade_tier_config`.
    const resolved = await resolveAccountDiscount(supabaseAdmin, userId);
    const discountPct = resolved.pct;
    const discountLabel = resolved.label;

    // Apply the discount to each unit price so the Stripe line items, the
    // stored order rows and the on-screen summary all agree to the cent.
    if (discountPct > 0) {
      for (const l of lines) {
        l.unit_price_cents = Math.round(l.unit_price_cents * (1 - discountPct));
        l.line_total_cents = l.unit_price_cents * l.quantity;
      }
    }

    const subtotal = lines.reduce((s, l) => s + l.line_total_cents, 0);
    const discountCents = grossSubtotal - subtotal;
    // Shipping is "To be Quoted by Advisor" until an advisor confirms a rate.
    // Only charge it when the client explicitly passes a confirmed amount.
    const shippingConfirmed = body?.shippingConfirmed === true;
    const rawShipping = Math.round(Number(body?.shippingCents) || 0);
    const shipping =
      shippingConfirmed && Number.isFinite(rawShipping) && rawShipping > 0
        ? Math.min(rawShipping, subtotal)
        : 0;
    const total = subtotal + shipping;

    const orderRef = `MA-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("shop_orders")
      .insert({
        order_ref: orderRef,
        user_id: userId,
        email: buyerEmail,
        full_name: fullName,
        payment_method: method,
        status: method === "bank_transfer" ? "awaiting_bank_transfer" : "pending",
        currency,
        subtotal_cents: grossSubtotal,
        discount_cents: discountCents,
        discount_pct: discountPct,
        discount_label: discountLabel,
        shipping_cents: shipping,
        total_cents: total,
        notes,
      })
      .select("id, order_ref")
      .single();
    if (orderErr || !order) {
      console.error("[create-cart-checkout] order insert failed", orderErr);
      return json({ error: "Unable to create your order." }, 500);
    }

    const { error: itemsErr } = await supabaseAdmin.from("shop_order_items").insert(
      lines.map(({ currency: _c, ...l }) => ({ ...l, order_id: order.id })),
    );
    if (itemsErr) console.error("[create-cart-checkout] item insert failed", itemsErr);

    if (method === "bank_transfer") {
      return json({ orderRef: order.order_ref, mode: "bank_transfer" });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: buyerEmail, limit: 1 });
    if (customers.data.length) customerId = customers.data[0].id;

    const origin = req.headers.get("origin") || "https://www.maisonaffluency.com";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : buyerEmail,
      mode: "payment",
      line_items: [
        ...lines.map((l) => ({
          quantity: l.quantity,
          price_data: {
            currency,
            unit_amount: l.unit_price_cents,
            product_data: {
              name: [l.title, l.designer_name].filter(Boolean).join(" — ").slice(0, 250),
              description: [l.finish_label, l.lead_time].filter(Boolean).join(" · ").slice(0, 250) || undefined,
              images: l.image_url && /^https?:\/\//.test(l.image_url) ? [l.image_url] : undefined,
            },
          },
        })),
        ...(shipping > 0
          ? [{
              quantity: 1,
              price_data: {
                currency,
                unit_amount: shipping,
                product_data: { name: "Front Door Premium Delivery" },
              },
            }]
          : []),
      ],
      success_url: `${origin}/order-confirmation?ref=${order.order_ref}&status=paid`,
      cancel_url:
        typeof body?.cancelPath === "string" && /^\/[A-Za-z0-9\-._~/?&=%]*$/.test(body.cancelPath)
          ? `${origin}${body.cancelPath}`
          : `${origin}/cart?status=cancelled`,
      metadata: { payment_type: "cart_order", order_id: order.id, order_ref: order.order_ref },
    });

    await supabaseAdmin.from("shop_orders").update({ stripe_session_id: session.id }).eq("id", order.id);

    return json({ url: session.url, orderRef: order.order_ref, mode: "card" });
  } catch (err) {
    console.error("[create-cart-checkout] error", err);
    return json({ error: "An unexpected error occurred." }, 500);
  }
});
