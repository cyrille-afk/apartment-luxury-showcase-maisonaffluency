// Shared "Shop By Room" preview scenes — consumed by the header mega-menu
// preview panel and the dedicated Room Experience landing page so both show
// the same vignette, hotspot, and curated alternatives.
import livingRoomHero from "@/assets/living-room-hero.jpg";
import officeHero from "@/assets/home-office-desk.jpg";
import diningRoomHero from "@/assets/intimate-dining.jpg";
import bedroomHero from "@/assets/master-suite.jpg";
import marbleCoffeeTable from "@/assets/curators-picks/adam-courts-void-table.jpg";
import sculpturalCoffeeTable from "@/assets/curators-picks/noe-mineral-flower-coffee-table.png";
import woodCoffeeTable from "@/assets/curators-picks/man-of-parts-coffee-table.png";

export interface RoomScenePiece {
  src: string;
  alt: string;
  name?: string;
  designer?: string;
  /** Public product page for this piece, when resolved against the catalog. */
  href?: string;
}

export interface RoomPreviewScene {
  previewImage: { src: string; alt: string };
  /** Percentage-based hotspot position (scales responsively). */
  hotspot: { left: number; top: number; label: string };
  /** Index into pieces that the hotspot highlights on interaction. */
  highlightIndex: number;
  pieces: RoomScenePiece[];
  /** True while the live catalog trio is still loading (hide static fallback). */
  pending?: boolean;
}

export const ROOM_PREVIEW_SCENES: Record<"living-room" | "dining-room" | "bedroom" | "office", RoomPreviewScene> = {
  "living-room": {
    previewImage: { src: livingRoomHero, alt: "Sculptural furniture in an architectural living room" },
    hotspot: { left: 53, top: 85, label: "Coffee table" },
    highlightIndex: 2, // marble alternative
    pieces: [
      { src: woodCoffeeTable, alt: "Wood coffee table alternative", name: "Praia Da Granja", designer: "Man of Parts" },
      { src: sculpturalCoffeeTable, alt: "Sculptural coffee table alternative", name: "Mineral Flower Coffee Table", designer: "Noé Duchaufour-Lawrance" },
      { src: marbleCoffeeTable, alt: "Marble coffee table alternative", name: "Void Table", designer: "OKHA by Adam Court" },
    ],
  },
  "bedroom": {
    previewImage: { src: bedroomHero, alt: "Calming bedroom with layered natural materials" },
    // Base of the illuminated lamp on the left nightstand (centre-cropped frame).
    hotspot: { left: 25, top: 75, label: "Table lamp" },
    highlightIndex: 0, // Volca Table Lamp
    pieces: [
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1782466723/Screenshot_2026-06-26_at_5.38.12_PM_u8u8dc.png", alt: "Volca Table Lamp by Sam Accoceberry", name: "Volca Table Lamp", designer: "Sam Accoceberry" },
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1779766884/Sorbet11_hhegzu.jpg", alt: "Sorbet Table Lamp by Humbert & Poyet", name: "Sorbet Table Lamp", designer: "Humbert & Poyet" },
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1777342452/PAUL_LASZLO_1950_Avondale_Lamp_01_A4_1_ke4j5k.jpg", alt: "Avondale Lamp c. 1950 by Paul László", name: "Avondale Lamp c. 1950", designer: "Paul László" },
    ],
  },
  "dining-room": {
    previewImage: { src: diningRoomHero, alt: "Marble dining table in a furnished dining room" },
    hotspot: { left: 60, top: 74, label: "Dining table" },
    highlightIndex: 0,
    pieces: [
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1775505999/Screen_Shot_2026-04-07_at_3.59.24_AM_umi5rh.png", alt: "Scala Dining Table by Pierre Augustin Rose", name: "Scala Dining Table", designer: "Pierre Augustin Rose" },
      { src: "https://images.ctfassets.net/zva6oxaf836f/1akflwIMKg5DLRHNIiXsBo/b5216c301cdbe53a5044bf6b7a2aa380/20250428_MAN_OF_PARTS_01_CAPTURE_0241.jpg", alt: "Via Bernina Oval dining table by Sebastian Herkner", name: "Via Bernina Oval", designer: "Sebastian Herkner" },
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1784094211/MA_Oval_table_cover_trxqs8.jpg", alt: "MA Oval Table by Victoria Magniant", name: "MA Oval Table", designer: "Victoria Magniant" },
    ],
  },
  office: {
    previewImage: { src: officeHero, alt: "Curated home office with collectible furnishings" },
    hotspot: { left: 43, top: 72, label: "Desk" },
    highlightIndex: 0, // Solare Desk
    pieces: [
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1787568568/maison%20affluency/curators-picks/Amelie%20Vermersch/sol-desk-02.jpg", alt: "Solare Desk by Amélie Vermersch", name: "Solare Desk", designer: "Amélie Vermersch" },
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1779896026/KalbB_5_pcc7b7.jpg", alt: "Kalb B Desk by Thierry Lemaire", name: "Kalb B Desk", designer: "Thierry Lemaire" },
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1776594006/Arbor-Desk_01_alexander-lamont_skrxig.jpg", alt: "Arbor Desk by Alexander Lamont", name: "Arbor Desk", designer: "Alexander Lamont" },
    ],
  },
};

/** Fallback scene for rooms without a dedicated curation yet. */
export const DEFAULT_ROOM_SCENE: RoomPreviewScene = {
  previewImage: ROOM_PREVIEW_SCENES["living-room"].previewImage,
  hotspot: { left: 55, top: 47, label: "Featured piece" },
  highlightIndex: 0,
  pieces: ROOM_PREVIEW_SCENES["living-room"].pieces,
};

export function getRoomPreviewScene(slug?: string | null): RoomPreviewScene {
  if (slug === "office") return ROOM_PREVIEW_SCENES.office;
  if (slug === "dining-room") return ROOM_PREVIEW_SCENES["dining-room"];
  if (slug === "living-room") return ROOM_PREVIEW_SCENES["living-room"];
  if (slug === "bedroom") return ROOM_PREVIEW_SCENES["bedroom"];
  return DEFAULT_ROOM_SCENE;
}
