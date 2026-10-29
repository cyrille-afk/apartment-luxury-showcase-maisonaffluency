import { createClient } from 'npm:@supabase/supabase-js@2.57.2';
import { getStripe } from './stripeClient.ts';
import { deliveryReasons, missingLiveDeliveries, SIGNATURE_WINDOW_MINUTES, type DeliveryEvent } from './stripeDeliveryRules.ts';
export async function checkStripeDeliveries(db: ReturnType<typeof createClient>, now: Date) {
  const reasons: string[] = [];
  const missing: DeliveryEvent[] = [];
  let rejected = 0;
  let available = true;
  try {
    const { count, error } = await db.from('security_audit_events').select('id', { count: 'exact', head: true })
      .eq('source', 'stripe-webhook').eq('event_type', 'stripe_signature_rejected')
      .or('details->>classification.is.null,details->>classification.neq.expected_smoke_test')
      .gte('occurred_at', new Date(now.getTime() - SIGNATURE_WINDOW_MINUTES * 60000).toISOString());
    if (error) throw new Error('Signature telemetry could not be read');
    rejected = count ?? 0;
  } catch { reasons.push('Signature telemetry could not be read'); }
  try {
    const { stripe, liveMode } = await getStripe('auto');
    if (!liveMode) throw new Error('Live credentials unavailable');
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const endpoint = endpoints.data.find(e => e.url.replace(/\/$/, '') === `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-webhook`);
    if (!endpoint || endpoint.status !== 'enabled') throw new Error('Live endpoint missing or disabled');
    const types = new Set(endpoint.enabled_events);
    let cursor: string | undefined;
    for (let page = 0; page < 10; page++) {
      const events = await stripe.events.list({ delivery_success: false, created: { gte: Math.floor(now.getTime() / 1000) - 86400 }, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
      const ids = events.data.map(e => e.id);
      if (!ids.length) break;
      const { data, error } = await db.from('webhook_events').select('event_id').eq('provider', 'stripe').in('event_id', ids);
      if (error) throw new Error('Local receipts unavailable');
      missing.push(...missingLiveDeliveries(events.data, new Set((data ?? []).map(row => row.event_id)), types, Math.floor(now.getTime() / 1000)));
      if (!events.has_more) break;
      cursor = ids.at(-1);
      if (page === 9) { available = false; reasons.push('Live Stripe reconciliation exceeded 1000 undelivered events; coverage is incomplete'); }
    }
  } catch (error) {
    available = false;
    console.error('[STRIPE-DELIVERY-MONITOR] provider check failed', error instanceof Error ? error.name : 'unknown');
    reasons.push('Live Stripe delivery check unavailable; verify Stripe access and that the live endpoint is enabled');
  }
  reasons.push(...deliveryReasons(missing, rejected));
  return { reasons, missingLiveEventIds: missing.map(e => e.id), signatureRejections: rejected, available };
}
