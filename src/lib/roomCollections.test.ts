import { describe, expect, it } from 'vitest';
import { isCollectionRoom, roomCollectionPath } from './roomCollections';

describe('dedicated room collection destinations', () => {
  it('accepts the five shopping rooms and rejects unknown collection paths', () => {
    for (const room of ['living-room', 'dining-room', 'bedroom', 'office', 'outdoor']) expect(isCollectionRoom(room)).toBe(true);
    expect(isCollectionRoom('not-a-room')).toBe(false);
    expect(isCollectionRoom(undefined)).toBe(false);
  });
  it('keeps Trade collection navigation inside Trade', () => {
    expect(roomCollectionPath('living-room')).toBe('/shop-by-room/living-room');
    expect(roomCollectionPath('dining-room', true)).toBe('/trade/shop-by-room/dining-room');
  });
});