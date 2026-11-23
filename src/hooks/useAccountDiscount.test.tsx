import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: { id: 'customer' }, isTradeUser: false, isAdmin: false, isSuperAdmin: false, rolesLoaded: true, tradeStatus: 'approved' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state }));
vi.mock('@/hooks/useTradeDiscount', () => ({ useTradeDiscount: () => ({ discountPct: 0.1, tierLabel: 'Silver', discountLabel: '10%' }) }));
import { useAccountDiscount } from './useAccountDiscount';
describe('public customer discount isolation', () => {
  it('charges a confirmed public customer full retail without a Trade role', () => {
    const { result } = renderHook(() => useAccountDiscount());
    expect(result.current.eligible).toBe(false);
    expect(result.current.totalFor(100000)).toBe(100000);
    expect(result.current.amountFor(100000)).toBe(0);
  });
  it('waits for validated roles before applying the configured Trade discount', () => {
    state.isTradeUser = true; state.rolesLoaded = false;
    const { result, rerender } = renderHook(() => useAccountDiscount());
    expect(result.current.totalFor(100000)).toBe(100000);
    state.rolesLoaded = true; rerender();
    expect(result.current.totalFor(100000)).toBe(90000);
    state.isTradeUser = false;
  });
});