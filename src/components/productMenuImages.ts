import { pickMatchesCategoryFilter, type FilterablePick } from "@/lib/pickCategoryFilter";
import { SEATING_CARDS } from "./seatingMenuImages";

export interface ProductMenuLink { label: string; category: string; subcategory?: string }
export interface ProductMenuCard extends ProductMenuLink { images: string[] }
interface MenuPick extends FilterablePick { image?: string; hoverImage?: string }

/** Resolve each slot independently; never substitute a different typology. */
export function resolveProductMenuCards(links: ProductMenuLink[], picks: MenuPick[], curatedSeating = false): ProductMenuCard[] {
  return links.map((link) => {
    const curated = curatedSeating ? SEATING_CARDS.find((card) => card.label === link.label)?.images : undefined;
    const images = curated ?? picks
      .filter((pick) => pickMatchesCategoryFilter(pick, link.category, link.subcategory))
      .flatMap((pick) => [pick.image, pick.hoverImage])
      .filter((image): image is string => Boolean(image));
    return { ...link, images: [...new Set(images)].slice(0, 12) };
  });
}

export function productMenuImageIndex(visit: number, images: string[]): number {
  return images.length ? Math.max(0, visit) % images.length : 0;
}

export function productMenuImageSizes(columns: number): string {
  const count = Math.max(1, columns);
  const fixedSpace = 256 + (count - 1) * 16;
  return `(min-width: 1232px) ${Math.ceil((1184 - fixedSpace) / count)}px, calc((100vw - ${fixedSpace + 48}px) / ${count})`;
}