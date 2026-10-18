import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/**
 * Admin-only: corrects VAT number / tax on an issued instant bank transfer.
 * Re-amounts the Stripe PaymentIntent first (so the amount due matches), then
 * saves the order — buyers' saved copies refresh from get_instant_transfer_totals.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: claimsData } = authHeader
      ? await anon.auth.getClaims(authHeader.replace("Bearer ", ""))
      : { data: null };
    const userId = (claimsData?.claims as Record<string, unknown> | undefined)?.sub;
    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: isAdmin } = userId
      ? await supabase.rpc("has_role", { _user_id: userId, _role: "admin" })
      : { data: false };

    const body = await req.json().catch(() => ({}));
    // Buyers still on checkout may update their own order by presenting the
    // issued reference + PaymentIntent id (same secret that created it).
    const intentId = typeof body?.intentId === "string" ? body.intentId : "";
    const orderRef = typeof body?.orderRef === "string" ? body.orderRef : "";
    let orderId = isAdmin && typeof body?.orderId === "string" ? body.orderId : "";
    if (!orderId) {
      if (!intentId || !orderRef) return json({ error: "Forbidden" }, 403);
      const { data: own } = await supabase.from("shop_orders").select("id")
        .eq("order_ref", orderRef).eq("stripe_session_id", intentId).maybeSingle();
      if (!own) return json({ error: "Forbidden" }, 403);
      orderId = own.id;
    }
    const taxCents = Math.round(Number(body?.taxCents));
    if (!orderId || !Number.isFinite(taxCents) || taxCents < 0) return json({ error: "orderId and a tax amount are required." }, 400);
    const taxLabel = typeof body?.taxLabel === "string" ? body.taxLabel.trim().slice(0, 80) || null : null;
    const buyerTaxId = typeof body?.buyerTaxId === "string" ? body.buyerTaxId.trim().slice(0, 40) || null : null;

    const { data: order, error: readErr } = await supabase.from("shop_orders")
      .select("id, payment_method, status, subtotal_cents, discount_cents, shipping_cents, stripe_session_id")
      .eq("id", orderId).maybeSingle();
    if (readErr || !order) return json({ error: "Order not found." }, 404);
    if (order.payment_method !== "instant_bank_transfer") return json({ error: "Only instant bank transfer orders can be updated here." }, 400);
    if (order.status === "paid") return json({ error: "This order is already paid." }, 409);
    const totalCents = order.subtotal_cents - (order.discount_cents ?? 0) + order.shipping_cents + taxCents;
    if (totalCents < 100) return json({ error: "Total out of range." }, 400);
    if (!isAdmin && taxCents > Math.round((order.subtotal_cents + order.shipping_cents) * 0.3)) {
      return json({ error: "Tax out of range." }, 400);
    }

    if (!order.stripe_session_id) return json({ error: "No payment linked to this order." }, 409);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
    const pi = await stripe.paymentIntents.retrieve(order.stripe_session_id);
    if (pi.status === "succeeded" || pi.status === "canceled") return json({ error: `Payment is ${pi.status}; amount can't change.` }, 409);
    const received = pi.amount - ((pi.next_action as any)?.display_bank_transfer_instructions?.amount_remaining ?? pi.amount);
    if (totalCents < received) return json({ error: "The buyer has already sent more than this total." }, 409);
    if (pi.amount !== totalCents) {
      await stripe.paymentIntents.update(pi.id, { amount: totalCents, metadata: { tax_cents: String(taxCents) } });
    }

    const { error: upErr } = await supabase.from("shop_orders").update({
      tax_cents: taxCents, tax_label: taxLabel, buyer_tax_id: buyerTaxId, total_cents: totalCents,
      updated_at: new Date().toISOString(),
    }).eq("id", order.id);
    if (upErr) return json({ error: "Payment updated but the order could not be saved — retry." }, 500);
    return json({ ok: true, taxCents, totalCents });
  } catch (err) {
    console.error("[update-instant-transfer-tax]", err);
    return json({ error: err instanceof Error ? err.message : "Update failed." }, 500);
  }
});
