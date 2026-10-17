import { describe, expect, it } from 'vitest';
import { processingRate, providerStatus } from '../stripeMetrics';
describe('Stripe metrics', () => {
  it('does not report success when no live events exist', () => {
    expect(processingRate(0, 0)).toBeNull();
    expect(processingRate(8, 7)).toBe(87.5);
  });
  it('never presents unavailable provider checks as successful delivery', () => {
    expect(providerStatus({ checked_at: '2026-10-17T20:00:00Z', available: false, missing_live_events: 0 }, Date.parse('2026-10-17T20:01:00Z'))).toBe('Stripe check unavailable');
  });
  it('reports real provider failures independently of local processing', () => {
    expect(providerStatus({ checked_at: '2026-10-17T20:00:00Z', available: true, missing_live_events: 7 }, Date.parse('2026-10-17T20:01:00Z'))).toBe('Delivery failures detected');
  });
});