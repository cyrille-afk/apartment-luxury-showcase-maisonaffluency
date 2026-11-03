import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from '@/lib/router-compat';
import { HelmetProvider } from 'react-helmet-async';
import TradeActivate from './TradeActivate';

const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn(), updateUser: vi.fn(), getUser: vi.fn(), refreshSession: vi.fn(), invoke: vi.fn(), navigate: vi.fn() }));
const requestSetup = vi.hoisted(() => vi.fn());
vi.mock('@/lib/tradeSetupRequest.functions', () => ({ requestTradePasswordSetup: requestSetup }));
vi.mock('@/components/Turnstile', () => ({ default: ({ onVerify }: { onVerify: (proof: string) => void }) => <input aria-label="Security proof" onChange={event => onVerify(event.target.value)} /> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: mocks, functions: { invoke: mocks.invoke } } }));
vi.mock('@/lib/router-compat', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/router-compat')>(), useNavigate: () => mocks.navigate }));
const open = () => render(<HelmetProvider><MemoryRouter initialEntries={['/trade/activate?type=recovery&token_hash=' + 'a'.repeat(64)]}><TradeActivate /></MemoryRouter></HelmetProvider>);
describe('Trade activation password setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({ data: { user: { email: 'test@example.com' } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'applicant' } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    mocks.refreshSession.mockResolvedValue({ error: null });
    requestSetup.mockResolvedValue({ ok: true });
  });
  it('does not consume the link until the applicant explicitly continues', async () => {
    open(); expect(mocks.verifyOtp).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Continue activation' }));
    await screen.findByLabelText('New password');
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'a'.repeat(64) });
  });
  it('sets a password without current_password, then completes server-validated access', async () => {
    open(); fireEvent.click(screen.getByRole('button', { name: 'Continue activation' }));
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'Test-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Test-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password & activate' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/trade/dashboard', { replace: true }));
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'Test-password-123' });
    expect(mocks.invoke).toHaveBeenCalledWith('activate-trade-invite', { body: { action: 'complete' } });
  });
  it('rejects mismatched passwords without granting access', async () => {
    open(); fireEvent.click(screen.getByRole('button', { name: 'Continue activation' }));
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'Test-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Different-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password & activate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match');
    expect(mocks.updateUser).not.toHaveBeenCalled(); expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('lets applicants retry access without overwriting their saved password', async () => {
    mocks.invoke.mockResolvedValueOnce({ error: new Error('offline') });
    open(); fireEvent.click(screen.getByRole('button', { name: 'Continue activation' }));
    fireEvent.change(await screen.findByLabelText('New password'), { target: { value: 'Test-password-123' } });
    fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: 'Test-password-123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Set password & activate' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Retry trade activation' }));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.updateUser).toHaveBeenCalledTimes(1);
  });
  it('requests fresh setup without changing approval or verifying a rejected token again', async () => {
    mocks.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired' } });
    open(); fireEvent.click(screen.getByRole('button', { name: 'Continue activation' }));
    fireEvent.change(await screen.findByLabelText('Approved application email'), { target: { value: 'studio@example.com' } });
    fireEvent.change(screen.getByLabelText('Security proof'), { target: { value: 'verified-proof' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request fresh password-setup link' }));
    await waitFor(() => expect(requestSetup).toHaveBeenCalledWith({ data: { email: 'studio@example.com', proof: 'verified-proof' } }));
    expect(mocks.verifyOtp).toHaveBeenCalledTimes(1);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});