import { describe, expect, it } from 'vitest';
import { matchesRoomShoppingFilters, roomFilterOptions, roomProductTypes } from './roomShoppingFilters';

const chair = { id: 'chair', title: 'Armchair', category: 'Seating', subcategory: 'Armchairs', materials: 'Oak and velvet' };
const table = { id: 'table', title: 'Coffee Table', category: 'Tables', subcategory: 'Coffee Tables', materials: 'Marble and brass' };
const finishes = { chair: ['Tobacco Oak', 'AVA Ecru'], table: ['Nero Marquina'] };
describe('room-specific product types and finishes', () => {
  it('type and finish intersect on the same piece', () => {
    expect(matchesRoomShoppingFilters(chair, { type: 'Armchairs', finish: 'Tobacco Oak' }, finishes)).toBe(true);
    expect(matchesRoomShoppingFilters(table, { type: 'Armchairs', finish: 'Nero Marquina' }, finishes)).toBe(false);
    expect(matchesRoomShoppingFilters(chair, { type: 'Armchairs', finish: 'Nero Marquina' }, finishes)).toBe(false);
  });
  it('finish filtering includes active published names and material families', () => {
    expect(matchesRoomShoppingFilters(chair, { type: null, finish: 'Wood' }, finishes)).toBe(true);
    expect(matchesRoomShoppingFilters(chair, { type: null, finish: 'Tobacco Oak' }, finishes)).toBe(true);
    expect(matchesRoomShoppingFilters(table, { type: null, finish: 'Tobacco Oak' }, finishes)).toBe(false);
  });
  it('finish options and counts narrow to the selected product type', () => {
    const options = roomFilterOptions([chair, table], { type: 'Armchairs', finish: null }, finishes);
    expect(options.finishes).toContainEqual({ label: 'Tobacco Oak', count: 1 });
    expect(options.finishes.some(o => o.label === 'Nero Marquina')).toBe(false);
  });
  it('product type options narrow to the chosen finish', () => {
    expect(roomFilterOptions([chair, table], { type: null, finish: 'Nero Marquina' }, finishes).types).toEqual([{ label: 'Coffee Tables', count: 1 }]);
  });
  it('dual-purpose pieces match either explicit placement', () => {
    const dual = { ...table, subcategory: 'Side Tables / Chairs' };
    expect(roomProductTypes(dual)).toEqual(['Side Tables', 'Chairs']);
    expect(matchesRoomShoppingFilters(dual, { type: 'Chairs', finish: null }, finishes)).toBe(true);
  });
  it('clearing both filters restores every piece without mutating finishes', () => {
    expect([chair, table].filter(p => matchesRoomShoppingFilters(p, { type: null, finish: null }, finishes))).toHaveLength(2);
    expect(finishes.chair).toEqual(['Tobacco Oak', 'AVA Ecru']);
  });
});