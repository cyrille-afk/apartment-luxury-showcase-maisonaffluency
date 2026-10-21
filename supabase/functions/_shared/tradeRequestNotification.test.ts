import { describe, expect, it } from 'vitest';
import { tradeRequestNotification } from './tradeRequestNotification';

describe('stored trade request notices', () => {
  it('retains Grégoire’s exact custom request', () => {
    const notice = tradeRequestNotification('custom', { id: 'c1bad2cf-f590-4936-b643-ed3a09e81a9f', product_name: 'Art Deco 269 H Lounge Chair (C.1930)', brand_name: 'Jindrich Halabala', finish_notes: 'Can it be done in a different wood finish?', quantity: 1 }, { email: 'gregoire.arbonville@gmail.com' });
    expect(notice.productName).toBe('Art Deco 269 H Lounge Chair (C.1930)');
    expect(notice.selectedFinish).toBe('Can it be done in a different wood finish?');
    expect(notice.message).toContain('Quantity: 1');
  });
  it('carries the saved sample destination and notes', () => {
    const notice = tradeRequestNotification('sample', { id: 'sample-id', product_name: 'Chair', shipping_city: 'Singapore', shipping_country: 'Singapore', notes: 'Tobacco Oak sample' }, null);
    expect(notice.message).toContain('Ship to: Singapore, Singapore');
    expect(notice.message).toContain('Tobacco Oak sample');
    expect(notice.message).toContain('https://www.maisonaffluency.com/trade/samples?focus=sample-id');
  });
});