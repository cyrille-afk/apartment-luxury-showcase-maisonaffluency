import { render, waitFor, cleanup, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from '@/lib/router-compat';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TradeAdminStudioDetail from './TradeAdminStudioDetail';

const state = vi.hoisted(() => ({ auth: { user: { id: 'user-1' }, rolesLoaded: true, isAdmin: false, isSuperAdmin: false }, rpc: vi.fn(), invoke: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc, functions: { invoke: state.invoke } } }));
vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
vi.mock('@/components/trade/admin/StudioInviteHistory', () => ({ StudioInviteHistory: () => null }));
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children }: { value: string; onValueChange: (value: string) => void; children: React.ReactNode }) => <div><select aria-label="Member role" value={value} onChange={event => onValueChange(event.target.value)}><option value="admin">admin</option><option value="editor">editor</option><option value="viewer">viewer</option></select>{children}</div>,
  SelectTrigger: () => null, SelectValue: () => null, SelectContent: () => null, SelectItem: () => null,
}));
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/trade/admin/studios/studio-1']}><Routes><Route path="/trade/admin/studios/:studioId" element={<TradeAdminStudioDetail />} /></Routes></MemoryRouter></QueryClientProvider>);
}
describe('admin studio detail access', () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.auth = { user: { id: 'user-1' }, rolesLoaded: true, isAdmin: false, isSuperAdmin: false };
    state.rpc.mockReset().mockResolvedValue({ data: null, error: null });
    state.invoke.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  });
  it('never requests private studio details for an ordinary member', () => { mount(); expect(state.rpc).not.toHaveBeenCalled(); });
  it('waits for roles before requesting private studio details', () => { state.auth.isAdmin = true; state.auth.rolesLoaded = false; mount(); expect(state.rpc).not.toHaveBeenCalled(); });
  it.each(['isAdmin', 'isSuperAdmin'] as const)('allows %s to request only the selected studio', async role => {
    state.auth[role] = true; mount();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('admin_studio_details', { _studio_id: 'studio-1' }));
  });
  const details = {
    studio: { id: 'studio-1', name: 'Test studio', created_at: '2026-10-19' }, invitations: [],
    members: [
      { id: 'owner-1', name: 'Owner', role: 'owner', joined_at: '2026-10-19' },
      { id: 'member-1', name: 'Editor', role: 'editor', joined_at: '2026-10-19' },
    ],
  };
  function allow() { state.auth.isAdmin = true; state.rpc.mockResolvedValue({ data: details, error: null }); }
  it('does not offer role changes or removal for owners', async () => {
    allow(); mount(); await screen.findByRole('button', { name: 'Remove Editor' });
    expect(screen.queryByRole('button', { name: 'Remove Owner' })).toBeNull();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
  });
  it('sends the selected role only after confirmation with the exact studio and previous role', async () => {
    allow(); mount(); await screen.findByRole('combobox');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'viewer' } });
    expect(state.rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm role change' }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('admin_manage_studio_member', { _studio_id: 'studio-1', _member_id: 'member-1', _action: 'change_role', _expected_role: 'editor', _role: 'viewer' }));
  });
  it('cancelled removal never sends a member mutation', async () => {
    allow(); mount(); fireEvent.click(await screen.findByRole('button', { name: 'Remove Editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
  it('confirmed removal sends only the exact studio membership', async () => {
    allow(); mount(); fireEvent.click(await screen.findByRole('button', { name: 'Remove Editor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('admin_manage_studio_member', { _studio_id: 'studio-1', _member_id: 'member-1', _action: 'remove', _expected_role: 'editor', _role: undefined }));
  });
  it('keeps a rejected removal open for retry', async () => {
    allow(); mount(); fireEvent.click(await screen.findByRole('button', { name: 'Remove Editor' }));
    state.rpc.mockResolvedValueOnce({ data: null, error: new Error('Member role has changed') });
    fireEvent.click(screen.getByRole('button', { name: 'Remove member' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Remove member' })).toBeTruthy();
  });
  it('resends the stored pending invitation with no caller-supplied recipient and a new key after success', async () => {
    allow();
    state.rpc.mockResolvedValue({ data: { ...details, invitations: [{ id: 'invite-1', email: 'greg@example.com', role: 'editor', created_at: '2026-10-19', expires_at: '2026-11-02', expired: false }] }, error: null });
    mount();
    const button = await screen.findByRole('button', { name: 'Resend invitation to greg@example.com' });
    fireEvent.click(button);
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    expect(state.invoke).toHaveBeenCalledWith('send-transactional-email', { body: { templateName: 'studio-teammate-invite', idempotencyKey: expect.stringMatching(/^studio-invite-invite-1-/), templateData: { inviteId: 'invite-1' } } });
    const firstKey = state.invoke.mock.calls[0][1].body.idempotencyKey;
    fireEvent.click(button);
    await waitFor(() => expect(state.invoke).toHaveBeenCalledTimes(2));
    expect(state.invoke.mock.calls[1][1].body.idempotencyKey).not.toBe(firstKey);
  });
  it('retains the same attempt key after a failed resend', async () => {
    allow();
    state.rpc.mockResolvedValue({ data: { ...details, invitations: [{ id: 'invite-1', email: 'greg@example.com', role: 'editor', created_at: '2026-10-19', expires_at: '2026-11-02', expired: false }] }, error: null });
    state.invoke.mockResolvedValueOnce({ data: null, error: new Error('Network error') });
    mount();
    const button = await screen.findByRole('button', { name: 'Resend invitation to greg@example.com' });
    fireEvent.click(button);
    await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false));
    fireEvent.click(button);
    await waitFor(() => expect(state.invoke).toHaveBeenCalledTimes(2));
    expect(state.invoke.mock.calls[1][1].body.idempotencyKey).toBe(state.invoke.mock.calls[0][1].body.idempotencyKey);
  });
  function withInvite() {
    allow();
    state.rpc.mockResolvedValue({ data: { ...details, invitations: [{ id: 'invite-1', email: 'greg@example.com', role: 'editor', created_at: '2026-10-19', expires_at: '2026-11-02', expired: false }] }, error: null });
  }
  it('cancelling invite revocation never changes the invitation', async () => {
    withInvite(); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke invitation to greg@example.com' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(state.rpc).toHaveBeenCalledTimes(1);
    expect(state.invoke).not.toHaveBeenCalled();
  });
  it('revokes only the selected invitation in the selected studio after confirmation', async () => {
    withInvite(); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke invitation to greg@example.com' }));
    expect(state.rpc).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Revoke invitation' }));
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('admin_revoke_studio_invitation', { _studio_id: 'studio-1', _invite_id: 'invite-1' }));
    expect(state.invoke).not.toHaveBeenCalled();
  });
  it('keeps rejected revocation open without losing the invitation', async () => {
    withInvite(); mount();
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke invitation to greg@example.com' }));
    state.rpc.mockResolvedValueOnce({ data: null, error: new Error('Accepted invitations cannot be revoked') });
    fireEvent.click(screen.getByRole('button', { name: 'Revoke invitation' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Revoke invitation' })).toBeTruthy();
  });
});