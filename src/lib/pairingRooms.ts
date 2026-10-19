import { inferSubcategory } from "./productTaxonomy";
import { ROOM_MAP, type RoomSlug } from "./roomCategories";

type RoomPiece = { title: string; category?: string | null; subcategory?: string | null };
const roomKeys: Record<string, string> = {
  Sofas: "sofas", Armchairs: "armchairs", Chairs: "chairs", "Coffee Tables": "coffee-tables",
  "Side Tables": "side-tables", "Dining Tables": "dining-tables", Desks: "desks",
  "Daybeds & Benches": "daybeds", Beds: "beds", "Bedside Tables": "nightstands",
  "Floor Lights": "floor-lights", "Table Lights": "table-lights", "Ceiling Lights": "ceiling-lights",
  "Wall Lights": "wall-lights", Bookcases: "bookcases", "Buffets, Cabinets And Sideboards": "credenzas",
  "Hand-Knotted Rugs": "rugs", "Hand-Tufted Rugs": "rugs", "Hand-Woven Rugs": "rugs",
};
export function pairingRoomKey(piece: RoomPiece): string | undefined {
  const text = `${piece.subcategory || ""} ${piece.title}`;
  if (/outdoor|garden|terrace/i.test(text)) {
    if (/chair|sofa|seating|bench/i.test(text)) return "outdoor-seating";
    if (/table/i.test(text)) return "outdoor-tables";
    if (/lamp|light/i.test(text)) return "outdoor-lights";
  }
  if (/office chair|desk chair/i.test(text)) return "office-chairs";
  return roomKeys[inferSubcategory(piece.category || undefined, piece.subcategory || undefined, piece.title)];
}
export function primaryPairingRoom(piece: RoomPiece): RoomSlug | null {
  const key = pairingRoomKey(piece);
  if (!key) return null;
  if (key.startsWith("outdoor-")) return "outdoor";
  if (["beds", "nightstands"].includes(key)) return "bedroom";
  if (["desks", "office-chairs", "bookcases"].includes(key)) return "office";
  if (["dining-tables", "chairs"].includes(key)) return "dining-room";
  if (["sofas", "armchairs", "coffee-tables", "side-tables", "daybeds", "credenzas"].includes(key)) return "living-room";
  return null;
}
/** Functional companions, constrained by the same departments as Shop by Room. */
export function pairingRoomSlots(piece: RoomPiece): string[][] | null {
  const room = primaryPairingRoom(piece);
  if (!room) return null;
  const key = pairingRoomKey(piece);
  const slots: Record<string, string[][]> = {
    "living-room": key === "coffee-tables" || key === "side-tables"
      ? [["armchairs", "sofas"], ["floor-lights", "table-lights"], ["rugs"]]
      : [["side-tables", "coffee-tables"], ["floor-lights", "table-lights"], ["rugs", "sofas", "credenzas"]],
    "dining-room": [[key === "dining-tables" ? "chairs" : "dining-tables"], ["ceiling-lights"], ["rugs", "credenzas"]],
    bedroom: [[key === "beds" ? "nightstands" : "beds"], ["table-lights"], ["rugs", "armchairs"]],
    office: [[key === "desks" ? "office-chairs" : "desks"], ["table-lights", "floor-lights"], ["bookcases", "credenzas"]],
    outdoor: [[key === "outdoor-tables" ? "outdoor-seating" : "outdoor-tables"], ["outdoor-lights"]],
  };
  const departments: readonly string[] = ROOM_MAP[room];
  return slots[room]?.map((slot) => slot.filter((value) => value !== key && departments.includes(value))) || null;
}