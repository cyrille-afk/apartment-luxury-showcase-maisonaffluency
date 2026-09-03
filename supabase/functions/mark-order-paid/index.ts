import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveTaxRule, taxRowLabel, taxRegistrationLine } from "../_shared/taxRules.ts";

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
 * Admin-only: marks a bank-settled order as paid, moves it into production and
 * sends the buyer a single payment-confirmation email (idempotent per order).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: claimsData } = await anon.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = (claimsData?.claims as Record<string, unknown> | undefined)?.sub;
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    if (!orderId) return json({ error: "orderId is required." }, 400);

    const { data: order, error: readErr } = await supabase
      .from("shop_orders")
      .select("id, order_ref, email, full_name, currency, total_cents, tax_cents, tax_label, paid_at, payment_confirmation_sent_at")
      .eq("id", orderId)
      .single();
    if (readErr || !order) return json({ error: "Order not found." }, 404);

    const paidAt = order.paid_at ?? new Date().toISOString();
    const { error: updErr } = await supabase
      .from("shop_orders")
      .update({ status: "paid", paid_at: paidAt, marked_paid_by: userId })
      .eq("id", orderId);
    if (updErr) {
      console.error("mark paid failed:", updErr);
      return json({ error: "Could not update the order." }, 500);
    }

    /* Claim the confirmation email atomically so it can only be sent once. */
    let emailed = false;
    if (!order.payment_confirmation_sent_at && order.email) {
      const { data: claimed } = await supabase
        .from("shop_orders")
        .update({ payment_confirmation_sent_at: new Date().toISOString() })
        .eq("id", orderId)
        .is("payment_confirmation_sent_at", null)
        .select("id")
        .maybeSingle();

      if (claimed) {
        const totalFormatted = new Intl.NumberFormat("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format((order.total_cents ?? 0) / 100);
        // Tax is itemised on the receipt, with our GST registration number.
        const taxCents = Number(order.tax_cents ?? 0);
        const taxRule = taxCents > 0 ? resolveTaxRule("SG", order.currency ?? "") : null;
        const taxFormatted =
          taxCents > 0
            ? new Intl.NumberFormat("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }).format(taxCents / 100)
            : null;

        const { error: mailErr } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "order-payment-confirmed",
            recipientEmail: order.email,
            idempotencyKey: `order-paid-${order.order_ref}`,
            templateData: {
              recipientName: order.full_name ?? "",
              orderRef: order.order_ref,
              currency: (order.currency ?? "usd").toUpperCase(),
              totalFormatted,
              taxLabel: taxCents > 0 ? (order.tax_label || (taxRule ? taxRowLabel(taxRule) : null)) : null,
              taxFormatted,
              taxRegistrationLine: taxCents > 0 ? taxRegistrationLine(taxRule) : null,
              receivedOn: new Date(paidAt).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              }),
            },
          },
        });
        if (mailErr) {
          console.error("payment confirmation email failed:", mailErr);
          await supabase
            .from("shop_orders")
            .update({ payment_confirmation_sent_at: null })
            .eq("id", orderId);
        } else {
          emailed = true;
        }
      }
    }

    return json({ ok: true, emailed, paidAt });
  } catch (err) {
    console.error("mark-order-paid error:", err);
    return json({ error: "Unexpected error." }, 500);
  }
});
