import { describe, expect, it, vi } from 'vitest';
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => ({ middleware: () => ({ handler: (fn: unknown) => fn }) }) }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
import { getArAnalytics } from './arAnalytics.functions';
const run = getArAnalytics as unknown as (arg: { context: { userId: string; supabase: { rpc: ReturnType<typeof vi.fn> } } }) => Promise<unknown>;
describe('AR analytics authorization', () => {
  it('rejects a non-admin', async () => {
    await expect(run({ context: { userId: 'customer', supabase: { rpc: vi.fn().mockResolvedValue({ data: false, error: null }) } } })).rejects.toThrow('Admin access');
  });
  it('fails closed when the role lookup errors', async () => {
    await expect(run({ context: { userId: 'admin', supabase: { rpc: vi.fn().mockResolvedValue({ data: true, error: { message: 'offline' } }) } } })).rejects.toThrow('Admin access');
  });
  it('returns the real dated aggregate snapshot only after checking the caller role', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    const data = await run({ context: { userId: 'admin', supabase: { rpc } } });
    expect(rpc).toHaveBeenCalledWith('has_role', { _user_id: 'admin', _role: 'admin' });
    expect(data).toMatchObject({ to: '2026-11-24T10:03:04Z', totals: { all: { launches: 0, opens: 0, visits: 0 } } });
  });
});