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

const ok = (body: Record<string, unknown>, ackMs: number) =>
  new Response(JSON.stringify({ received: true, ack_ms: ackMs, ...body }), {
    headers: { "Content-Type": "application/json", "X-Ack-Ms": String(ackMs) },
    status: 200,
  });

/** One machine-readable telemetry line per webhook, for the live SLA check. */
const logAck = (
  outcome: string,
  ackMs: number,
  eventId: string | null,
  eventType: string | null,
) =>
  console.log(
    `[STRIPE-WEBHOOK][ACK] ${JSON.stringify({
      outcome,
      ack_ms: ackMs,
      within_sla_2s: ackMs < 2000,
      event_id: eventId,
      event_type: eventType,
      at: new Date().toISOString(),
    })}`,
  );

serve(async (req) => {
  const startedAt = performance.now();
  const elapsed = () => Math.round(performance.now() - startedAt);
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
    logAck("signature_rejected", elapsed(), null, null);
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
      const ackMs = elapsed();
      logAck("duplicate_dropped", ackMs, event.id, event.type);
      console.log(`[STRIPE-WEBHOOK] Duplicate event ${event.id} ignored in ${ackMs}ms`);
      return ok({ duplicate: true }, ackMs);
    }
    logAck("enqueue_failed", elapsed(), event.id, event.type);
    console.error("[STRIPE-WEBHOOK] failed to enqueue event:", error);
    // 500 → Stripe retries, and the retry will enqueue successfully.
    return new Response(JSON.stringify({ error: "enqueue_failed" }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }

  const ackMs = elapsed();
  logAck("queued", ackMs, event.id, event.type);
  console.log(`[STRIPE-WEBHOOK] Queued ${event.type} (${event.id}) in ${ackMs}ms`);
  return ok({ queued: true }, ackMs);
});
