/**
 * Retry / backoff policy for the asynchronous webhook queue.
 *
 * Extracted from `process-webhook-events` so the exact production policy can be
 * asserted by the E2E suite (tests/checkout-flow.spec.ts) instead of a copy of
 * it. A failing downstream service (Twilio, Resend, Slack) must never lose the
 * event: it is released back to the queue with exponential backoff and only
 * parked as `failed` once max_attempts is exhausted.
 */

/** Backoff per attempt number (seconds): 15s, 1m, 5m, 30m, 2h. */
export const BACKOFF_SECONDS = [15, 60, 300, 1800, 7200];

/** Delay before the next attempt. `attempts` is the post-claim attempt count. */
export function backoffSeconds(attempts: number): number {
  const idx = Math.min(Math.max(attempts, 0), BACKOFF_SECONDS.length - 1);
  return BACKOFF_SECONDS[idx];
}

export interface QueueRetryInput {
  /** attempts value after `claim_webhook_events` incremented it. */
  attempts: number;
  maxAttempts: number;
  error: unknown;
  now?: Date;
}

export interface QueueRetryState {
  status: "pending" | "failed";
  last_error: string;
  locked_at: null;
  next_attempt_at: string;
  updated_at: string;
  /** Convenience fields for logging / assertions (not written to the row). */
  delaySeconds: number;
  exhausted: boolean;
}

/** The row patch to apply when processing an event threw. */
export function nextQueueState(input: QueueRetryInput): QueueRetryState {
  const now = input.now ?? new Date();
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  const exhausted = input.attempts >= input.maxAttempts;
  const delaySeconds = backoffSeconds(input.attempts);

  return {
    status: exhausted ? "failed" : "pending",
    last_error: message.slice(0, 2000),
    locked_at: null,
    next_attempt_at: new Date(now.getTime() + delaySeconds * 1000).toISOString(),
    updated_at: now.toISOString(),
    delaySeconds,
    exhausted,
  };
}
