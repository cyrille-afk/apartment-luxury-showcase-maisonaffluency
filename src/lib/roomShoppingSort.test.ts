import { describe, expect, it } from 'vitest';
import { resolveRoomSort, roomPriceCents, sortRoomProducts } from './roomShoppingSort';

const pieces = [
  { name: 'Zebra Chair', priceCents: 30000, createdAt: '2026-10-01T00:00:00Z' },
  { name: 'Álpha Chair', priceCents: 10000, createdAt: '2026-10-19T00:00:00Z' },
  { name: 'Beta Chair', priceCents: null, createdAt: null },
];
const names = (sort: Parameters<typeof sortRoomProducts>[1]) => sortRoomProducts(pieces, sort, p => p).map(p => p.name);
describe('room sorting', () => {
  it('sorts price ascending, keeping price-on-request pieces last', () => expect(names('price-asc')).toEqual(['Álpha Chair', 'Zebra Chair', 'Beta Chair']));
  it('sorts price descending, keeping price-on-request pieces last', () => expect(names('price-desc')).toEqual(['Zebra Chair', 'Álpha Chair', 'Beta Chair']));
  it('sorts names A–Z without treating accents as separate letters', () => expect(names('name-asc')).toEqual(['Álpha Chair', 'Beta Chair', 'Zebra Chair']));
  it('sorts names Z–A', () => expect(names('name-desc')).toEqual(['Zebra Chair', 'Beta Chair', 'Álpha Chair']));
  it('uses creation date, newest first, with undated items last', () => expect(names('newest')).toEqual(['Álpha Chair', 'Zebra Chair', 'Beta Chair']));
  it('preserves curated order and does not mutate source items', () => {
    expect(sortRoomProducts(pieces, 'curated', p => p)).toBe(pieces);
    names('name-asc');
    expect(pieces[0].name).toBe('Zebra Chair');
  });
  it('normalizes different currencies before comparing and leaves undisclosed prices unknown', () => {
    expect(roomPriceCents(10000, 'EUR')).toBe(10000);
    expect(roomPriceCents(10000, 'USD')).toBeLessThan(10000);
    expect(roomPriceCents(null, 'EUR')).toBeNull();
    expect(roomPriceCents(0, 'EUR')).toBeNull();
  });
  it('falls back safely for invalid URL values', () => {
    expect(resolveRoomSort('newest')).toBe('newest');
    expect(resolveRoomSort('invalid')).toBe('curated');
  });
});