import type { PairingProduct, PairingRule } from './curatedPairings';
import { selectCuratedPairings } from './curatedPairings';
import { pairingRoomKey, primaryPairingRoom } from './pairingRooms';
import { ROOM_MAP, type RoomSlug } from './roomCategories';

export function roomShoppingProducts(products: PairingProduct[], room: RoomSlug) {
  const departments: readonly string[] = ROOM_MAP[room];
  return products.filter(piece => departments.includes(pairingRoomKey(piece) || ''));
}

export function roomAnchors(products: PairingProduct[], room: RoomSlug) {
  return roomShoppingProducts(products, room).filter(piece => primaryPairingRoom(piece) === room);
}

export function roomShoppingPairings(primary: PairingProduct, products: PairingProduct[], room: RoomSlug, excluded: string[], rules: PairingRule[]) {
  return selectCuratedPairings(primary, roomShoppingProducts(products, room), excluded, rules);
}