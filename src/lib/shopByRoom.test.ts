import { describe, expect, it } from 'vitest';
import { roomAnchors, roomShoppingPairings, roomShoppingProducts } from './shopByRoom';
import type { PairingProduct, PairingRule } from './curatedPairings';
const piece = (id: string, title: string): PairingProduct => ({ id, title, brand: 'House', image: '/image.jpg', path: `/designers/house/${id}` });
const chair = piece('chair', 'Living Armchair');
const coffee = piece('coffee', 'Coffee Table');
const pool = [chair, coffee, piece('side', 'Side Table'), piece('floor', 'Floor Lamp'), piece('rug', 'Hand-Knotted Rug'), piece('tray', 'Tray'), piece('mirror', 'Mirror'), piece('dining', 'Dining Table'), piece('bed', 'Bed'), piece('outdoor', 'Outdoor Armchair')];
const rules = (source_category: string): PairingRule[] => ['tables', 'table-light', 'decor'].map((target_category, sort_order) => ({ id: `${source_category}${sort_order}`, source_category, target_category, sort_order, enabled: true, preferred_pick_id: null }));
describe('shop by room', () => {
  it('Living includes furniture and lighting, not trays, mirrors, beds or outdoor chairs', () => {
    expect(roomShoppingProducts(pool, 'living-room').map(p => p.id)).toEqual(['chair', 'coffee', 'side', 'floor', 'rug']);
  });
  it('Dining anchors include dining tables, not living armchairs', () => {
    expect(roomAnchors(pool, 'dining-room').map(p => p.id)).toEqual(['dining']);
  });
  it('changing the starting purchase replaces living companions', () => {
    expect(roomShoppingPairings(chair, pool, 'living-room', [], rules('seating')).map(p => p.id)).toEqual(['side', 'floor', 'rug']);
    expect(roomShoppingPairings(coffee, pool, 'living-room', [], rules('tables')).map(p => p.id)).toEqual(['chair', 'floor', 'rug']);
  });
  it('configured basket pieces are excluded from recommendations', () => {
    expect(roomShoppingPairings(coffee, pool, 'living-room', ['chair'], rules('tables')).map(p => p.id)).toEqual(['floor', 'rug']);
  });
});