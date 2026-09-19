/**
 * stripe-webhook — LEAN, SYNCHRONOUS-FREE ACK
 * ===========================================
 * This handler does exactly two things:
 *   1. verifies the Stripe signature (live + test endpoint secrets), and
 *   2. records the event once in `public.webhook_events`.
 * Then it returns 200 immediately.
 *
 * Everything downstream — deposit alerts (Slack / email / WhatsApp), wholesale
 * payables, purchase-order dispatch and PDF rendering, reminder kill-switch,
 * order confirmations — is drained asynchronously by `process-webhook-events`
 * (woken instantly by a database trigger, with a self-disarming retry cron).
 *
 * Idempotency: the unique (provider, event_id) index means a Stripe retry is a
 * no-op insert, so the previous duplicate-PO failure mode is impossible.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { loadStripeTestCreds } from "../_shared/stripeCreds.ts";
import { getStripe } from "../_shared/stripeClient.ts";

const { stripe, creds } = await getStripe("auto");
const testCreds = await loadStripeTestCreds();

const endpointSecrets = [creds.webhookSecret, testCreds?.webhookSecret].filter(
  (s): s is string => Boolean(s),
);

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify({ received: true, ...body }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing stripe-signature header", { status: 400 });

  const body = await req.text();

  let event: Stripe.Event | null = null;
  let lastErr: Error | null = null;
  for (const secret of endpointSecrets) {
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, secret);
      break;
    } catch (err: any) {
      lastErr = err;
    }
  }
  if (!event) {
    console.error("[STRIPE-WEBHOOK] signature verification failed:", lastErr?.message);
    return new Response(`Webhook Error: ${lastErr?.message}`, { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { error } = await supabase.from("webhook_events").insert({
    provider: "stripe",
    event_id: event.id,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
  });

  if (error) {
    // 23505 = this event was already recorded → Stripe retry, acknowledge it.
    if ((error as any).code === "23505") {
      console.log(`[STRIPE-WEBHOOK] Duplicate event ${event.id} ignored`);
      return ok({ duplicate: true });
    }
    console.error("[STRIPE-WEBHOOK] failed to enqueue event:", error);
    // 500 → Stripe retries, and the retry will enqueue successfully.
    return new Response(JSON.stringify({ error: "enqueue_failed" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  console.log(`[STRIPE-WEBHOOK] Queued ${event.type} (${event.id})`);
  return ok({ queued: true });
});
