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
});