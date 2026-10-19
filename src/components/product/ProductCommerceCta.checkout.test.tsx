import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CartItem } from '@/lib/cart';
import ProductCommerceCta from './ProductCommerceCta';

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), items: [] as CartItem[], intake: vi.fn(), clientSafe: false }));
vi.mock('react-router-dom', () => ({ useNavigate: () => mocks.navigate, useLocation: () => ({ state: null }), Link: () => null }));
vi.mock('@/lib/cart', async (original) => ({ ...await original<typeof import('@/lib/cart')>(), useCart: () => mocks.items }));
vi.mock('@/contexts/ProductConfigContext', () => ({ useProductConfigOptional: () => null }));
vi.mock('@/contexts/CheckoutFormContext', () => ({ useCheckoutForm: () => ({ buyerProfile: 'private', projectCity: 'London', email: 'client@example.com', update: vi.fn() }) }));
vi.mock('@/hooks/useTradeProductPricing', () => ({ useTradeProductPricing: () => ({ data: null }) }));
vi.mock('@/hooks/useTradeDiscount', () => ({ useTradeDiscount: () => ({ discountPct: 0, apply: (price: number) => price }) }));
vi.mock('@/lib/clientSafeMode', () => ({ useClientSafeMode: () => ({ clientSafe: mocks.clientSafe }) }));
vi.mock('./SelectionDrawer', () => ({ default: ({ onCheckout }: { onCheckout: (method: string) => void }) => <button onClick={() => onCheckout('online')}>Checkout selection</button> }));
vi.mock('./BespokeConfigurationDialog', () => ({ default: () => null }));
vi.mock('./OrderIntakeSheet', () => ({ default: (props: { isOpen: boolean; onComplete: (details: unknown) => void }) => { mocks.intake(props); return props.isOpen ? <button onClick={() => props.onComplete({ profile: 'private', city: 'London', email: 'client@example.com', notes: '', phone: '', company: '' })}>Complete intake</button> : null; } }));

beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} })); });
afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); mocks.clientSafe = false; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('mobile order intake', () => {
  it.each([false, true])('requires intake before ordering even for returning approved=%s buyers', (approved) => {
    vi.useFakeTimers();
    sessionStorage.setItem('ma_intake_done', '1');
    const placeOrder = vi.fn();
    const add = vi.fn();
    render(<ProductCommerceCta productId="chair" dockOnly tradeApproved={approved} rrpLabel="$1,200" finishSelectionRequired onPlaceOrder={placeOrder} onAddToCart={add} />);
    fireEvent.click(screen.getByRole('button', { name: /^Place Order$/ }));
    expect(mocks.intake.mock.calls.at(-1)?.[0].isOpen).toBe(true);
    expect(placeOrder).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Complete intake' }));
    act(() => vi.advanceTimersByTime(260));
    expect(approved ? placeOrder : add).toHaveBeenCalledWith(1);
  });
});

describe('product selection checkout hand-off', () => {
  it('retains the custom pairing reference and finish price with the original selection', () => {
    const original: CartItem = { key: 'pendant', pickId: 'pendant', designerSlug: 'atelier', productSlug: 'pendant', title: 'Pendant', designerName: 'Atelier', finishLabel: 'Brass', imageUrl: null, leadTime: null, unitPriceCents: 120000, currency: 'USD', quantity: 2 };
    const pairing: CartItem = { ...original, key: 'console', pickId: 'console', productSlug: 'console', title: 'Console', finishLabel: 'Ivory Lacquer / Aged Brass', unitPriceCents: 870000, quantity: 3, pairing: { ruleId: 'console-rule', optionId: 'ivory-brass' }, variant: { base: 'Brass', top: 'Ivory', size: null }, origin: 'FR', pickupCountry: 'FR' };
    mocks.items = [original, pairing];
    const placeOrder = vi.fn();
    render(<ProductCommerceCta productId="pendant" rrpLabel="$1,200" dock={false} onPlaceOrder={placeOrder} />);
    fireEvent.click(screen.getByRole('button', { name: 'Checkout selection' }));
    expect(placeOrder).not.toHaveBeenCalled();
    expect(mocks.navigate).toHaveBeenCalledWith('/checkout', { state: { lines: [
      expect.objectContaining({ pickId: 'pendant', unitCents: 120000, quantity: 2, pairing: null }),
      expect.objectContaining({ pickId: 'console', pairing: { ruleId: 'console-rule', optionId: 'ivory-brass' }, finishLabel: 'Ivory Lacquer / Aged Brass', unitCents: 870000, quantity: 3, variant: pairing.variant, origin: 'FR', pickupCountry: 'FR' }),
    ] } });
  });
});