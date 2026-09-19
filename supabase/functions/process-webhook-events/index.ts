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
 *
 * Health monitoring:
 *   - Stripe is initialised lazily inside a try/catch so a bad credential can
 *     never take the whole worker down at module boot (a boot crash used to
 *     make every invocation return 500 and silently stall paid orders).
 *   - Every invocation writes a heartbeat into `webhook_worker_health`.
 *   - `GET|POST ?health=1` returns a health probe without processing anything;
 *     this is what `monitor-webhook-worker` calls on its schedule.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import type Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getStripe } from "../_shared/stripeClient.ts";
import { processStripeEvent } from "../_shared/stripeEventProcessor.ts";
import { nextQueueState } from "../_shared/webhookQueueRetry.ts";
import { notifyParkedQueueJob } from "../_shared/parkedJobAlert.ts";

const WORKER = "process-webhook-events";
const BATCH_SIZE = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Lazy, fault-tolerant Stripe startup check. Never throws at module scope.
// ---------------------------------------------------------------------------
let stripeClient: Stripe | null = null;
let stripeBootError: string | null = null;

async function ensureStripe(): Promise<Stripe> {
  if (stripeClient) return stripeClient;
  try {
    const { stripe } = await getStripe("auto");
    stripeClient = stripe as unknown as Stripe;
    stripeBootError = null;
    return stripeClient;
  } catch (e) {
    stripeBootError = e instanceof Error ? e.message : String(e);
    throw new Error(`Stripe startup check failed: ${stripeBootError}`);
  }
}

// deno-lint-ignore no-explicit-any
function serviceClient(): any {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );
}

// deno-lint-ignore no-explicit-any
async function heartbeat(supabase: any, args: {
  ok: boolean;
  bootOk: boolean;
  error?: string | null;
  claimed?: number;
  processed?: number;
  failed?: number;
}) {
  try {
    await supabase.rpc("record_webhook_worker_heartbeat", {
      p_worker: WORKER,
      p_ok: args.ok,
      p_boot_ok: args.bootOk,
      p_error: args.error ?? null,
      p_claimed: args.claimed ?? 0,
      p_processed: args.processed ?? 0,
      p_failed: args.failed ?? 0,
    });
  } catch (e) {
    console.error("[WEBHOOK-WORKER] heartbeat write failed:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const supabase = serviceClient();

  // ---------------- Health probe (no queue work) ----------------
  if (url.searchParams.get("health")) {
    let stripeOk = true;
    let stripeError: string | null = null;
    try {
      await ensureStripe();
    } catch (e) {
      stripeOk = false;
      stripeError = e instanceof Error ? e.message : String(e);
    }

    let dbOk = true;
    let oldestPendingAgeSeconds = 0;
    let pending = 0;
    let dbError: string | null = null;
    try {
      const { data, error } = await supabase
        .from("webhook_events")
        .select("created_at")
        .in("status", ["pending", "processing"])
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ created_at: string }>;
      pending = rows.length;
      if (rows.length) {
        oldestPendingAgeSeconds = Math.round(
          (Date.now() - new Date(rows[0].created_at).getTime()) / 1000,
        );
      }
    } catch (e) {
      dbOk = false;
      dbError = e instanceof Error ? e.message : String(e);
    }

    const healthy = stripeOk && dbOk;
    await heartbeat(supabase, {
      ok: healthy,
      bootOk: stripeOk,
      error: stripeError ?? dbError,
    });

    return new Response(
      JSON.stringify({
        worker: WORKER,
        healthy,
        boot: { stripe: stripeOk, error: stripeError },
        database: { ok: dbOk, error: dbError },
        pending,
        oldest_pending_age_seconds: oldestPendingAgeSeconds,
        checked_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: healthy ? 200 : 503,
      },
    );
  }

  // ---------------- Startup check before draining ----------------
  let stripe: Stripe;
  try {
    stripe = await ensureStripe();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[WEBHOOK-WORKER] startup check failed:", message);
    await heartbeat(supabase, { ok: false, bootOk: false, error: message });
    return new Response(JSON.stringify({ error: message, boot: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 503,
    });
  }

  const { data: claimed, error: claimErr } = await supabase.rpc("claim_webhook_events", {
    batch_size: BATCH_SIZE,
  });

  if (claimErr) {
    console.error("[WEBHOOK-WORKER] claim failed:", claimErr);
    await heartbeat(supabase, { ok: false, bootOk: true, error: `claim: ${claimErr.message}` });
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
  let lastError: string | null = null;

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
      const next = nextQueueState({
        attempts: row.attempts,
        maxAttempts: row.max_attempts,
        error: e,
      });
      lastError = next.last_error;

      await supabase
        .from("webhook_events")
        .update({
          status: next.status,
          last_error: next.last_error,
          locked_at: next.locked_at,
          next_attempt_at: next.next_attempt_at,
          updated_at: next.updated_at,
        })
        .eq("id", row.id);

      console.error(
        `[WEBHOOK-WORKER] ${row.event_type} (${row.event_id}) attempt ${row.attempts} failed${
          next.exhausted ? " — parked for review" : `, retrying in ${next.delaySeconds}s`
        }: ${next.last_error}`,
      );

      // 🛑 Backoff pool exhausted → the job is parked. Alert ops immediately
      // (Slack Block Kit + email fallback). Never let alerting break the loop.
      if (next.exhausted) {
        try {
          await notifyParkedQueueJob(supabase, {
            queueRowId: row.id,
            eventId: row.event_id,
            eventType: row.event_type,
            attempts: row.attempts,
            maxAttempts: row.max_attempts,
            error: e,
            payload: row.payload,
          });
        } catch (alertErr) {
          console.error("[WEBHOOK-WORKER] parked-job alert failed:", alertErr);
        }
      }
    }
  }

  // The run itself succeeded (the worker is alive) even when individual jobs
  // failed — those have their own parked-job alerting path.
  await heartbeat(supabase, {
    ok: true,
    bootOk: true,
    error: lastError,
    claimed: events.length,
    processed,
    failed,
  });

  return new Response(JSON.stringify({ claimed: events.length, processed, failed }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
