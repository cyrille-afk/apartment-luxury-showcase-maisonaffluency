import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from '@/lib/router-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TradeAdminStudios from './TradeAdminStudios';

const state = vi.hoisted(() => ({
  auth: { user: { id: 'user-1' }, rolesLoaded: true, isAdmin: false, isSuperAdmin: false },
  rpc: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc } }));
vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><TradeAdminStudios /></MemoryRouter></QueryClientProvider>);
}
describe('admin studio directory access', () => {
  beforeEach(() => {
    state.auth = { user: { id: 'user-1' }, rolesLoaded: true, isAdmin: false, isSuperAdmin: false };
    state.rpc.mockReset().mockResolvedValue({ data: { studios: [], total: 0, total_studios: 0 }, error: null });
  });
  it('does not request all studios for an ordinary trade member', () => {
    mount();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('waits for loaded roles even for an administrator', () => {
    state.auth.isAdmin = true;
    state.auth.rolesLoaded = false;
    mount();
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it.each(['isAdmin', 'isSuperAdmin'] as const)('allows %s to request the server-authorized directory', async role => {
    state.auth[role] = true;
    mount();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('admin_studio_directory', { _search: '', _offset: 0 }));
  });
});