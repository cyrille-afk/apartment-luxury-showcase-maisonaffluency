import { describe, expect, it } from 'vitest';
import { detectedLocation } from '../../supabase/functions/detect-client-currency/rules';

describe('IP-detected currency', () => {
  it.each([['SG', 'SGD'], ['US', 'USD'], ['GB', 'GBP'], ['FR', 'EUR'], ['CH', 'CHF'], ['AE', 'AED']])('maps %s to %s', (country, currency) => {
    expect(detectedLocation(country)).toEqual({ country, currency });
  });
  it('leaves unknown locations unavailable, never defaults to EUR', () => {
    expect(detectedLocation('ZZ')).toBeNull();
    expect(detectedLocation(undefined)).toBeNull();
  });
});