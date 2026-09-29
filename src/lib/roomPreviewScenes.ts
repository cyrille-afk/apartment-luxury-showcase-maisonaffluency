// Shared "Shop By Room" preview scenes — consumed by the header mega-menu
// preview panel and the dedicated Room Experience landing page so both show
// the same vignette, hotspot, and curated alternatives.
import livingRoomHero from "@/assets/living-room-hero.jpg";
import homeOffice from "@/assets/home-office-desk.jpg";

export interface RoomScenePiece {
  src: string;
  alt: string;
  name?: string;
  designer?: string;
}

export interface RoomPreviewScene {
  image: string;
  /** Percentage-based hotspot position (scales responsively). */
  hotspot: { left: number; top: number };
  /** Index into pieces that the hotspot highlights on interaction. */
  highlightIndex: number;
  pieces: RoomScenePiece[];
}

export const ROOM_PREVIEW_SCENES: Record<string, RoomPreviewScene> = {
  "living-room": {
    image: livingRoomHero,
    hotspot: { left: 42, top: 87 }, // marble coffee table, center of scene
    highlightIndex: 1, // marble alternative
    pieces: [
      {
        src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1774939779/Agatha_Coffee_Table-1_mqy8xb.jpg",
        alt: "Agatha 05 Coffee Table",
        name: "Agatha 05 Coffee Table",
        designer: "Martin Massé",
      },
      {
        src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1783359886/new-clash-image-24-april-2_1200x1200_cqjt0i.jpg",
        alt: "Clash Coffee Table",
        name: "Clash Coffee Table",
        designer: "OKHA by Adam Court",
      },
      {
        src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1781883466/cover3_f6ekzf.jpg",
        alt: "Borghese Coffee Table",
        name: "Borghese Coffee Table",
        designer: "La Chance by Noé Duchaufour-Lawrance",
      },
    ],
  },
  office: {
    image: homeOffice,
    hotspot: { left: 43, top: 72 }, // main desk
    highlightIndex: 1, // Apartment Desk
    pieces: [
      {
        src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1777650189/lyric-desk-oak_bqbd6i.jpg",
        alt: "Lyric Desk Oak",
        name: "Lyric Desk Oak",
        designer: "Atelier BdM",
      },
      {
        src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1777650901/apartment-desk-jean-michel-frank_n4vqka.jpg",
        alt: "Apartment Desk c. 1925",
        name: "Apartment Desk c. 1925",
        designer: "Jean-Michel Frank",
      },
      {
        src: "https://res.cloudinary.com/dif1oamtj/image/upload/v1777651227/officium-desk-pierre-augustin-rose_y7zpyz.jpg",
        alt: "Officium Desk",
        name: "Officium Desk",
        designer: "Pierre Augustin Rose",
      },
    ],
  },
};

/** Fallback scene for rooms without a dedicated curation yet. */
export const DEFAULT_ROOM_SCENE: RoomPreviewScene = ROOM_PREVIEW_SCENES["living-room"];
