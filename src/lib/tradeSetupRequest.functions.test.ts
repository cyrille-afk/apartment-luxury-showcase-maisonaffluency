import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), maybeSingle: vi.fn(), from: vi.fn(), fetch: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => ({ inputValidator: () => ({ handler: (handler: unknown) => handler }) }) }));
vi.mock('@tanstack/react-start/server', () => ({ getRequestHeader: () => undefined, getRequestUrl: () => new URL('https://www.maisonaffluency.com/trade/activate'), setResponseHeader: vi.fn() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: mocks.from, functions: { invoke: mocks.invoke } } }));
import { requestTradePasswordSetup } from './tradeSetupRequest.functions';

const request = requestTradePasswordSetup as unknown as (input: { data: { email: string; proof: string } }) => Promise<{ ok: boolean }>;
describe('Public setup email security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-only');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, hostname: 'www.maisonaffluency.com' }) });
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) });
    mocks.invoke.mockResolvedValue({ data: { success: true }, error: null });
  });
  it('rejects invalid bot proof before private reads or sending', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: false }) });
    await expect(request({ data: { email: 'test@example.com', proof: 'bad-proof-value' } })).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('rejects proof minted for a different hostname', async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ success: true, hostname: 'other.example.com' }) });
    await expect(request({ data: { email: 'test@example.com', proof: 'bad-proof-value' } })).rejects.toThrow();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('returns the same result for unknown, rejected and linked studios without sending', async () => {
    for (const account of [null, { status: 'rejected', user_id: null }, { status: 'approved', user_id: 'linked' }]) {
      mocks.maybeSingle.mockResolvedValue({ data: account, error: null });
      expect(await request({ data: { email: 'test@example.com', proof: 'valid-proof-value' } })).toEqual({ ok: true });
    }
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('uses the saved approved email and same attempt identity on delivery retry', async () => {
    mocks.maybeSingle.mockResolvedValue({ data: { id: 'approved', email: 'saved@example.com', status: 'approved', user_id: null }, error: null });
    await request({ data: { email: 'test@example.com', proof: 'valid-proof-value' } });
    await request({ data: { email: 'test@example.com', proof: 'valid-proof-value' } });
    expect(mocks.invoke).toHaveBeenCalledWith('send-transactional-email', expect.objectContaining({ body: expect.objectContaining({ templateName: 'trade-approval', recipientEmail: 'saved@example.com' }) }));
    expect(mocks.invoke.mock.calls[0]).toEqual(mocks.invoke.mock.calls[1]);
  });
});