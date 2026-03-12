import { GALLERY } from "@/constants/galleryIndex";
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";

// Gallery room names mapped from GALLERY indices
const GALLERY_ROOM_NAMES: Record<number, { room: string; experience: string }> = {
  [GALLERY.AN_INVITING_LOUNGE_AREA]: { room: "An Inviting Lounge Area", experience: "A Sociable Environment" },
  [GALLERY.A_SOPHISTICATED_LIVING_ROOM]: { room: "A Sophisticated Living Room", experience: "A Sociable Environment" },
  [GALLERY.PANORAMIC_CITYSCAPE_VIEWS]: { room: "Panoramic Cityscape Views", experience: "A Sociable Environment" },
  [GALLERY.A_SUN_LIT_READING_CORNER]: { room: "A Sun Lit Reading Corner", experience: "A Sociable Environment" },
  [GALLERY.A_DREAMY_TUSCAN_LANDSCAPE]: { room: "A Dreamy Tuscan Landscape", experience: "An Intimate Setting" },
  [GALLERY.A_HIGHLY_CUSTOMISED_DINING_ROOM]: { room: "A Highly Customised Dining Room", experience: "An Intimate Setting" },
  [GALLERY.A_RELAXED_SETTING]: { room: "A Relaxed Setting", experience: "An Intimate Setting" },
  [GALLERY.A_COLOURFUL_NOOK]: { room: "A Colourful Nook", experience: "An Intimate Setting" },
  [GALLERY.A_SOPHISTICATED_BOUDOIR]: { room: "A Sophisticated Boudoir", experience: "A Personal Sanctuary" },
  [GALLERY.A_JEWELRY_BOX_LIKE_SETTING]: { room: "A Jewelry Box Like Setting", experience: "A Personal Sanctuary" },
  [GALLERY.A_SERENE_DECOR]: { room: "A Serene Decor", experience: "A Personal Sanctuary" },
  [GALLERY.A_DESIGN_TREASURE_TROVE]: { room: "A Design Treasure Trove", experience: "A Personal Sanctuary" },
  [GALLERY.A_MASTERFUL_SUITE]: { room: "A Masterful Suite", experience: "A Calming and Dreamy Environment" },
  [GALLERY.DESIGN_TABLEAU]: { room: "Design Tableau", experience: "A Calming and Dreamy Environment" },
  [GALLERY.A_VENITIAN_COCOON]: { room: "A Venitian Cocoon", experience: "A Calming and Dreamy Environment" },
  [GALLERY.UNIQUE_BY_DESIGN_VIGNETTE]: { room: "Unique By Design Vignette", experience: "A Calming and Dreamy Environment" },
  [GALLERY.AN_ARTISTIC_STATEMENT]: { room: "An Artistic Statement", experience: "A Small Room with Massive Personality" },
  [GALLERY.COMPACT_ELEGANCE]: { room: "Compact Elegance", experience: "A Small Room with Massive Personality" },
  [GALLERY.YELLOW_CRYSTALLINE]: { room: "Yellow Crystalline", experience: "A Small Room with Massive Personality" },
  [GALLERY.GOLDEN_HOUR]: { room: "Golden Hour", experience: "A Small Room with Massive Personality" },
  [GALLERY.A_WORKSPACE_OF_DISTINCTION]: { room: "A Workspace of Distinction", experience: "Home Office with a View" },
  [GALLERY.REFINED_DETAILS]: { room: "Refined Details", experience: "Home Office with a View" },
  [GALLERY.LIGHT_AND_FOCUS]: { room: "Light & Focus", experience: "Home Office with a View" },
  [GALLERY.DESIGN_AND_FINE_ART_BOOKS_CORNER]: { room: "Design & Fine Art Books Corner", experience: "Home Office with a View" },
  [GALLERY.CURATED_VIGNETTE]: { room: "Curated Vignette", experience: "The Details Make the Design" },
  [GALLERY.THE_DETAILS_MAKE_THE_DESIGN]: { room: "The Details Make The Design", experience: "The Details Make the Design" },
  [GALLERY.LIGHT_AND_TEXTURE]: { room: "Light & Texture", experience: "The Details Make the Design" },
  [GALLERY.CRAFTSMANSHIP_AT_EVERY_CORNER]: { room: "Craftsmanship At Every Corner", experience: "The Details Make the Design" },
};

export interface CatalogueProduct {
  title: string;
  subtitle?: string;
  designerName: string;
  category?: string;
  subcategory?: string;
  materials?: string;
  dimensions?: string;
  edition?: string;
  description?: string;
  image?: string;
  galleryRoom: string;
  experience: string;
  galleryIndex: number;
}

function getDesignerDisplayName(designer: Record<string, any>): string {
  const name = designer.displayName || designer.name || "";
  // Extract just the brand/designer name before " - "
  return name.includes(" - ") ? name.split(" - ")[0].trim() : name;
}

function extractProducts(
  designers: Record<string, any>[],
): CatalogueProduct[] {
  const products: CatalogueProduct[] = [];

  for (const designer of designers) {
    const designerName = getDesignerDisplayName(designer);

    // Determine gallery index(es) for this designer
    const galleryIndices: number[] = [];
    if (designer.notableWorksLinks) {
      for (const link of designer.notableWorksLinks) {
        if (!galleryIndices.includes(link.galleryIndex)) {
          galleryIndices.push(link.galleryIndex);
        }
      }
    } else if (designer.notableWorksLink) {
      galleryIndices.push(designer.notableWorksLink.galleryIndex);
    }

    // Default to first room if none specified
    const primaryIndex = galleryIndices.length > 0 ? galleryIndices[0] : 0;

    if (designer.curatorPicks) {
      for (const pick of designer.curatorPicks as CuratorPick[]) {
        const roomInfo = GALLERY_ROOM_NAMES[primaryIndex] || { room: "Gallery", experience: "Gallery" };
        products.push({
          title: pick.title,
          subtitle: pick.subtitle,
          designerName,
          category: pick.category,
          subcategory: pick.subcategory,
          materials: pick.materials,
          dimensions: pick.dimensions,
          edition: pick.edition,
          description: pick.description,
          image: pick.image,
          galleryRoom: roomInfo.room,
          experience: roomInfo.experience,
          galleryIndex: primaryIndex,
        });
      }
    }
  }

  return products;
}

export interface GalleryRoomGroup {
  experience: string;
  room: string;
  galleryIndex: number;
  products: CatalogueProduct[];
}

export function getCatalogueData(): GalleryRoomGroup[] {
  const allProducts = [
    ...extractProducts(featuredDesigners as any),
    ...extractProducts(collectibleDesigners as any),
  ];

  // Group by experience then room
  const groupMap = new Map<string, GalleryRoomGroup>();

  for (const product of allProducts) {
    const key = `${product.experience}::${product.galleryRoom}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        experience: product.experience,
        room: product.galleryRoom,
        galleryIndex: product.galleryIndex,
        products: [],
      });
    }
    groupMap.get(key)!.products.push(product);
  }

  // Sort by gallery index
  return Array.from(groupMap.values()).sort((a, b) => a.galleryIndex - b.galleryIndex);
}
