import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

const int = (v: unknown) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const REGIONS = new Set(["ASEAN", "GCC", "ROW"]);
const CHANNELS = new Set(["paynow", "fast", "swift"]);

/**
 * Records a bank-settled (pro-forma) order and its line items so the trade desk
 * can reconcile the incoming transfer. Amounts are recomputed server-side from
 * the submitted line items — the client total is never trusted.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // Auth required: a pro-forma order is a binding trade-desk commitment, so
    // anonymous callers are rejected outright.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Authentication required." }, 401);
    }
    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: claims, error: claimsErr } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const sub = (claims?.claims as Record<string, unknown> | undefined)?.sub;
    if (claimsErr || !sub) {
      return json({ error: "Invalid or expired session." }, 401);
    }
    const userId = String(sub);

    const body = await req.json().catch(() => ({}));

    const orderRef = str(body?.orderRef, 64);
    if (!orderRef) return json({ error: "Order reference is required." }, 400);

    const regionTier = REGIONS.has(String(body?.regionTier)) ? String(body.regionTier) : "ROW";
    const paymentChannel = CHANNELS.has(String(body?.paymentChannel)) ? String(body.paymentChannel) : "swift";
    const currency = (str(body?.currency, 8) || "usd").toLowerCase();

    const buyer = body?.buyer ?? {};
    const email = str(buyer?.email, 200);
    if (!email.includes("@")) return json({ error: "A valid email address is required." }, 400);

    const rawLines = Array.isArray(body?.lines) ? body.lines.slice(0, 60) : [];
    if (rawLines.length === 0) return json({ error: "At least one line item is required." }, 400);

    const lines = rawLines.map((l: Record<string, unknown>) => {
      const quantity = Math.min(Math.max(int(l?.quantity) || 1, 1), 999);
      const unit = int(l?.unitCents);
      return {
        title: str(l?.title, 200) || "Bespoke piece",
        designer_name: str(l?.designer, 160) || null,
        finish_label: str(l?.finishLabel, 250) || null,
        quantity,
        unit_price_cents: unit,
        line_total_cents: unit * quantity,
      };
    });

    // Server-side arithmetic — the client's totals are advisory only.
    const subtotalCents = lines.reduce((n, l) => n + l.line_total_cents, 0);
    const discountCents = Math.min(int(body?.discountCents), subtotalCents);
    const shippingCents = int(body?.shippingCents);
    const taxCents = int(body?.taxCents);
    const totalCents = subtotalCents - discountCents + shippingCents + taxCents;

    const row = {
      order_ref: orderRef,
      user_id: userId,
      email,
      full_name: str(buyer?.name, 160) || null,
      phone: str(buyer?.phone, 60) || null,
      shipping_address: str(buyer?.address, 600) || null,
      payment_method: "bank_transfer",
      payment_channel: paymentChannel,
      region_tier: regionTier,
      status: "awaiting_payment",
      currency,
      subtotal_cents: subtotalCents,
      discount_cents: discountCents,
      discount_label: str(body?.discountLabel, 120) || null,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      tax_label: str(body?.taxLabel, 160) || null,
      total_cents: totalCents,
    };

    // Idempotent on order_ref: re-issuing the invoice must not duplicate orders.
    const { data: order, error } = await supabase
      .from("shop_orders")
      .upsert(row, { onConflict: "order_ref" })
      .select("id")
      .single();

    if (error) {
      console.error("shop_orders upsert failed:", error);
      return json({ error: "Could not record the order." }, 500);
    }

    await supabase.from("shop_order_items").delete().eq("order_id", order.id);
    const { error: itemsErr } = await supabase
      .from("shop_order_items")
      .insert(lines.map((l) => ({ ...l, order_id: order.id })));
    if (itemsErr) console.error("shop_order_items insert failed:", itemsErr);

    return json({ orderId: order.id, orderRef, totalCents, currency });
  } catch (err) {
    console.error("create-proforma-order error:", err);
    return json({ error: "Unexpected error." }, 500);
  }
});
