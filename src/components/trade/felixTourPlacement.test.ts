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
  it("prefers a full-height side column over a shallow band between section headings", () => {
    // Tools page (step 19): full-width section headings slice the space right
    // of the Resources tile into a 275px band; the card must keep a readable
    // height in the open left column instead of shrinking into the band.
    const obstacles = [
      { left: 1107, top: 333, width: 279, height: 106 }, // Resources tile (target)
      { left: 525, top: 113, width: 1152, height: 36 }, // H1 Tools
      { left: 525, top: 297, width: 1152, height: 20 }, // H2 Discover
      { left: 525, top: 479, width: 1152, height: 20 }, // H2 Specification
      { left: 525, top: 798, width: 1152, height: 20 }, // H2 Procurement
    ];
    const card = placeTourCard({ viewport: { w: 1946, h: 1181 }, obstacles, width: 380, height: 439, preferred: { left: 1404, top: 350 } });
    expect(card).not.toBeNull();
    if (!card) return;
    expect(card.height).toBe(439);
    for (const obstacle of obstacles) expect(overlaps(card, obstacle)).toBe(false);
  });
  it("still allows a short card when no taller space exists", () => {
    // Viewport fully banded by headings every ~260px: only ~210px bands
    // remain, so the solver falls back to the best short placement.
    const obstacles = [100, 360, 620, 880].map((top) => ({ left: 0, top, width: 1946, height: 24 }));
    const card = placeTourCard({ viewport: { w: 1946, h: 1000 }, obstacles, width: 380, height: 439, preferred: { left: 700, top: 400 } });
    expect(card).not.toBeNull();
    if (!card) return;
    expect(card.height).toBeLessThan(320);
    for (const obstacle of obstacles) expect(overlaps(card, obstacle)).toBe(false);
  });
});