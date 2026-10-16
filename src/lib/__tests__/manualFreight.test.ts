import { describe, expect, it } from 'vitest';
import { manualFreightCents, packingMissing } from '../manualFreight';

describe('manual freight without packing', () => {
  it('allows a Venus freight request with no packing measurements', () => {
    expect(packingMissing(null, null)).toBe(true);
    expect(packingMissing(0, 0)).toBe(true);
    expect(packingMissing(0.4, null)).toBe(false);
  });
  it('records the supplier amount as a total in cents without multiplying by product quantity', () => {
    expect(manualFreightCents('425.50')).toBe(42550);
    expect(manualFreightCents('0')).toBeNull();
    expect(manualFreightCents('-5')).toBeNull();
    expect(manualFreightCents('invalid')).toBeNull();
    expect(manualFreightCents('12.345')).toBeNull();
  });
});