import { pickMatchesCategoryFilter, type FilterablePick } from "@/lib/pickCategoryFilter";

export interface ProductMenuLink { label: string; category: string; subcategory?: string }
export interface ProductMenuCard extends ProductMenuLink { images: string[] }
interface MenuPick extends FilterablePick { image?: string; hoverImage?: string }

/** Resolve each slot independently; never substitute a different typology. */
export function resolveProductMenuCards(links: ProductMenuLink[], picks: MenuPick[]): ProductMenuCard[] {
  return links.map((link) => {
    const images = picks
      .filter((pick) => pickMatchesCategoryFilter(pick, link.category, link.subcategory))
      .flatMap((pick) => [pick.image, pick.hoverImage])
      .filter((image): image is string => Boolean(image?.trim()))
      .map((image) => image.trim());
    return { ...link, images: [...new Set(images)] };
  });
}

interface ImageRotation {
  pool: string[];
  remaining: number[];
  lastImage?: string;
  visit: number;
  index: number;
}
export type ProductMenuRotationState = Map<string, ImageRotation>;

/** Fisher–Yates shuffle bags expose the entire pool before repeating. */
export function selectProductMenuImages(cards: ProductMenuCard[], visit: number, state: ProductMenuRotationState, random = Math.random) {
  const displayed = new Set<string>();
  return cards.map((card) => {
    const key = `${card.category}:${card.subcategory ?? ""}:${card.label}`;
    let rotation = state.get(key);
    if (!rotation || rotation.pool.length !== card.images.length || rotation.pool.some((image, i) => image !== card.images[i])) {
      rotation = { pool: [...card.images], remaining: [], lastImage: rotation?.lastImage, visit: -1, index: 0 };
      state.set(key, rotation);
    }
    if (rotation.visit !== visit) {
      if (!rotation.remaining.length) {
        rotation.remaining = card.images.map((_, index) => index);
        for (let i = rotation.remaining.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [rotation.remaining[i], rotation.remaining[j]] = [rotation.remaining[j], rotation.remaining[i]];
        }
      }
      // Avoid the last photo and duplicate cards wherever this pool permits it.
      const preferred = rotation.remaining.findIndex((index) => card.images[index] !== rotation.lastImage && !displayed.has(card.images[index]));
      const nonRepeat = rotation.remaining.findIndex((index) => card.images[index] !== rotation.lastImage);
      const position = preferred >= 0 ? preferred : nonRepeat >= 0 ? nonRepeat : 0;
      rotation.index = rotation.remaining.splice(position, 1)[0] ?? 0;
      rotation.lastImage = card.images[rotation.index];
      rotation.visit = visit;
    }
    const image = card.images[rotation.index];
    if (image) displayed.add(image);
    return { ...card, index: rotation.index, image };
  });
}

export function productMenuImageSizes(columns: number): string {
  const count = Math.max(1, columns);
  const fixedSpace = 256 + (count - 1) * 16;
  return `(min-width: 1232px) ${Math.ceil((1184 - fixedSpace) / count)}px, calc((100vw - ${fixedSpace + 48}px) / ${count})`;
}