import { describe, it, expect } from 'vitest';

import { calculateCartTotal } from '../utils/pricingEngine';

// Constant Mock Exchange Rates for Validation
const MOCK_RATES = { EUR_TO_USD: 1.12, USD_TO_SGD: 1.34 };

describe('Maison Affluency Checkout Pricing Engine Validation', () => {
  it('Scenario 1: Should convert multi-currency items (USD + EUR) accurately into a uniform USD Subtotal', () => {
    const basket = [
      { id: 'lamp_1', price: 5950, currency: 'USD', quantity: 1 },
      { id: 'chair_1', price: 11100, currency: 'EUR', quantity: 1 },
    ];

    const result = calculateCartTotal(basket, 'SG', MOCK_RATES);

    // Expected calculation logic: 5950 + (11100 * 1.12) = 18,382 USD
    expect(result.subtotalUSD).toBe(18382);
  });

  it('Scenario 2: Should identify baskets over S$400 and defer GST calculation to Border Customs labels', () => {
    const basket = [{ id: 'lamp_1', price: 5950, currency: 'USD', quantity: 1 }];

    const result = calculateCartTotal(basket, 'SG', MOCK_RATES);

    const subtotalSGD = result.subtotalUSD * MOCK_RATES.USD_TO_SGD;

    // Validate threshold logic trigger
    if (subtotalSGD > 400) {
      expect(result.taxStatus).toBe('DEFERRED_BORDER_CUSTOMS');
      expect(result.displayTaxLabel).toContain('Handled at Border Customs');
    }
  });

  it('Scenario 3: Should accurately sum Subtotal + Delivery Deposits into the final Order Total output', () => {
    const basket = [
      { id: 'lamp_1', price: 5950, currency: 'USD', quantity: 1 },
      { id: 'chair_1', price: 11100, currency: 'EUR', quantity: 1 },
    ];
    const shippingDepositUSD = 3145;

    const result = calculateCartTotal(basket, 'SG', MOCK_RATES, shippingDepositUSD);

    // Subtotal (18,382) + Shipping (3,145) = 21,527 USD Total
    expect(result.orderTotalUSD).toBe(21527);
  });
});
