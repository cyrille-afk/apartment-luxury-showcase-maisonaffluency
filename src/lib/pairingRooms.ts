import { inferSubcategory } from './productTaxonomy';
import { ROOM_MAP, type RoomSlug } from './roomCategories';

type RoomPiece = { title: string; category?: string | null; subcategory?: string | null };
/** Every canonical department has a functional key, including accessories. */
const roomKeys: Record<string, string> = {
  Sofas: 'sofas', Armchairs: 'armchairs', Chairs: 'chairs', 'Coffee Tables': 'coffee-tables',
  Consoles: 'consoles', 'Side Tables': 'side-tables', 'Dining Tables': 'dining-tables', Desks: 'desks',
  'Daybeds & Benches': 'daybeds', 'Ottomans & Stools': 'stools', Beds: 'beds',
  Bedding: 'bedding', 'Sofa-Beds': 'sofa-beds', 'Bedside Tables': 'nightstands',
  'Floor Lights': 'floor-lights', 'Table Lights': 'table-lights', 'Ceiling Lights': 'ceiling-lights',
  'Wall Lights': 'wall-lights', Bookcases: 'bookcases', Bars: 'bars',
  'Buffets, Cabinets And Sideboards': 'credenzas',
  'Hand-Knotted Rugs': 'rugs', 'Hand-Tufted Rugs': 'rugs', 'Hand-Woven Rugs': 'rugs',
  Books: 'books', Boxes: 'boxes', 'Candle Holders': 'candle-holders',
  'Cushions & Throws': 'cushions-throws', 'Decorative Objects': 'decorative-objects',
  'Desk Accessories': 'desk-accessories', 'Folding Screens & Window Décor': 'screens',
  'Magazine Holders': 'magazine-holders', Mirrors: 'mirrors',
  'Tableware & Linens': 'tableware', 'Trays & Change Trays': 'trays',
  'Vases & Vessels': 'vases', 'Wall Décor': 'wall-decor',
};

export function explicitPairingRoom(piece: RoomPiece): RoomSlug | null {
  const text = `${piece.category || ''} ${piece.subcategory || ''} ${piece.title}`;
  if (/\b(outdoor|garden|terrace|patio)\b/i.test(text)) return 'outdoor';
  if (/\b(bathroom|bath|vanity)\b/i.test(text)) return 'bath';
  if (/\b(bedroom|bedside|bedding|nightstand|headboard)\b/i.test(text)) return 'bedroom';
  if (/\b(office|desk|study)\b/i.test(text)) return 'office';
  if (/\b(dining|bar stool|counter stool|tableware)\b/i.test(text)) return 'dining-room';
  if (/\b(living room|lounge)\b/i.test(text)) return 'living-room';
  return null;
}

export function pairingRoomKey(piece: RoomPiece): string {
  const sub = inferSubcategory(piece.category || undefined, piece.subcategory || undefined, piece.title);
  const key = roomKeys[sub] || 'decorative-objects';
  const text = `${piece.subcategory || ''} ${piece.title}`;
  if (explicitPairingRoom(piece) === 'outdoor') {
    if (['sofas', 'armchairs', 'chairs', 'stools', 'daybeds'].includes(key)) return 'outdoor-seating';
    if (['coffee-tables', 'side-tables', 'dining-tables', 'consoles'].includes(key)) return 'outdoor-tables';
    if (key.endsWith('-lights')) return 'outdoor-lights';
  }
  if (/\b(office|desk) chair\b/i.test(text)) return 'office-chairs';
  if (/\b(bar|counter) stool\b/i.test(text)) return 'bar-stools';
  return key;
}

export function primaryPairingRoom(piece: RoomPiece): RoomSlug {
  const explicit = explicitPairingRoom(piece);
  if (explicit) return explicit;
  const key = pairingRoomKey(piece);
  if (['beds', 'nightstands', 'bedding', 'sofa-beds', 'table-lights'].includes(key)) return 'bedroom';
  if (['desks', 'office-chairs', 'bookcases', 'books', 'desk-accessories'].includes(key)) return 'office';
  if (['dining-tables', 'chairs', 'bar-stools', 'bars', 'tableware', 'candle-holders', 'ceiling-lights'].includes(key)) return 'dining-room';
  return 'living-room';
}

/** Accessories lead back to their supporting furniture, never arbitrary decor. */
export function pairingRoomSlots(piece: RoomPiece): string[][] {
  const room = primaryPairingRoom(piece);
  const key = pairingRoomKey(piece);
  const slots: Partial<Record<RoomSlug, string[][]>> = {
    'living-room': ['coffee-tables', 'side-tables', 'consoles', 'rugs', 'floor-lights', 'wall-lights', 'credenzas'].includes(key)
      ? [['armchairs', 'sofas'], ['side-tables', 'coffee-tables', 'floor-lights'], ['rugs', 'floor-lights', 'credenzas']]
      : [['side-tables', 'coffee-tables', 'consoles'], ['floor-lights', 'table-lights'], ['rugs', 'sofas', 'credenzas']],
    'dining-room': [['dining-tables', 'chairs'], ['ceiling-lights', 'credenzas'], ['rugs', 'credenzas', 'chairs']],
    bedroom: [['beds', 'nightstands'], ['table-lights', 'nightstands'], ['rugs', 'armchairs', 'daybeds']],
    office: [['desks', 'office-chairs'], ['table-lights', 'floor-lights'], ['bookcases', 'credenzas', 'office-chairs']],
    outdoor: [['outdoor-tables', 'outdoor-seating'], ['outdoor-lights', 'outdoor-seating']],
    bath: [['mirrors', 'stools'], ['wall-lights', 'bathroom-lights'], ['stools', 'mirrors']],
  };
  // A table needs seating, a bed needs a bedside table, and a desk needs a chair.
  if (room === 'dining-room' && key === 'dining-tables') slots[room] = [['chairs', 'bar-stools'], ['ceiling-lights'], ['rugs', 'credenzas']];
  if (room === 'bedroom' && key === 'beds') slots[room] = [['nightstands'], ['table-lights'], ['rugs', 'armchairs']];
  if (room === 'office' && key === 'desks') slots[room] = [['office-chairs'], ['table-lights', 'floor-lights'], ['bookcases', 'credenzas']];
  if (room === 'outdoor' && key === 'outdoor-tables') slots[room] = [['outdoor-seating'], ['outdoor-lights']];
  const departments: readonly string[] = ROOM_MAP[room];
  return (slots[room] || []).map(slot => slot.filter(value => value !== key && departments.includes(value)));
}

export function pairingFitsRoom(candidate: RoomPiece, primary: RoomPiece): boolean {
  const explicit = explicitPairingRoom(candidate);
  return !explicit || explicit === primaryPairingRoom(primary);
}
