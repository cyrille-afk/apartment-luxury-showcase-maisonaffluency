import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StripeBankTransferPanel from './StripeBankTransferPanel';
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
const pairing = { ruleId: 'rule', optionId: 'ivory-brass' };
const items = [{ pickId: 'console', title: 'Console', price: 8700, quantity: 2, selectedFinish: 'Ivory / Brass', pairing }];
const props = { items, email: 'buyer@example.com', currency: 'GBP', fallback: <div>Static account fallback</div>, recoveryLines: [{ pickId: 'console', unitCents: 870000, pairing, currency: 'GBP', finishLabel: 'Ivory / Brass', productPath: '/console' }] };
const failure = (recovery: unknown) => ({ data: null, error: { context: new Response(JSON.stringify({ error: 'Price has changed', recovery }), { status: 409 }) } });
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe('instant transfer price recovery', () => {
  it('requires an explicit offered choice and regenerates routing with only the accepted price changed', async () => {
    const rec = { pickId: 'console', pairing, reason: 'price_changed', priceOptions: [{ label: 'Small', unitCents: 910000 }, { label: 'Large', unitCents: 990000 }] };
    mocks.invoke.mockResolvedValueOnce(failure(rec)).mockResolvedValue({ data: { financialAddresses: [{ type: 'sort_code', sort_code: { sort_code: '00-00-00', account_number: 'TEST-ONLY' } }], reference: 'test-reference' }, error: null });
    const recover = vi.fn().mockReturnValue(true);
    const view = render(<StripeBankTransferPanel {...props} onRecover={recover} />);
    const confirm = await screen.findByRole('button', { name: 'Confirm selected price and retry' });
    expect(confirm).toBeDisabled(); expect(mocks.invoke).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('Large', { exact: true }));
    expect(recover).not.toHaveBeenCalled();
    fireEvent.click(confirm);
    expect(recover).toHaveBeenCalledWith(expect.objectContaining({ pickId: 'console', pairing }), 990000);
    view.rerender(<StripeBankTransferPanel {...props} items={[{ ...items[0], price: 9900 }]} onRecover={recover} />);
    await screen.findByText('TEST-ONLY');
    expect(mocks.invoke).toHaveBeenCalledTimes(2);
    expect(mocks.invoke.mock.calls[1][1].body.items).toEqual([{ ...items[0], price: 9900 }]);
  });
  it('keeps unavailable finishes configured and offers retry without showing account instructions', async () => {
    mocks.invoke.mockResolvedValue(failure({ pickId: 'console', pairing, reason: 'finish_unavailable' }));
    render(<StripeBankTransferPanel {...props} onRecover={vi.fn()} />);
    await screen.findByRole('button', { name: 'Reselect on product page' });
    expect(screen.queryByText('Static account fallback')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept updated price and retry' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await vi.waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(2));
    expect(mocks.invoke.mock.calls[1][1].body.items).toEqual(items);
  });
});