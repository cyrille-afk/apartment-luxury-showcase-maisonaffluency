export type VisualiserHotspotAnchor = {
  id: string;
  x: number;
  y: number;
};

export type VisualiserHotspotRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type VisualiserHotspotPlacement = VisualiserHotspotAnchor & {
  tooltipSide: "left" | "right";
  displaced: boolean;
};

export const VISUALISER_HOTSPOT_HIT_SIZE = 40;
export const VISUALISER_HOTSPOT_VIEWPORT_PADDING = 10;
export const VISUALISER_HOTSPOT_PANEL_GAP = 10;

const TOOLTIP_WIDTH = 256;
const TOOLTIP_GAP = 12;
const SEARCH_DIRECTIONS = 16;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const expand = (rect: VisualiserHotspotRect, amount: number): VisualiserHotspotRect => ({
  left: rect.left - amount,
  top: rect.top - amount,
  right: rect.right + amount,
  bottom: rect.bottom + amount,
});

const intersects = (a: VisualiserHotspotRect, b: VisualiserHotspotRect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const pinRect = (x: number, y: number, size: number): VisualiserHotspotRect => {
  const half = size / 2;
  return { left: x - half, top: y - half, right: x + half, bottom: y + half };
};

/**
 * Keeps every in-front-of-camera furniture pin inside the usable canvas and
 * clear of floating panels and other pins. Candidates stay close to the real
 * projected anchor; furniture transforms are never changed.
 */
export function layoutVisualiserHotspots(
  anchors: VisualiserHotspotAnchor[],
  viewport: { width: number; height: number },
  panelRects: VisualiserHotspotRect[] = [],
): VisualiserHotspotPlacement[] {
  const size = VISUALISER_HOTSPOT_HIT_SIZE;
  const half = size / 2;
  const minX = Math.min(viewport.width / 2, VISUALISER_HOTSPOT_VIEWPORT_PADDING + half);
  const maxX = Math.max(viewport.width / 2, viewport.width - VISUALISER_HOTSPOT_VIEWPORT_PADDING - half);
  const minY = Math.min(viewport.height / 2, VISUALISER_HOTSPOT_VIEWPORT_PADDING + half);
  const maxY = Math.max(viewport.height / 2, viewport.height - VISUALISER_HOTSPOT_VIEWPORT_PADDING - half);
  const obstacles = panelRects
    .filter(rect => rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width && rect.top < viewport.height)
    .map(rect => expand(rect, VISUALISER_HOTSPOT_PANEL_GAP));
  const occupied: VisualiserHotspotRect[] = [];
  const placements: VisualiserHotspotPlacement[] = [];
  const maxRadius = Math.max(viewport.width, viewport.height) + size;

  for (const anchor of anchors) {
    const originX = clamp(anchor.x, minX, maxX);
    const originY = clamp(anchor.y, minY, maxY);
    let chosen: { x: number; y: number } | null = null;
    let chosenScore = Number.POSITIVE_INFINITY;

    // Rings provide deterministic nearest-free placement even when a large
    // inspector or lighting panel covers the original projected position.
    for (let radius = 0; radius <= maxRadius; radius += size) {
      const steps = radius === 0 ? 1 : SEARCH_DIRECTIONS;
      for (let step = 0; step < steps; step += 1) {
        const angle = -Math.PI / 2 + (step / steps) * Math.PI * 2;
        const x = clamp(originX + Math.cos(angle) * radius, minX, maxX);
        const y = clamp(originY + Math.sin(angle) * radius, minY, maxY);
        const rect = pinRect(x, y, size);
        if (obstacles.some(obstacle => intersects(rect, obstacle)) || occupied.some(other => intersects(rect, other))) continue;
        const score = (x - anchor.x) ** 2 + (y - anchor.y) ** 2;
        if (score < chosenScore) {
          chosen = { x, y };
          chosenScore = score;
        }
      }
      if (chosen) break;
    }

    // Extremely dense/small canvases may not have a fully clear 40px cell.
    // Keep the pin reachable at the nearest bounded point rather than dropping it.
    if (!chosen) chosen = { x: originX, y: originY };
    occupied.push(pinRect(chosen.x, chosen.y, size));

    const rightTooltip: VisualiserHotspotRect = {
      left: chosen.x + half + TOOLTIP_GAP,
      top: chosen.y - 26,
      right: chosen.x + half + TOOLTIP_GAP + TOOLTIP_WIDTH,
      bottom: chosen.y + 26,
    };
    const rightBlocked = rightTooltip.right > viewport.width - VISUALISER_HOTSPOT_VIEWPORT_PADDING
      || obstacles.some(obstacle => intersects(rightTooltip, obstacle));
    placements.push({
      ...anchor,
      x: chosen.x,
      y: chosen.y,
      tooltipSide: rightBlocked ? "left" : "right",
      displaced: Math.hypot(chosen.x - anchor.x, chosen.y - anchor.y) > 1,
    });
  }

  return placements;
}
