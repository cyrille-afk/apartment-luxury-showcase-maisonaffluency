/**
 * Single source of truth for gallery image indices.
 *
 * These are the *flat* indices produced by `galleryExperiences.flatMap(s => s.items)`
 * in Gallery.tsx. When the gallery order changes, update this file and all
 * consumer components will stay in sync automatically.
 *
 * ── A Sociable Environment ─────────────────────────
 */
export const GALLERY = {
  /** 0 — A Sociable Environment */
  AN_INVITING_LOUNGE_AREA: 0,
  /** 1 — A Sociable Environment */
  A_SOPHISTICATED_LIVING_ROOM: 1,
  /** 2 — A Sociable Environment */
  PANORAMIC_CITYSCAPE_VIEWS: 2,
  /** 3 — A Sociable Environment */
  A_SUN_LIT_READING_CORNER: 3,

  /** 4 — An Intimate Setting */
  A_DREAMY_TUSCAN_LANDSCAPE: 4,
  /** 5 — An Intimate Setting */
  A_HIGHLY_CUSTOMISED_DINING_ROOM: 5,
  /** 6 — An Intimate Setting */
  A_RELAXED_SETTING: 6,
  /** 7 — An Intimate Setting */
  A_COLOURFUL_NOOK: 7,

  /** 8 — A Personal Sanctuary */
  A_SOPHISTICATED_BOUDOIR: 8,
  /** 9 — A Personal Sanctuary */
  A_JEWELRY_BOX_LIKE_SETTING: 9,
  /** 10 — A Personal Sanctuary */
  A_SERENE_DECOR: 10,
  /** 11 — A Personal Sanctuary */
  A_DESIGN_TREASURE_TROVE: 11,

  /** 12 — A Calming and Dreamy Environment */
  A_MASTERFUL_SUITE: 12,
  /** 13 — A Calming and Dreamy Environment */
  DESIGN_TABLEAU: 13,
  /** 14 — A Calming and Dreamy Environment */
  A_VENITIAN_COCOON: 14,
  /** 15 — A Calming and Dreamy Environment */
  UNIQUE_BY_DESIGN_VIGNETTE: 15,

  /** 16 — A Small Room with Massive Personality */
  AN_ARTISTIC_STATEMENT: 16,
  /** 17 — A Small Room with Massive Personality */
  COMPACT_ELEGANCE: 17,
  /** 18 — A Small Room with Massive Personality */
  YELLOW_CRYSTALLINE: 18,
  /** 19 — A Small Room with Massive Personality */
  GOLDEN_HOUR: 19,

  /** 20 — Home Office with a View */
  A_WORKSPACE_OF_DISTINCTION: 20,
  /** 21 — Home Office with a View */
  REFINED_DETAILS: 21,
  /** 22 — Home Office with a View */
  LIGHT_AND_FOCUS: 22,
  /** 23 — Home Office with a View */
  DESIGN_AND_FINE_ART_BOOKS_CORNER: 23,

  /** 24 — The Details Make the Design */
  CURATED_VIGNETTE: 24,
  /** 25 — The Details Make the Design */
  THE_DETAILS_MAKE_THE_DESIGN: 25,
  /** 26 — The Details Make the Design */
  LIGHT_AND_TEXTURE: 26,
  /** 27 — The Details Make the Design */
  CRAFTSMANSHIP_AT_EVERY_CORNER: 27,
} as const;

export type GalleryIndex = (typeof GALLERY)[keyof typeof GALLERY];
