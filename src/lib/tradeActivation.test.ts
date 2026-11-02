import { describe, expect, it, vi } from 'vitest';
import { completeTradeActivation } from '../../supabase/functions/_shared/tradeActivation';
import type { SupabaseClient } from '@supabase/supabase-js';

function fixture({ confirmed = true, owner = null as string | null, status = 'approved' } = {}) {
  const writes: { table: string; data: unknown }[] = [];
  const filters: { table: string; column: string; value: unknown }[] = [];
  const service = {
    auth: { admin: { getUserById: vi.fn(async () => ({ data: { user: { email: 'integrha@yahoo.com', email_confirmed_at: confirmed ? '2026-11-02' : null } }, error: null })) } },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: (column: string, value: unknown) => { filters.push({ table, column, value }); return chain; },
        maybeSingle: async () => ({ data: { id: 'approved-studio', status, user_id: owner }, error: null }),
        update: (data: unknown) => { writes.push({ table, data }); return chain; },
        upsert: async (data: unknown) => { writes.push({ table, data }); return { error: null }; },
        then: (resolve: (value: unknown) => void) => resolve({ error: null }),
      };
      return chain;
    },
  } as unknown as SupabaseClient;
  return { service, writes, filters };
}

describe('Approved studio activation linking', () => {
  it('links Juliana’s verified account to the existing approved studio without approving again', async () => {
    // Already linked to this same user avoids activation-notification side effects in this unit test.
    const { service, writes, filters } = fixture({ owner: 'juliana-account' });
    await expect(completeTradeActivation(service, 'juliana-account')).resolves.toEqual({ ok: true });
    expect(writes).toContainEqual({ table: 'trade_accounts', data: { user_id: 'juliana-account' } });
    expect(filters).toContainEqual({ table: 'trade_accounts', column: 'email', value: 'integrha@yahoo.com' });
    expect(filters).toContainEqual({ table: 'trade_accounts', column: 'id', value: 'approved-studio' });
    expect(filters).toContainEqual({ table: 'trade_accounts', column: 'status', value: 'approved' });
    expect(writes).toContainEqual({ table: 'user_roles', data: { user_id: 'juliana-account', role: 'trade_user' } });
  });
  it('cannot link an account before email verification', async () => {
    const { service, writes } = fixture({ confirmed: false });
    await expect(completeTradeActivation(service, 'juliana-account')).rejects.toThrow('Verify your activation email first');
    expect(writes).toEqual([]);
  });
  it('cannot replace another account already linked to the studio', async () => {
    const { service, writes } = fixture({ owner: 'other-account' });
    await expect(completeTradeActivation(service, 'juliana-account')).rejects.toThrow('An approved application is required');
    expect(writes).toEqual([]);
  });
  it('does not grant access if studio approval has been withdrawn', async () => {
    const { service, writes } = fixture({ status: 'rejected' });
    await expect(completeTradeActivation(service, 'juliana-account')).rejects.toThrow('An approved application is required');
    expect(writes).toEqual([]);
  });
});