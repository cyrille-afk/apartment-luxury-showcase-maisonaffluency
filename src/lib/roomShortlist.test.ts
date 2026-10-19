import { describe, expect, it } from 'vitest';
import { roomShortlistDraftKey, shortlistItems, toggleShortlistItem } from './roomShortlist';
const item = { id: 'chair', product_name: 'Chair', brand_name: 'Maker', image_url: null };
describe('room collection shortlists', () => {
  it('keeps each room selection independent', () => {
    expect(roomShortlistDraftKey('living-room', 'owner')).not.toBe(roomShortlistDraftKey('dining-room', 'owner'));
  });
  it('keeps account drafts separate from guests and other accounts', () => {
    expect(new Set([roomShortlistDraftKey('bedroom'), roomShortlistDraftKey('bedroom', 'a'), roomShortlistDraftKey('bedroom', 'b')]).size).toBe(3);
  });
  it('adds and removes the same piece without duplicate entries', () => {
    expect(toggleShortlistItem([], item)).toEqual([item]);
    expect(toggleShortlistItem([item], item)).toEqual([]);
    expect(shortlistItems([item, item])).toEqual([item]);
  });
  it('strips prices and other private fields from saved and shared products', () => {
    expect(shortlistItems([{ ...item, trade_price_cents: 12345, net: 9000, user_id: 'secret' }])).toEqual([item]);
  });
  it('rejects damaged stored selections', () => { expect(shortlistItems([{ id: 'broken' }])).toEqual([]); });
});