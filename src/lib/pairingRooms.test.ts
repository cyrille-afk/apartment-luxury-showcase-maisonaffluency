import { describe, expect, it } from 'vitest';
import { SUBCATEGORY_MAP } from './productTaxonomy';
import { pairingRoomKey, pairingRoomSlots, primaryPairingRoom } from './pairingRooms';
import { pairingCategory, selectCuratedPairings, type PairingProduct, type PairingRule } from './curatedPairings';

const piece = (title: string, category?: string, subcategory?: string): PairingProduct => ({ id: title, title, category, subcategory, brand: 'House', image: '/image.jpg', path: '/product' });
const rules = (source_category: string): PairingRule[] => ['tables', 'table-light', 'decor'].map((target_category, sort_order) => ({ id: String(sort_order), source_category, target_category, sort_order, enabled: true, preferred_pick_id: null }));
const catalogue = [piece('Armchair'), piece('Side Table'), piece('Floor Lamp'), piece('Rug'), piece('Dining Table'), piece('Dining Chair'), piece('Ceiling Pendant'), piece('Sideboard'), piece('Bed'), piece('Bedside Table'), piece('Table Lamp'), piece('Desk'), piece('Office Chair'), piece('Bookcase'), piece('Outdoor Table'), piece('Outdoor Chair'), piece('Outdoor Floor Lamp'), piece('Bathroom Mirror'), piece('Bathroom Stool'), piece('Bathroom Wall Light')];

describe('complete primary-room pairing coverage', () => {
  for (const [category, subcategories] of Object.entries(SUBCATEGORY_MAP)) {
    for (const subcategory of subcategories) {
      it(`${category} / ${subcategory} has functional room companions`, () => {
        const primary = piece('Untitled selection', category, subcategory);
        expect(pairingRoomKey(primary)).toBeTruthy();
        expect(primaryPairingRoom(primary)).toBeTruthy();
        expect(pairingRoomSlots(primary).filter(slot => slot.length).length).toBeGreaterThanOrEqual(2);
        const source = pairingCategory(primary);
        expect(source).not.toBeNull();
        expect(selectCuratedPairings(primary, catalogue, [], rules(source || '')) .length).toBeGreaterThanOrEqual(2);
      });
    }
  }
  it.each([
    ['Floor Lamp', 'living-room', ['Armchair', 'Side Table', 'Rug']],
    ['Table Lamp', 'bedroom', ['Bed', 'Bedside Table', 'Rug']],
    ['Rug', 'living-room', ['Armchair', 'Side Table', 'Floor Lamp']],
    ['Bed', 'bedroom', ['Bedside Table', 'Table Lamp', 'Rug']],
    ['Desk', 'office', ['Office Chair', 'Table Lamp', 'Bookcase']],
    ['Outdoor Floor Lamp', 'outdoor', ['Outdoor Table', 'Outdoor Chair']],
  ])('%s gets functional companions in %s', (title, room, expected) => {
    const primary = piece(title);
    expect(primaryPairingRoom(primary)).toBe(room);
    expect(selectCuratedPairings(primary, catalogue, [], rules(pairingCategory(primary) || '')).map(p => p.title)).toEqual(expected);
  });
  it('a desk accessory belongs to Office, never a living-room furniture fallback', () => {
    const primary = piece('Pen holder', 'Décor', 'Desk Accessories');
    expect(primaryPairingRoom(primary)).toBe('office');
    expect(selectCuratedPairings(primary, catalogue, [], rules('decor')).map(p => p.title)).toEqual(['Desk', 'Table Lamp', 'Bookcase']);
  });
  it('explicit bedroom rugs do not accompany living armchairs', () => {
    expect(selectCuratedPairings(piece('Armchair'), [piece('Bedroom Rug'), piece('Tray'), piece('Mirror')], [], rules('seating'))).toEqual([]);
  });
  it('canonical metadata wins over a misleading product name', () => {
    expect(pairingRoomKey(piece('Table Sculpture', 'Lighting', 'Floor Lights'))).toBe('floor-lights');
  });
  it('the first explicit slash placement defines the primary function', () => {
    expect(pairingRoomKey(piece('Dual purpose', 'Tables / Seating', 'Side Tables / Chairs'))).toBe('side-tables');
  });
});