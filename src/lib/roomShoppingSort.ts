import { convertCentsWithFallback, FALLBACK_RATES } from './fxRates';

export const ROOM_SORT_OPTIONS = [
  { value: 'curated', label: 'Curated order' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'name-asc', label: 'Product name: A–Z' },
  { value: 'name-desc', label: 'Product name: Z–A' },
  { value: 'newest', label: 'Newest items' },
] as const;
export type RoomSort = typeof ROOM_SORT_OPTIONS[number]['value'];
export function resolveRoomSort(value: string | null): RoomSort {
  return ROOM_SORT_OPTIONS.find(option => option.value === value)?.value || 'curated';
}
export function roomPriceCents(cents: number | null | undefined, currency: string | null | undefined, target = 'EUR', rates: Record<string, number> = FALLBACK_RATES): number | null {
  if (!cents || !Number.isFinite(cents) || cents <= 0) return null;
  return convertCentsWithFallback(cents, (currency || 'EUR').toUpperCase(), target.toUpperCase(), rates);
}
type SortDetails = { name: string; createdAt?: string | null; priceCents?: number | null };
export function sortRoomProducts<T>(pieces: T[], sort: RoomSort, details: (piece: T) => SortDetails): T[] {
  if (sort === 'curated') return pieces;
  return pieces.map((piece, index) => ({ piece, index, ...details(piece) })).sort((a, b) => {
    const nameOrder = a.name.localeCompare(b.name, 'en', { sensitivity: 'base', numeric: true });
    if (sort === 'name-asc' || sort === 'name-desc') return (sort === 'name-asc' ? nameOrder : -nameOrder) || a.index - b.index;
    const value = (item: typeof a) => sort === 'newest'
      ? (item.createdAt ? Date.parse(item.createdAt) : NaN)
      : (item.priceCents && item.priceCents > 0 ? item.priceCents : NaN);
    const av = value(a), bv = value(b);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) {
      if (Number.isFinite(av)) return -1;
      if (Number.isFinite(bv)) return 1;
      return nameOrder || a.index - b.index;
    }
    return (sort === 'price-asc' ? av - bv : bv - av) || nameOrder || a.index - b.index;
  }).map(item => item.piece);
}