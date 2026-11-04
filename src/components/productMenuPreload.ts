import { productMenuImageSizes, selectProductMenuImages, type ProductMenuCard, type ProductMenuRotationState } from "./productMenuImages";
import { seatingCardImage, seatingCardSrcSet } from "./seatingMenuImages";

/** Preview the next shuffle selection without consuming the live rotation bag. */
export function nextProductMenuImages(cards: ProductMenuCard[], visit: number, state: ProductMenuRotationState) {
  const copy: ProductMenuRotationState = new Map([...state].map(([key, value]) => [key, { ...value, pool: [...value.pool], remaining: [...value.remaining] }]));
  return selectProductMenuImages(cards, visit, copy);
}

const warmed = new Set<string>();
export function warmProductMenuImages(cards: ProductMenuCard[]) {
  if (typeof window === "undefined") return;
  for (const card of cards) {
    // Warm featured assets only, never download the full catalogue's photos.
    for (const source of card.images.slice(0, 2)) {
      const sizes = productMenuImageSizes(cards.length);
      const key = `${source}:${sizes}:${window.innerWidth}:${window.devicePixelRatio}`;
      if (warmed.has(key)) continue;
      warmed.add(key);
      const image = new window.Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      image.sizes = sizes;
      image.srcset = seatingCardSrcSet(source);
      image.src = seatingCardImage(source);
    }
  }
}