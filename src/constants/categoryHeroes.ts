// Category & subcategory hero thumbnails + summaries shown at the top of the
// Designers directory when a filter is active. Defaults are placeholders the
// admin can adjust later — pick the most representative image per group.

export interface CategoryHero {
  title: string;
  image: string;
  summary: string;
}

const cld = (id: string) =>
  `https://res.cloudinary.com/dif1oamtj/image/upload/w_640,q_auto,f_auto,c_fill/${id}`;

// Keyed by subcategory or category label (case-sensitive, matches taxonomy).
export const CATEGORY_HEROES: Record<string, CategoryHero> = {
  // ── Seating ────────────────────────────────────────────────
  Armchairs: {
    title: "Armchairs",
    image: cld("v1774842686/IMG_2133-resized_urlgal.jpg"),
    summary:
      "Imagine yourself at home, sinking into your favourite armchair. A traditional wing, a sculptural statement, clean geometric lines or generous puffy curves — visible legs or floating volumes, velvet, bouclé, or leather. Maison Affluency presents a curated selection of armchairs whose timeless silhouettes lend each piece a collectible quality.",
  },
  Sofas: {
    title: "Sofas",
    image: cld("v1772085716/bespoke-sofa_gxidtx.jpg"),
    summary:
      "The defining gesture of any living room. From low-slung modular landscapes to refined classical seats, our sofas are made by ateliers who treat upholstery as architecture — frames hand-built, cushions hand-filled, fabrics chosen for the long view.",
  },
  Chairs: {
    title: "Chairs",
    image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg",
    summary:
      "Dining chairs, side chairs, lounge chairs — small in scale, vast in influence. Each piece in this selection is a study in proportion and posture by designers who understand that a great chair quietly carries the room.",
  },
  Stools: {
    title: "Stools & Benches",
    image: cld("v1772085686/bedroom-alt_yk0j0d.jpg"),
    summary:
      "Sculptural punctuation — at the bar, at the foot of the bed, against a console. Editions in solid wood, cast bronze, hand-stitched leather, and lacquered finishes from ateliers who treat the stool as a small monument.",
  },
  "Ottomans & Stools": {
    title: "Ottomans & Stools",
    image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1774339681/AffluencySG_191_3_1_r0dard.jpg",
    summary:
      "Sculptural punctuation — at the bar, at the foot of the bed, against a console. Editions in solid wood, cast bronze, hand-stitched leather, and lacquered finishes from ateliers who treat the ottoman and stool as small monuments.",
  },
  "Bar Stools": {
    title: "Bar Stools",
    image: "https://res.cloudinary.com/dif1oamtj/image/upload/v1772085907/small-room-chair_aobzyb.jpg",
    summary:
      "Counter-height seating with the same gravitas as the room itself. Sculpted backs, swivel mechanisms, hand-stitched leathers and rare timbers — bar stools that anchor the kitchen island or the private bar with quiet confidence.",
  },

  // ── Tables ─────────────────────────────────────────────────
  Tables: {
    title: "Tables",
    image: cld("v1772085743/dining-room_ey0bu5.jpg"),
    summary:
      "Dining, console, coffee, side. The tables we present are anchors of the room — slabs of rare stone, hand-shaped solid wood, patinated metals — built by makers whose joinery and finish belong to a different century.",
  },
  "Coffee Tables": {
    title: "Coffee Tables",
    image: cld("v1772085856/intimate-lounge_tf4sm1.jpg"),
    summary:
      "Low, sculptural and central — the coffee table sets the tone of the seating arrangement. From monolithic stone slabs to delicate metalwork, each piece in our edit is collectible by intent.",
  },
  "Dining Tables": {
    title: "Dining Tables",
    image: cld("v1772085743/dining-room_ey0bu5.jpg"),
    summary:
      "The room's gathering point. Solid timbers, single-slab marbles, bronze pedestals — dining tables conceived as long-term commitments by ateliers who specialise in pieces meant to be inherited.",
  },

  // ── Lighting ───────────────────────────────────────────────
  Lighting: {
    title: "Lighting",
    image: cld("v1773652807/details-console_hk6uxt.jpg"),
    summary:
      "Light shapes a space before any other element. Pendants, sconces, table and floor lamps — each fixture in this selection is conceived as a luminous object first, designed by makers who treat light as material.",
  },
  "Table Lights": {
    title: "Table Lights",
    image: cld("v1773652807/details-console_hk6uxt.jpg"),
    summary:
      "Intimate, sculptural, and quietly indispensable. Table lamps in alabaster, blown glass, ceramic and patinated bronze — small editions from designers who treat the bedside, the console, the desk as stage.",
  },
  "Floor Lights": {
    title: "Floor Lights",
    image: cld("v1772085919/small-room-personality_wvxz6y.png"),
    summary:
      "Architectural in stance, generous in glow — floor lamps that define corners and shape circulation. Plaster, brass, hand-blown shades and tactile textiles, by ateliers who design light as furniture.",
  },
  "Wall Lights": {
    title: "Wall Lights",
    image: cld("v1772085690/bedroom-second_cyfmdj.jpg"),
    summary:
      "Sconces and appliques to wash a wall, frame a doorway, or punctuate a hallway. Editions in plaster, alabaster, bronze and parchment from designers whose work belongs to the long tradition of the décorateur.",
  },
  Pendants: {
    title: "Pendants & Chandeliers",
    image: cld("v1772085533/art-master-bronze_hf6bad.jpg"),
    summary:
      "Suspended sculpture. From restrained single pendants to ceremonial chandeliers, each piece is conceived as the centrepiece of the volume it inhabits.",
  },

  // ── Storage ────────────────────────────────────────────────
  Storage: {
    title: "Cabinets & Storage",
    image: cld("v1772085686/bedroom-alt_yk0j0d.jpg"),
    summary:
      "Cabinets, sideboards, consoles and chests — pieces of furniture that function as architecture. Marquetry, lacquer, parchment, straw and shagreen, by ateliers whose métier is the long, slow art of cabinetmaking.",
  },
  Cabinets: {
    title: "Cabinets",
    image: cld("v1772085686/bedroom-alt_yk0j0d.jpg"),
    summary:
      "Stand-alone, freestanding presence. Cabinets in marquetry, lacquer, parchment and metalwork — pieces that carry a room on their own.",
  },
  Consoles: {
    title: "Consoles",
    image: cld("v1773652807/details-console_hk6uxt.jpg"),
    summary:
      "Long, narrow and full of intent — the console anchors an entry, lines a hallway, or frames a sofa from behind. Sculptural bases and rare tops by makers attentive to the smallest profile.",
  },

  // ── Rugs & Textiles ────────────────────────────────────────
  Rugs: {
    title: "Rugs & Carpets",
    image: cld("v1772085856/intimate-lounge_tf4sm1.jpg"),
    summary:
      "Hand-knotted, hand-tufted, naturally dyed — rugs that ground a scheme and dictate its temperature. Editions by weavers and designers who treat the floor as the most important surface in the room.",
  },
  Textiles: {
    title: "Textiles",
    image: cld("v1772085856/intimate-lounge_tf4sm1.jpg"),
    summary:
      "Cushions, throws, and editioned fabrics — the soft layer that finishes a room. Hand-woven, embroidered and naturally dyed by ateliers whose textile heritage runs generations deep.",
  },

  // ── Accessories & Objects ──────────────────────────────────
  Accessories: {
    title: "Decorative Objects",
    image: cld("v1772085533/art-master-bronze_hf6bad.jpg"),
    summary:
      "The pieces that finish a room — sculptural vessels, hand-thrown ceramics, cast bronze, blown glass. Small editions by designers and makers who treat the object as the gesture that gives a space its voice.",
  },
  Objects: {
    title: "Decorative Objects",
    image: cld("v1772085533/art-master-bronze_hf6bad.jpg"),
    summary:
      "Hand-thrown ceramics, blown glass, cast bronze and turned wood — collectible objects that bring intimacy and authorship to a finished interior.",
  },
  Mirrors: {
    title: "Mirrors",
    image: cld("v1772085690/bedroom-second_cyfmdj.jpg"),
    summary:
      "Sculptural frames in patinated metal, plaster, gilded wood and lacquer. Mirrors conceived as wall pieces in their own right — by ateliers who treat reflection as a designed event.",
  },
  Art: {
    title: "Art & Wall Pieces",
    image: cld("v1772085533/art-master-bronze_hf6bad.jpg"),
    summary:
      "Editions, tapestries, ceramic reliefs and works on paper from designer-makers whose practice extends into the territory of fine art.",
  },

  // ── Outdoor ────────────────────────────────────────────────
  Outdoor: {
    title: "Outdoor",
    image: cld("v1772085716/bespoke-sofa_gxidtx.jpg"),
    summary:
      "Pieces conceived for terraces, courtyards and gardens — teak, powder-coated aluminium, weather-resistant textiles and stone — by ateliers who refuse to compromise indoor standards when the room has no walls.",
  },

  // ── Bed & Bath ─────────────────────────────────────────────
  Beds: {
    title: "Beds & Bedroom",
    image: cld("v1772085686/bedroom-alt_yk0j0d.jpg"),
    summary:
      "Upholstered headboards, four-posters, daybeds — the architecture of rest. Pieces made by ateliers who treat the bedroom as the most private and considered room in the house.",
  },
};

// Fallback used when no specific entry exists for the active filter.
export const CATEGORY_HERO_FALLBACK: CategoryHero = {
  title: "Curated Selection",
  image: cld("v1774537853/02travel-look-samuel-tmagArticle_ocja5c.jpg"),
  summary:
    "A focused selection of pieces from the designers and ateliers currently on view at Maison Affluency.",
};

export function getCategoryHero(category: string | null, subcategory: string | null): CategoryHero {
  if (subcategory && CATEGORY_HEROES[subcategory]) return CATEGORY_HEROES[subcategory];
  if (category && CATEGORY_HEROES[category]) return CATEGORY_HEROES[category];
  return {
    ...CATEGORY_HERO_FALLBACK,
    title: subcategory || category || CATEGORY_HERO_FALLBACK.title,
  };
}
