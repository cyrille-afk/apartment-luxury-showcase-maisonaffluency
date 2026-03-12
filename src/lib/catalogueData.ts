import { supabase } from "@/integrations/supabase/client";

/**
 * Gallery experience sections — matches the order in Gallery.tsx.
 * Each experience contains room titles (image_identifiers from gallery_hotspots).
 */
const GALLERY_SECTIONS = [
  {
    experience: "A Sociable Environment",
    rooms: [
      "An Inviting Lounge Area",
      "A Sophisticated Living Room",
      "Panoramic Cityscape Views",
      "A Sun Lit Reading Corner",
    ],
  },
  {
    experience: "An Intimate Setting",
    rooms: [
      "A Dreamy Tuscan Landscape",
      "A Highly Customised Dining Room",
      "A Relaxed Setting",
      "A Colourful Nook",
    ],
  },
  {
    experience: "A Personal Sanctuary",
    rooms: [
      "A Sophisticated Boudoir",
      "A Jewelry Box Like Setting",
      "A Serene Decor",
      "A Design Treasure Trove",
    ],
  },
  {
    experience: "A Calming and Dreamy Environment",
    rooms: [
      "A Masterful Suite",
      "Design Tableau",
      "A Venitian Cocoon",
      "Unique By Design Vignette",
    ],
  },
  {
    experience: "A Small Room with Massive Personality",
    rooms: [
      "An Artistic Statement",
      "Compact Elegance",
      "Yellow Crystalline",
      "Golden Hour",
    ],
  },
  {
    experience: "Home Office with a View",
    rooms: [
      "A Workspace of Distinction",
      "Refined Details",
      "Light & Focus",
      "Design & Fine Art Books Corner",
    ],
  },
  {
    experience: "The Details Make the Design",
    rooms: [
      "Curated Vignette",
      "The Details Make The Design",
      "Light & Texture",
      "Craftsmanship At Every Corner",
    ],
  },
];

export interface CatalogueProduct {
  id: string;
  product_name: string;
  designer_name: string | null;
  product_image_url: string | null;
  link_url: string | null;
  materials: string | null;
  dimensions: string | null;
  room: string;
}

export interface GalleryRoomGroup {
  experience: string;
  room: string;
  products: CatalogueProduct[];
}

export async function fetchCatalogueData(): Promise<GalleryRoomGroup[]> {
  const { data, error } = await supabase
    .from("gallery_hotspots")
    .select("id, image_identifier, product_name, designer_name, product_image_url, link_url, materials, dimensions")
    .order("product_name");

  if (error || !data) {
    console.error("Failed to fetch catalogue data:", error);
    return [];
  }

  // Group hotspots by image_identifier (room title)
  const byRoom = new Map<string, CatalogueProduct[]>();
  for (const row of data) {
    const room = row.image_identifier;
    if (!byRoom.has(room)) byRoom.set(room, []);
    byRoom.get(room)!.push({
      id: row.id,
      product_name: row.product_name,
      designer_name: row.designer_name,
      product_image_url: row.product_image_url,
      link_url: row.link_url,
      room,
    });
  }

  // Build groups following the gallery section order
  const groups: GalleryRoomGroup[] = [];

  for (const section of GALLERY_SECTIONS) {
    for (const room of section.rooms) {
      const products = byRoom.get(room);
      if (products && products.length > 0) {
        groups.push({
          experience: section.experience,
          room,
          products,
        });
      }
    }
  }

  return groups;
}
