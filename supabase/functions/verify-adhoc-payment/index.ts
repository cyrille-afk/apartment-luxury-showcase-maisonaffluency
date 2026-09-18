import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getStripe } from "../_shared/stripeCreds.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{24,}$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/**
 * Client-side payment reconciliation for ad-hoc Sales Funnel checkout links.
 *
 * The Stripe webhook is the authoritative path, but it may arrive late (or
 * never, when testing against a preview origin Stripe cannot reach). After
 * Checkout redirects to /success?session_id=..., the browser calls this
 * function with the session id — which only the payer possesses — and we
 * verify the payment directly with Stripe, then transition the funnel card
 * immediately. Idempotent: safe to call after the webhook already ran.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = typeof body?.session_id === "string" ? body.session_id.trim() : "";

    if (!SESSION_ID_PATTERN.test(sessionId)) {
      return json({ error: "Invalid session identifier." }, 400);
    }

    const mode = sessionId.startsWith("cs_test_") ? "test" : "live";
    const { stripe } = await getStripe(mode);

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";

    const meta = (session.metadata ?? {}) as Record<string, string>;
    const cardId = meta.cardId || "";
    const quoteId = meta.quote_id || "";

    const result: Record<string, unknown> = {
      paid,
      status: session.payment_status,
      amount_cents: session.amount_total ?? 0,
      currency: (session.currency ?? "usd").toUpperCase(),
      label:
        (session.line_items ? undefined : undefined) ??
        meta.label ??
        null,
      payer_email: session.customer_details?.email ?? session.customer_email ?? null,
      card_id: cardId || null,
      quote_id: quoteId || null,
      funnel_status: null as string | null,
    };

    if (!paid) return json(result);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    if (cardId) {
      const { data: row } = await admin
        .from("funnel_card_payments")
        .select("id, amount_cents, expected_total_cents, payment_kind, status, label")
        .eq("stripe_session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (row) {
        result.label = row.label ?? result.label;
        if (row.status === "paid" || row.status === "settled") {
          result.funnel_status = row.status; // webhook already handled it
        } else {
          const paidAmount = session.amount_total ?? row.amount_cents ?? 0;
          const expected = row.expected_total_cents ?? 0;
          const fullySettled =
            row.payment_kind === "full" || (expected > 0 && paidAmount >= expected);
          const next = fullySettled ? "settled" : "paid";
          const { error: upErr } = await admin
            .from("funnel_card_payments")
            .update({ status: next, paid_at: new Date().toISOString() })
            .eq("id", row.id);
          if (upErr) console.error("[verify-adhoc-payment] card update failed", upErr);
          else result.funnel_status = next;
        }
      }
    }

    if (quoteId) {
      await admin
        .from("quote_payment_links")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("stripe_session_id", sessionId)
        .eq("status", "active");
    }

    return json(result);
  } catch (err) {
    console.error("[verify-adhoc-payment] error", err);
    return json({ error: "Unable to verify payment." }, 500);
  }
});
