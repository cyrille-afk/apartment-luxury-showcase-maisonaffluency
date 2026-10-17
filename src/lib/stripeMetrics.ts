export type StripeCheck = { checked_at: string; available: boolean; missing_live_events: number };
export type StripePoint = { at: string; received: number; processed: number; failed: number; signature_errors: number; ack_ms: number | null; processing_ms: number | null; delivery_ms: number | null };
export type StripeMetrics = {
  checked_at: string;
  totals: { received: number; processed: number; failed: number; pending: number; ack_ms: number | null; processing_ms: number | null; p95_processing_ms: number | null; delivery_ms: number | null };
  signature_errors: number;
  series: StripePoint[];
  provider_latest: StripeCheck | null;
  provider_history: StripeCheck[];
  recent: { event_id: string; event_type: string; status: string; attempts: number; ack_ms: number | null; processing_ms: number | null; delivery_ms: number | null; created_at: string }[];
};
export function processingRate(received: number, processed: number): number | null {
  return received > 0 ? processed / received * 100 : null;
}
export function providerStatus(check: StripeCheck | null, now: number): string {
  if (!check) return 'Awaiting first check';
  if (now - Date.parse(check.checked_at) > 20 * 60000) return 'Check overdue';
  if (!check.available) return 'Stripe check unavailable';
  return check.missing_live_events > 0 ? 'Delivery failures detected' : 'No undelivered live events';
}
export function duration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)} min`;
  return `${(ms / 3600000).toFixed(1)} h`;
}