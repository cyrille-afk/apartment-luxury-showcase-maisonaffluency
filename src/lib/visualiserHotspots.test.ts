import { describe, expect, it } from "vitest";
import {
  layoutVisualiserHotspots,
  VISUALISER_HOTSPOT_HIT_SIZE,
  type VisualiserHotspotRect,
} from "./visualiserHotspots";

const viewport = { width: 1000, height: 700 };
const outsidePanels = (x: number, y: number, panels: VisualiserHotspotRect[]) => {
  const half = VISUALISER_HOTSPOT_HIT_SIZE / 2;
  const pin = { left: x - half, top: y - half, right: x + half, bottom: y + half };
  return panels.every(panel => pin.right <= panel.left || pin.left >= panel.right || pin.bottom <= panel.top || pin.top >= panel.bottom);
};

describe("Visualiser hotspot placement", () => {
  it("keeps edge and off-screen anchors reachable inside the canvas", () => {
    const [placement] = layoutVisualiserHotspots([{ id: "edge", x: -180, y: -40 }], viewport);
    expect(placement.x).toBeGreaterThanOrEqual(VISUALISER_HOTSPOT_HIT_SIZE / 2);
    expect(placement.y).toBeGreaterThanOrEqual(VISUALISER_HOTSPOT_HIT_SIZE / 2);
    expect(placement.displaced).toBe(true);
  });

  it("moves a pin clear of an open inspector without changing its identity", () => {
    const inspector = { left: 20, top: 180, right: 300, bottom: 610 };
    const [placement] = layoutVisualiserHotspots([{ id: "chair", x: 160, y: 350 }], viewport, [inspector]);
    expect(placement.id).toBe("chair");
    expect(outsidePanels(placement.x, placement.y, [inspector])).toBe(true);
  });

  it("repositions pins when either side panel opens", () => {
    const left = { left: 0, top: 70, right: 300, bottom: 400 };
    const right = { left: 700, top: 70, right: 1000, bottom: 500 };
    const placements = layoutVisualiserHotspots([
      { id: "left-piece", x: 150, y: 220 },
      { id: "right-piece", x: 850, y: 260 },
    ], viewport, [left, right]);
    expect(placements).toHaveLength(2);
    placements.forEach(placement => expect(outsidePanels(placement.x, placement.y, [left, right])).toBe(true));
  });

  it("separates coincident pins so each keeps its own click target", () => {
    const placements = layoutVisualiserHotspots([
      { id: "one", x: 500, y: 350 },
      { id: "two", x: 500, y: 350 },
      { id: "three", x: 500, y: 350 },
    ], viewport);
    expect(new Set(placements.map(placement => `${placement.x}:${placement.y}`)).size).toBe(3);
    placements.forEach((placement, index) => {
      placements.slice(index + 1).forEach(other => {
        expect(Math.hypot(placement.x - other.x, placement.y - other.y)).toBeGreaterThanOrEqual(VISUALISER_HOTSPOT_HIT_SIZE);
      });
    });
  });

  it("flips the editorial label away from the nearest canvas edge", () => {
    const [placement] = layoutVisualiserHotspots([{ id: "right-edge", x: 960, y: 350 }], viewport);
    expect(placement.tooltipSide).toBe("left");
  });
});
