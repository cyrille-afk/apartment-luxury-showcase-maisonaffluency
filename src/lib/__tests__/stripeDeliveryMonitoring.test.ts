import { describe, expect, it } from 'vitest';
import { deliveryReasons, missingLiveDeliveries, signatureSpike } from '../../../supabase/functions/_shared/stripeDeliveryRules';
const event = { id: 'evt_live', type: 'payment_intent.succeeded', created: 1000, livemode: true };
describe('Stripe delivery monitoring', () => {
  it('alerts for live events missing after two minutes', () => {
    expect(missingLiveDeliveries([event], new Set(), new Set([event.type]), 1120)).toEqual([event]);
  });
  it('ignores other endpoints failures when our receipt exists', () => {
    expect(missingLiveDeliveries([event], new Set([event.id]), new Set(['*']), 1200)).toEqual([]);
  });
  it('ignores test events and unsubscribed event types', () => {
    expect(missingLiveDeliveries([{ ...event, livemode: false }, { ...event, type: 'other' }], new Set(), new Set([event.type]), 1200)).toEqual([]);
  });
  it('allows normal delivery latency', () => {
    expect(missingLiveDeliveries([event], new Set(), new Set(['*']), 1119)).toEqual([]);
  });
  it('alerts on even one unexpected rejection, but not zero', () => {
    expect(signatureSpike(0)).toBe(false); expect(signatureSpike(1)).toBe(true);
  });
  it('never infers live mode from unverified payloads', () => {
    expect(deliveryReasons([], 5)[0]).toContain('live/test origin cannot be trusted');
    expect(deliveryReasons([], 0)).toEqual([]);
  });
});
