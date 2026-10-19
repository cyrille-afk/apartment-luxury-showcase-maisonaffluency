import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PairingConfigurationSheet from './PairingConfigurationSheet';
import type { PairingProduct } from '@/lib/curatedPairings';

const mocks = vi.hoisted(() => ({ add: vi.fn() }));
vi.mock('@/lib/cart', () => ({ addToCart: mocks.add }));
vi.mock('@/hooks/useCuratorPickDetail', () => ({ useCuratorPickDetail: () => ({ data: { size_variants: [], gallery_images: [], variant_image_map: {} }, isPending: false, isError: false }) }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock('@/hooks/usePublicRrp', () => ({ usePublicRrp: () => ({ data: null, isPending: false }), usePublicRrpDisplay: () => ({ displayRow: { currency: 'USD' }, toDisplayCents: (c: number) => c }), formatPublicRrpCents: (c: number) => `$${c / 100}` }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const hero = 'https://assets.example/hero.jpg';
const photo = 'https://assets.example/oak.jpg';
const macro = 'https://assets.example/oak-macro.jpg';
const piece: PairingProduct = { id: 'pick', title: 'Console', brand: 'Atelier', image: hero, path: '/designers/atelier/console', pairingRuleId: 'rule', finishCurrency: 'USD', finishOptions: [{ id: 'oak', name: 'Oak', price_cents: 10000 }, { id: 'brass', name: 'Brass', price_cents: 20000 }], finishMedia: [{ key: 'custom:oak', label: 'Oak', product_image_url: photo, macro_image_url: macro }, { key: 'custom:brass', label: 'Brass', macro_image_url: macro }] };
function open() {
  render(<PairingConfigurationSheet preview piece={piece} initial={{ selection: { base: null, top: null, label: null }, visual: {}, customId: 'oak', material: '' }} onClose={vi.fn()} onExplore={vi.fn()} />);
}
describe('customer configuration preview', () => {
  it('starts on the admin selected finish and uses its unsaved exact photo', () => {
    open(); expect(screen.getByRole('img', { name: 'Console — Oak' }).getAttribute('src')).toBe(photo);
  });
  it('switches to hero and macro when a finish has no product photo', async () => {
    open(); fireEvent.click(screen.getByRole('button', { name: 'Finish: Brass' }));
    expect((await screen.findByRole('img', { name: 'Console' })).getAttribute('src')).toBe(hero);
    expect(screen.getByRole('img', { name: 'Brass material close-up' }).getAttribute('src')).toBe(macro);
  });
  it('shows the same texture fallback when a product image fails', () => {
    open(); fireEvent.error(screen.getByRole('img', { name: 'Console — Oak' }));
    expect(screen.getByRole('img', { name: 'Oak material close-up' }).getAttribute('src')).toBe(macro);
  });
  it('does not write to the cart while previewing finishes or quantities', () => {
    open(); fireEvent.click(screen.getByRole('button', { name: 'Increase Console quantity' }));
    fireEvent.click(screen.getByRole('button', { name: 'Place Order' }));
    expect(mocks.add).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Place Order' })).toBeDisabled();
  });
});