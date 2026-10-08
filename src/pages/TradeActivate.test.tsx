import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import TradeActivate from './TradeActivate';

const mocks = vi.hoisted(() => ({ verifyOtp: vi.fn(), updateUser: vi.fn(), getUser: vi.fn(), refreshSession: vi.fn(), invoke: vi.fn(), navigate: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: mocks, functions: { invoke: mocks.invoke } } }));
vi.mock('react-router-dom', async importOriginal => ({ ...await importOriginal<typeof import('react-router-dom')>(), useNavigate: () => mocks.navigate }));
const open = () => render(<HelmetProvider><MemoryRouter initialEntries={['/trade/activate?type=recovery&token_hash=' + 'a'.repeat(64)]}><TradeActivate /></MemoryRouter></HelmetProvider>);
describe('Trade activation password setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOtp.mockResolvedValue({ data: { user: { email: 'test@example.com' } }, error: null });
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'applicant' } }, error: null });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    mocks.refreshSession.mockResolvedValue({ error: null });
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
});