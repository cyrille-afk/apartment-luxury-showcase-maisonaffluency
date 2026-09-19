/**
 * Prints the real queue retry/backoff schedule produced by
 * supabase/functions/_shared/webhookQueueRetry.ts — the exact module used by
 * the `process-webhook-events` worker.
 *
 * Usage: deno run -A tests/harness/queue-retry.harness.ts
 */
import { nextQueueState } from "../../supabase/functions/_shared/webhookQueueRetry.ts";

const now = new Date("2026-01-01T00:00:00.000Z");
const maxAttempts = 5;

const schedule = [1, 2, 3, 4, 5].map((attempts) => {
  const state = nextQueueState({
    attempts,
    maxAttempts,
    error: new Error("notify-payment-alerts(deposit_cleared) failed: Twilio 500"),
    now,
  });
  return {
    attempts,
    status: state.status,
    delaySeconds: state.delaySeconds,
    nextAttemptAt: state.next_attempt_at,
    exhausted: state.exhausted,
    lastError: state.last_error,
  };
});

console.log(JSON.stringify({ maxAttempts, schedule }));
