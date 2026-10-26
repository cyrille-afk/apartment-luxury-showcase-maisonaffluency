import { describe, expect, it } from "vitest";
import { chooseTourCardPlacement, collectionTourCardOrigin, collectionTourCardPlacement, placeTourCard, tourPanelLandingScrollDelta, type TourRect } from "./felixTourPlacement";

const overlaps = (a: TourRect, b: TourRect) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

describe("Collection tour upper-right placement", () => {
  it("constrains the card to existing space above photographs without changing the page", () => {
    expect(collectionTourCardPlacement({ viewport: { w: 1946, h: 1181 }, width: 380, height: 510, photoTop: 580, headingRight: 1016 }))
      .toEqual({ left: 1542, top: 80, width: 380, height: 488 });
  });
  for (const w of [1946, 1280, 1024]) {
    it(`keeps the card above photographs and clear of the heading at ${w}px`, () => {
      const preferred = collectionTourCardOrigin(w, 380, 144);
      const heading = { left: 304, top: 144, width: w - 748, height: 48 };
      const photos = { left: 304, top: 700, width: w - 352, height: 400 };
      const card = placeTourCard({ viewport: { w, h: 1181 }, width: 380, height: 510, preferred, obstacles: [heading, photos, { left: 0, top: 0, width: 255, height: 1181 }] });
      expect(card).toEqual({ ...preferred, width: 380, height: 510 });
      if (!card) return;
      expect(overlaps(card, photos)).toBe(false);
      expect(overlaps(card, heading)).toBe(false);
    });
  }
});

describe("branding panel landing", () => {
  it("scrolls back to reserve the entire explanation above the panel", () => {
    const target = { left: 24, top: 368.5, width: 1898, height: 443.5 };
    const delta = tourPanelLandingScrollDelta({ target, cardHeight: 484, viewportHeight: 1181 });
    expect(delta).toBe(-143.5);
    const landedTarget = { ...target, top: target.top - delta };
    const card = placeTourCard({ viewport: { w: 1946, h: 1181 }, obstacles: [landedTarget], width: 380, height: 484, preferred: { left: 783, top: 16 } });
    expect(card?.height).toBe(484);
    if (card) expect(overlaps(card, landedTarget)).toBe(false);
  });
  it("keeps the panel within a short viewport when both cannot fit in full", () => {
    expect(tourPanelLandingScrollDelta({ target: { left: 24, top: 100, width: 976, height: 443.5 }, cardHeight: 484, viewportHeight: 600 })).toBe(-32.5);
  });
});

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
describe("tour card obstacle-set selection", () => {
  const vp = { w: 1946, h: 1181 };
  const sidebar = { left: 0, top: 0, width: 255, height: 1181 };
  const spot = { left: 515, top: 287, width: 1172, height: 162 };
  const anchor = { left: 8, top: 512, width: 239, height: 40 };
  const headings = [
    { left: 525, top: 113, width: 1152, height: 36 },
    { left: 525, top: 297, width: 1152, height: 20 },
    { left: 525, top: 479, width: 1152, height: 20 },
    { left: 525, top: 798, width: 1152, height: 20 },
  ];
  const args = { viewport: vp, width: 380, height: 336, preferred: { left: 271, top: 492 } };

  it("keeps the card beside its spotlight instead of stranding it in a far band", () => {
    const strict = [spot, anchor, ...headings, sidebar];
    // With every section heading protected only the band below the last one
    // fits, which is where the card used to end up.
    expect(placeTourCard({ ...args, obstacles: strict })?.top).toBe(830);
    const chosen = chooseTourCardPlacement({ ...args, tiers: [[strict, [spot, anchor, sidebar]]] });
    expect(chosen).not.toBeNull();
    if (!chosen) return;
    expect(chosen.top).toBe(492);
    expect(chosen.left).toBe(271);
    for (const obstacle of [spot, anchor, sidebar]) expect(overlaps(chosen, obstacle)).toBe(false);
  });

  it("keeps the fully protected placement when it is already the nearest", () => {
    const strict = [spot, anchor, ...headings, sidebar];
    const chosen = chooseTourCardPlacement({
      ...args,
      preferred: { left: 271, top: 850 },
      tiers: [[strict, [spot, anchor, sidebar]]],
    });
    expect(chosen).not.toBeNull();
    if (!chosen) return;
    expect(chosen.top).toBe(830);
    for (const obstacle of strict) expect(overlaps(chosen, obstacle)).toBe(false);
  });

  it("falls through to a looser set when the strict one leaves no space", () => {
    const blocked = [{ left: 0, top: 0, width: 1946, height: 1181 }];
    const chosen = chooseTourCardPlacement({ ...args, tiers: [[blocked], [[spot, anchor, sidebar]]] });
    expect(chosen).not.toBeNull();
    if (!chosen) return;
    expect(overlaps(chosen, spot)).toBe(false);
  });
});

describe("tour card navigation protection", () => {
  const vp = { w: 1946, h: 1181 };
  const sidebar = { left: 0, top: 0, width: 255, height: 1181 };
  const spot = { left: 515, top: 287, width: 1172, height: 162 };
  const headings = [
    { left: 525, top: 113, width: 1152, height: 36 },
    { left: 525, top: 297, width: 1152, height: 20 },
    { left: 525, top: 479, width: 1152, height: 20 },
    { left: 525, top: 798, width: 1152, height: 20 },
  ];

  it("never trades the sidebar for a nearer placement while space remains", () => {
    // The step's preferred spot is under the sidebar. Dropping the sidebar
    // would land the card exactly there, so the tier that protects it must win.
    const chosen = chooseTourCardPlacement({
      viewport: vp,
      width: 380,
      height: 336,
      preferred: { left: 40, top: 500 },
      tiers: [[[spot, ...headings, sidebar]], [[spot]]],
    });
    expect(chosen).not.toBeNull();
    if (!chosen) return;
    expect(chosen.top).toBe(830);
    expect(overlaps(chosen, sidebar)).toBe(false);
    expect(overlaps(chosen, spot)).toBe(false);
  });
});
