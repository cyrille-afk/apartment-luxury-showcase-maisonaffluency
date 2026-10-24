import { describe, expect, it, vi } from 'vitest';
import { resolveSampleProductId } from './sampleRequestProduct';

const pick = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const trade = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
describe('sample request product linkage', () => {
  it('maps a curator pick to its Trade product foreign key', async () => {
    expect(await resolveSampleProductId(pick, async id => id === pick ? trade : null)).toBe(trade);
  });
  it('retains an existing Trade product ID', async () => {
    expect(await resolveSampleProductId(trade, async id => id)).toBe(trade);
  });
  it('keeps a photo-only request submitable without a foreign key', async () => {
    expect(await resolveSampleProductId(pick, async () => null)).toBeNull();
  });
  it('does not send editorial identifiers into a UUID column', async () => {
    const lookup = vi.fn();
    expect(await resolveSampleProductId('halabala-chair', lookup)).toBeNull();
    expect(lookup).not.toHaveBeenCalled();
  });
  it('preserves lookup failures rather than masking them as missing products', async () => {
    await expect(resolveSampleProductId(pick, async () => { throw new Error('Unavailable'); })).rejects.toThrow('Unavailable');
  });
});