/**
 * process-webhook-events — asynchronous queue worker
 * ==================================================
 * Claims pending rows from `public.webhook_events` (FOR UPDATE SKIP LOCKED, so
 * concurrent invocations never process the same event) and runs the Stripe
 * side effects. Woken instantly by the insert trigger on webhook_events and
 * re-armed by the self-disarming `process-webhook-events` cron while work
 * remains.
 *
 * Failure handling: the event is released back to the queue with exponential
 * backoff up to max_attempts, then parked as `failed` for admin review.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getStripe } from "../_shared/stripeClient.ts";
import { processStripeEvent } from "../_shared/stripeEventProcessor.ts";

const { stripe } = await getStripe("auto");

const BATCH_SIZE = 5;
/** Backoff per attempt number (seconds): 15s, 1m, 5m, 30m, 2h. */
const BACKOFF_SECONDS = [15, 60, 300, 1800, 7200];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  const { data: claimed, error: claimErr } = await supabase.rpc("claim_webhook_events", {
    batch_size: BATCH_SIZE,
  });

  if (claimErr) {
    console.error("[WEBHOOK-WORKER] claim failed:", claimErr);
    return new Response(JSON.stringify({ error: claimErr.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const events = (claimed ?? []) as Array<{
    id: string;
    event_id: string;
    event_type: string;
    payload: unknown;
    attempts: number;
    max_attempts: number;
  }>;

  let processed = 0;
  let failed = 0;

  for (const row of events) {
    try {
      await processStripeEvent(supabase, stripe, row.payload as Stripe.Event);

      await supabase
        .from("webhook_events")
        .update({
          status: "processed",
          processed_at: new Date().toISOString(),
          locked_at: null,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      processed++;
      console.log(`[WEBHOOK-WORKER] Processed ${row.event_type} (${row.event_id})`);
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      const exhausted = row.attempts >= row.max_attempts;
      const delay = BACKOFF_SECONDS[Math.min(row.attempts, BACKOFF_SECONDS.length - 1)];

      await supabase
        .from("webhook_events")
        .update({
          status: exhausted ? "failed" : "pending",
          last_error: msg.slice(0, 2000),
          locked_at: null,
          next_attempt_at: new Date(Date.now() + delay * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      console.error(
        `[WEBHOOK-WORKER] ${row.event_type} (${row.event_id}) attempt ${row.attempts} failed${
          exhausted ? " — parked for review" : `, retrying in ${delay}s`
        }: ${msg}`,
      );
    }
  }

  return new Response(JSON.stringify({ claimed: events.length, processed, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
