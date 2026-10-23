import { describe, expect, it } from "vitest";
import { placeTourCard, type TourRect } from "./felixTourPlacement";

const overlaps = (a: TourRect, b: TourRect) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

describe("tour protected-space placement", () => {
  for (const viewport of [{ w: 1946, h: 1181 }, { w: 1280, h: 900 }, { w: 1024, h: 600 }]) {
    it(`avoids heading, tabs and sidebar navigation at ${viewport.w}×${viewport.h}`, () => {
      const obstacles = [
        { left: 16, top: 245, width: 224, height: 44 },
        { left: 280, top: 96, width: viewport.w - 320, height: 55 },
        { left: 280, top: 200, width: viewport.w - 320, height: 48 },
      ];
      const card = placeTourCard({ viewport, obstacles, width: 380, height: 510, preferred: { left: 264, top: 225 } });
      expect(card).not.toBeNull();
      if (!card) return;
      expect(card.left).toBeGreaterThanOrEqual(24);
      expect(card.top).toBeGreaterThanOrEqual(16);
      expect(card.left + card.width).toBeLessThanOrEqual(viewport.w - 24);
      expect(card.top + card.height).toBeLessThanOrEqual(viewport.h - 16);
      for (const obstacle of obstacles) expect(overlaps(card, obstacle)).toBe(false);
    });
  }
  it("uses a narrower empty column beside a full-height workspace", () => {
    const obstacle = { left: 280, top: 72, width: 1000, height: 828 };
    const card = placeTourCard({ viewport: { w: 1280, h: 900 }, obstacles: [obstacle], width: 380, height: 440, preferred: { left: 300, top: 100 } });
    expect(card?.width).toBe(244);
    if (card) expect(overlaps(card, obstacle)).toBe(false);
  });
  it("returns no placement rather than covering an entirely blocked viewport", () => {
    expect(placeTourCard({ viewport: { w: 1024, h: 600 }, obstacles: [{ left: 0, top: 0, width: 1024, height: 600 }], width: 380, height: 400, preferred: { left: 24, top: 16 } })).toBeNull();
  });
});