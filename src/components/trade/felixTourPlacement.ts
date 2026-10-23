export type TourRect = { top: number; left: number; width: number; height: number };
type Bounds = { left: number; top: number; right: number; bottom: number };

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