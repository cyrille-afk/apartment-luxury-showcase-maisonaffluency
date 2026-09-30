import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { verifyCatalogLines } from "../_shared/catalogPricing.ts";
import { resolveAccountDiscount } from "../_shared/accountDiscount.ts";
import { resolveTaxTreatment, normaliseBuyerTaxId } from "../_shared/taxRules.ts";
import { applyIossEnv } from "../_shared/iossConfig.ts";
import { verifyVatNumber } from "../_shared/vatValidation.ts";

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

    const verified = await verifyCatalogLines(supabase, rawLines, currency);
    if (!verified.ok) return json({ error: verified.error }, verified.status);
    const lines = verified.lines.map(({ pick_id: _p, ...l }) => l);

    // Server-derived amounts: discount capped at the account tier + 1.5% bank
    // concierge rate; tax recomputed from the destination rules.
    const subtotalCents = verified.subtotalCents;
    const { pct } = await resolveAccountDiscount(supabase, userId);
    const maxDiscount = Math.round(subtotalCents * (pct + 0.015));
    const discountCents = Math.min(int(body?.discountCents), maxDiscount);
    const shippingCents = int(body?.shippingCents);
    const buyerType = body?.buyerType === "business" ? "business" : "private";
    const buyerTaxId = normaliseBuyerTaxId(str(body?.buyerTaxId, 40));
    const taxCountry = str(body?.buyerTaxCountry, 2).toUpperCase();
    const verification = buyerType === "business" && buyerTaxId
      ? await verifyVatNumber(buyerTaxId, taxCountry)
      : null;
    applyIossEnv();
    const treatment = resolveTaxTreatment({
      country: taxCountry,
      currency,
      buyerType,
      buyerTaxId,
      buyerTaxIdVerified: verification?.valid === true,
      goodsCents: subtotalCents - discountCents,
      shippingCents,
    });
    const taxCents = treatment.taxCents;
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
      tax_label: treatment.label ?? null,
      tax_treatment: treatment.treatment,
      tax_rate: treatment.rate,
      tax_statement: treatment.statement ?? null,
      buyer_type: buyerType,
      buyer_tax_id: buyerTaxId || null,
      buyer_tax_country: str(body?.buyerTaxCountry, 2) || null,
      total_cents: totalCents,
    };

    // Idempotent on order_ref: re-issuing the invoice must not duplicate orders.
    // Never let a caller overwrite someone else's order via a chosen order_ref.
    {
      const { data: existing } = await supabase
        .from("shop_orders")
        .select("user_id")
        .eq("order_ref", orderRef)
        .maybeSingle();
      if (existing && existing.user_id !== userId) {
        return json({ error: "Order reference already in use." }, 409);
      }
    }
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
