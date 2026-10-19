import { inferSubcategory, normalizeSubcategory } from './productTaxonomy';
import { roomMaterialCategories } from './roomMaterialCategories';

export type RoomFilterPiece = { id: string; title: string; category?: string | null; subcategory?: string | null; materials?: string | null };
export type RoomShoppingFilters = { type: string | null; finish: string | null };
export type RoomFinishMap = Record<string, string[]>;

export function roomProductTypes(piece: RoomFilterPiece): string[] {
  const placements = piece.subcategory?.split('/').map(value => normalizeSubcategory(value.trim())).filter((value): value is string => Boolean(value));
  return placements?.length ? [...new Set(placements)] : [inferSubcategory(piece.category || undefined, undefined, piece.title)];
}
export function roomProductFinishes(piece: RoomFilterPiece, finishes: RoomFinishMap): string[] {
  return [...new Set([...roomMaterialCategories(piece.materials, piece.title), ...(finishes[piece.id] || [])])];
}
export function matchesRoomShoppingFilters(piece: RoomFilterPiece, filters: RoomShoppingFilters, finishes: RoomFinishMap): boolean {
  return (!filters.type || roomProductTypes(piece).includes(filters.type)) && (!filters.finish || roomProductFinishes(piece, finishes).includes(filters.finish));
}
export function roomFilterOptions(pieces: RoomFilterPiece[], filters: RoomShoppingFilters, finishes: RoomFinishMap) {
  const counts = (key: 'type' | 'finish') => {
    const map = new Map<string, number>();
    for (const piece of pieces) {
      if (!matchesRoomShoppingFilters(piece, { ...filters, [key]: null }, finishes)) continue;
      for (const label of key === 'type' ? roomProductTypes(piece) : roomProductFinishes(piece, finishes)) map.set(label, (map.get(label) || 0) + 1);
    }
    return [...map].sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' })).map(([label, count]) => ({ label, count }));
  };
  return { types: counts('type'), finishes: counts('finish') };
}