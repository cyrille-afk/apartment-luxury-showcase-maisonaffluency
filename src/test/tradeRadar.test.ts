import { afterEach, describe, expect, it, vi } from 'vitest';
import { scoreTradeApplication, unverifiedPortfolioUpdate } from '../../supabase/functions/_shared/tradeRadar';

const input = { studio: 'Integrha Pratama Artistry', email: 'integrha@yahoo.com', websiteOrIg: 'integrhaartistry', regNumber: '', hasDocument: false, returning: false };
afterEach(() => vi.unstubAllGlobals());

describe('Instagram scoring evidence', () => {
  it('assigns no score without portfolio evidence and does not call AI', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await scoreTradeApplication(input)).toMatchObject({ ok: true, score: null });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('marks an inaccessible, never-verified portfolio unverified instead of low priority', () => {
    expect(unverifiedPortfolioUpdate(false)).toMatchObject({ radar_score: null, radar_status: 'unverified' });
  });
  it('preserves an existing evidence-backed score when a later retrieval fails', () => {
    const existing = { radar_score: 92, radar_status: 'scored' };
    expect({ ...existing, ...unverifiedPortfolioUpdate(true) }).toEqual(existing);
  });
  it('a retry that gains portfolio evidence produces a real score', async () => {
    const body = new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"type":"response.output_text.delta","delta":"{\\"confidence\\":88,\\"flag\\":\\"Built villas across three countries.\\"}"}\ndata: [DONE]\n'));
        c.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body }));
    const result = await scoreTradeApplication({ ...input, evidence: 'Portfolio: named built projects.' });
    expect(result).toMatchObject({ ok: true, score: 88 });
  });
  it('a retry while access is still blocked stays unverified and never calls AI', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    expect(await scoreTradeApplication(input)).toMatchObject({ ok: true, score: null });
    expect(fetch).not.toHaveBeenCalled();
  });
});