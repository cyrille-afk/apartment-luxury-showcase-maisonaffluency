export type TourRect = { top: number; left: number; width: number; height: number };
type Bounds = { left: number; top: number; right: number; bottom: number };

/** Collection tour cards use existing upper-right space, never page reflow. */
export function collectionTourCardOrigin(viewportWidth: number, cardWidth: number, headingTop: number) {
  return { left: viewportWidth - cardWidth - 24, top: Math.max(80, headingTop - 32) };
}

export function collectionTourCardPlacement({ viewport, width, height, photoTop, headingRight, tabsRight = 0 }: {
  viewport: { w: number; h: number }; width: number; height: number; photoTop: number; headingRight: number; tabsRight?: number;
}): TourRect | null {
  // Sit beside the Collection header and tabs rather than at the extreme
  // right edge, while staying fully above the gallery photographs.
  const contentRight = Math.max(headingRight, tabsRight);
  const maxLeft = viewport.w - width - 24;
  const left = Math.min(contentRight + 32, maxLeft);
  const top = 80;
  const availableHeight = Math.min(viewport.h - 16, photoTop - 12) - top;
  if (left < contentRight + 20 || availableHeight < 160) return null;
  return { left, top, width, height: Math.min(height, availableHeight) };
}

/** Reserve the full explanation above a wide panel, rather than centering only the panel. */
export function tourPanelLandingScrollDelta({ target, cardHeight, viewportHeight }: {
  target: TourRect;
  cardHeight: number;
  viewportHeight: number;
}): number {
  const desiredTop = Math.min(cardHeight + 28, Math.max(28, viewportHeight - target.height - 24));
  return target.top - desiredTop;
}

/** Find empty viewport space first; never clamp a card back over a protected feature. */
export function placeTourCard({ viewport, obstacles, width, height, preferred }: {
  viewport: { w: number; h: number };
  obstacles: TourRect[];
  width: number;
  height: number;
  preferred: { left: number; top: number };
}): TourRect | null {
  let spaces: Bounds[] = [{ left: 24, top: 16, right: viewport.w - 24, bottom: viewport.h - 16 }];
  for (const rect of obstacles) {
    const block = { left: rect.left - 12, top: rect.top - 12, right: rect.left + rect.width + 12, bottom: rect.top + rect.height + 12 };
    const next: Bounds[] = [];
    for (const space of spaces) {
      if (block.right <= space.left || block.left >= space.right || block.bottom <= space.top || block.top >= space.bottom) {
        next.push(space);
        continue;
      }
      if (block.left > space.left) next.push({ ...space, right: block.left });
      if (block.right < space.right) next.push({ ...space, left: block.right });
      if (block.top > space.top) next.push({ ...space, bottom: block.top });
      if (block.bottom < space.bottom) next.push({ ...space, top: block.bottom });
    }
    // Remove contained rectangles to bound work on pages with many headings.
    spaces = next.filter((a, i) => !next.some((b, j) => j !== i && b.left <= a.left && b.top <= a.top && b.right >= a.right && b.bottom >= a.bottom && (j < i || b.left < a.left || b.top < a.top || b.right > a.right || b.bottom > a.bottom)));
  }
  // A card squeezed below its content height crops the dialogue behind the
  // sticky controls and reads as broken. Prefer a space that fits the full
  // height even when it sits further away; fall back to a ≥320px card, and
  // only then to the best shallow band.
  const pick = (minHeight: number, fullHeight = false): TourRect | null => {
    let best: TourRect | null = null;
    let bestScore = Infinity;
    for (const space of spaces) {
      const w = Math.min(width, space.right - space.left);
      const h = Math.min(height, space.bottom - space.top);
      // Full-height spaces must also keep a readable width; a 240px column
      // wraps the controls row into unreadability.
      if (w < Math.min(fullHeight ? 300 : 220, width)) continue;
      if (fullHeight ? h < height : h < Math.min(minHeight, height)) continue;
      const left = Math.max(space.left, Math.min(preferred.left, space.right - w));
      const top = Math.max(space.top, Math.min(preferred.top, space.bottom - h));
      const score = (width - w) * 20 + (height - h) * 4 + Math.hypot(left - preferred.left, top - preferred.top);
      if (score < bestScore) { bestScore = score; best = { left, top, width: w, height: h }; }
    }
    return best;
  };
  return pick(height, true) ?? pick(320) ?? pick(160);
}
/**
 * Pick the placement nearest the step's highlight, tier by tier.
 *
 * Within a tier the placement nearest the target wins; a tier is only left
 * when it offers no space at all. That keeps navigation protected: a looser
 * tier may uncover a dimmed section heading, never the sidebar the member is
 * being taught to use. Without this, a wide spotlight such as the Tools page
 * Discover row leaves only a far bottom band and the card strands away from
 * the feature it is explaining.
 */
export function chooseTourCardPlacement({ viewport, width, height, preferred, tiers, tolerance = 48 }: {
  viewport: { w: number; h: number };
  width: number;
  height: number;
  preferred: { left: number; top: number };
  tiers: TourRect[][][];
  tolerance?: number;
}): TourRect | null {
  for (const sets of tiers) {
    let best: TourRect | null = null;
    let bestDistance = Infinity;
    for (const obstacles of sets) {
      const card = placeTourCard({ viewport, width, height, preferred, obstacles });
      if (!card) continue;
      const distance = Math.hypot(card.left - preferred.left, card.top - preferred.top);
      if (!best || distance < bestDistance - tolerance) {
        best = card;
        bestDistance = distance;
      }
    }
    if (best) return best;
  }
  return null;
}
