// Shared "Shop By Room" preview scenes — consumed by the header mega-menu
// preview panel and the dedicated Room Experience landing page so both show
// the same vignette, hotspot, and curated alternatives.
import livingRoomHero from "@/assets/living-room-hero.jpg";
import officeHero from "@/assets/home-office-desk.jpg";
import marbleCoffeeTable from "@/assets/curators-picks/adam-courts-void-table.jpg";
import sculpturalCoffeeTable from "@/assets/curators-picks/noe-mineral-flower-coffee-table.png";
import woodCoffeeTable from "@/assets/curators-picks/man-of-parts-coffee-table.png";

export interface RoomScenePiece {
  src: string;
  alt: string;
  name?: string;
  designer?: string;
}

export interface RoomPreviewScene {
  previewImage: { src: string; alt: string };
  /** Percentage-based hotspot position (scales responsively). */
  hotspot: { left: number; top: number; label: string };
  /** Index into pieces that the hotspot highlights on interaction. */
  highlightIndex: number;
  pieces: RoomScenePiece[];
}

export const ROOM_PREVIEW_SCENES: Record<"living-room" | "office", RoomPreviewScene> = {
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
  office: {
    previewImage: { src: officeHero, alt: "Curated home office with collectible furnishings" },
    hotspot: { left: 43, top: 72, label: "Desk" },
    highlightIndex: 1, // Apartment Desk
    pieces: [
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1780550235/Lyrique_Black-1_ozsq0k.jpg", alt: "Lyric Desk Oak by Atelier BdM", name: "Lyric Desk Oak", designer: "Atelier BdM" },
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1777428196/JMF_1932_Apartment_Desk__02_Portrait_BD_1_jhvb5g.jpg", alt: "Apartment Desk c. 1925 by Jean-Michel Frank", name: "Apartment Desk c. 1925", designer: "Jean-Michel Frank" },
      { src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1775507497/Screen_Shot_2026-04-07_at_4.29.53_AM_spljjl.png", alt: "Officium Desk by Pierre Augustin Rose", name: "Officium Desk", designer: "Pierre Augustin Rose" },
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
  if (slug === "living-room") return ROOM_PREVIEW_SCENES["living-room"];
  return DEFAULT_ROOM_SCENE;
}
