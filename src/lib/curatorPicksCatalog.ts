/**
 * Aggregates ALL curator pick images from FeaturedDesigners, Collectibles,
 * and BrandsAteliers into a flat catalog for the Media Library.
 */
import { featuredDesigners, type CuratorPick } from "@/components/FeaturedDesigners";
import { collectibleDesigners } from "@/components/Collectibles";
import { atelierOnlyPicks } from "@/components/BrandsAteliers";

export interface CuratorPickAsset {
  /** Display name: "Designer — Title" */
  name: string;
  /** Full image URL (local import or Cloudinary) */
  url: string;
  /** Source section */
  section: "designers" | "collectibles" | "ateliers";
  /** Designer/brand name */
  designerName: string;
  /** Pick title */
  title: string;
  /** Category if available */
  category?: string;
}

function extractPicks(
  designers: Array<{ name: string; curatorPicks: CuratorPick[] }>,
  section: CuratorPickAsset["section"]
): CuratorPickAsset[] {
  const assets: CuratorPickAsset[] = [];
  for (const d of designers) {
    for (const pick of d.curatorPicks) {
      if (pick.image) {
        assets.push({
          name: `${d.name} — ${pick.title}`,
          url: pick.image,
          section,
          designerName: d.name,
          title: pick.title,
          category: pick.category,
        });
      }
    }
  }
  return assets;
}

let _cache: CuratorPickAsset[] | null = null;

export function getCuratorPicksCatalog(): CuratorPickAsset[] {
  if (_cache) return _cache;

  const assets: CuratorPickAsset[] = [];

  // Featured Designers
  assets.push(...extractPicks(featuredDesigners as any, "designers"));

  // Collectible Designers
  assets.push(...extractPicks(collectibleDesigners as any, "collectibles"));

  // Atelier-only picks
  for (const [, data] of Object.entries(atelierOnlyPicks)) {
    assets.push(...extractPicks([data] as any, "ateliers"));
  }

  _cache = assets;
  return assets;
}
