import { render, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TradeAdminStudioDetail from './TradeAdminStudioDetail';

const state = vi.hoisted(() => ({ auth: { user: { id: 'user-1' }, rolesLoaded: true, isAdmin: false, isSuperAdmin: false }, rpc: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state.auth }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: state.rpc } }));
vi.mock('react-helmet-async', () => ({ Helmet: () => null }));
function mount() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/trade/admin/studios/studio-1']}><Routes><Route path="/trade/admin/studios/:studioId" element={<TradeAdminStudioDetail />} /></Routes></MemoryRouter></QueryClientProvider>);
}
describe('admin studio detail access', () => {
  afterEach(cleanup);
  beforeEach(() => {
    state.auth = { user: { id: 'user-1' }, rolesLoaded: true, isAdmin: false, isSuperAdmin: false };
    state.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  });
  it('never requests private studio details for an ordinary member', () => { mount(); expect(state.rpc).not.toHaveBeenCalled(); });
  it('waits for roles before requesting private studio details', () => { state.auth.isAdmin = true; state.auth.rolesLoaded = false; mount(); expect(state.rpc).not.toHaveBeenCalled(); });
  it.each(['isAdmin', 'isSuperAdmin'] as const)('allows %s to request only the selected studio', async role => {
    state.auth[role] = true; mount();
    await waitFor(() => expect(state.rpc).toHaveBeenCalledWith('admin_studio_details', { _studio_id: 'studio-1' }));
  });
});