import { describe, expect, it } from "vitest";
import {
  DINING_CHAIR_SPACING_M, LOUNGE_INWARD_ANGLE, SOFA_COFFEE_CLEARANCE_M, SOFA_CONSOLE_CLEARANCE_M, SOFA_SIDE_TABLE_CLEARANCE_M,
  layoutSpatialItems, selectSpatialAnchor, spatialDimensionsM, spatialFootprintsOverlap, type SpatialLayoutItem,
} from "./spatialLayoutEngine";

const piece = (id: string, name: string, category: string, width: number, depth: number, height = 0.8): SpatialLayoutItem => ({
  id, product_name: name, category, width_mm: width * 1000, depth_mm: depth * 1000, height_mm: height * 1000,
});
const named = <T extends SpatialLayoutItem>(layout: ReturnType<typeof layoutSpatialItems<T>>, id: string) => {
  const placement = layout.find(entry => entry.item.id === id);
  if (!placement) throw new Error(`Missing ${id}`);
  return placement;
};

 describe("spatial layout engine", () => {
  it("uses the pinned Anchor, otherwise the largest suitable footprint, then the first piece", () => {
    const rows = [piece("chair", "Lounge Chair", "Seating", 0.8, 0.8), piece("sofa", "Sofa", "Sofas", 2.2, 0.95), piece("dining", "Dining Table", "Dining Tables", 2.4, 1.1)];
    expect(selectSpatialAnchor(rows, "sofa")).toBe(1);
    expect(selectSpatialAnchor(rows)).toBe(2);
    expect(selectSpatialAnchor([rows[0]])).toBe(0);
  });

  it("places a sofa vignette at the exact requested clearances and 35-degree inward angles", () => {
    const rows = [
      piece("sofa", "Sofa", "Sofas", 2.2, 0.95), piece("coffee", "Coffee Table", "Coffee Tables", 1.2, 0.6),
      piece("left", "Left Lounge Chair", "Lounge Chairs", 0.8, 0.85), piece("right", "Right Armchair", "Armchairs", 0.8, 0.85),
      piece("side-left", "Left Side Table", "Side Tables", 0.45, 0.45), piece("side-right", "Right Side Table", "Side Tables", 0.45, 0.45),
      piece("console", "Console", "Consoles", 1.6, 0.45),
    ];
    const layout = layoutSpatialItems(rows, "sofa");
    expect(named(layout, "sofa")).toMatchObject({ x: 0, z: 0, rotationY: 0, isAnchor: true });
    expect(named(layout, "coffee").z).toBeCloseTo((0.95 + 0.6) / 2 + SOFA_COFFEE_CLEARANCE_M, 8);
    expect(named(layout, "side-left").x).toBeCloseTo(-(2.2 / 2 + 0.45 / 2 + SOFA_SIDE_TABLE_CLEARANCE_M), 8);
    expect(named(layout, "side-right").x).toBeCloseTo(2.2 / 2 + 0.45 / 2 + SOFA_SIDE_TABLE_CLEARANCE_M, 8);
    expect(named(layout, "console").z).toBeCloseTo(-(0.95 + 0.45) / 2 - SOFA_CONSOLE_CLEARANCE_M, 8);
    expect(named(layout, "left").rotationY).toBeCloseTo(LOUNGE_INWARD_ANGLE, 8);
    expect(named(layout, "right").rotationY).toBeCloseTo(-LOUNGE_INWARD_ANGLE, 8);
    expect(named(layout, "left").x).toBeLessThan(named(layout, "coffee").x);
    expect(named(layout, "right").x).toBeGreaterThan(named(layout, "coffee").x);
    for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
      expect(spatialFootprintsOverlap({ x: layout[i].x, z: layout[i].z, width: layout[i].dimensions.width, depth: layout[i].dimensions.depth, rotationY: layout[i].rotationY }, { x: layout[j].x, z: layout[j].z, width: layout[j].dimensions.width, depth: layout[j].dimensions.depth, rotationY: layout[j].rotationY })).toBe(false);
    }
  });

  it("centres a dining Anchor and spaces chairs by width plus 0.15m on both long sides", () => {
    const rows = [piece("table", "Dining Table", "Dining Tables", 2.2, 1), ...Array.from({ length: 4 }, (_, index) => piece(`chair-${index}`, "Dining Chair", "Dining Chairs", 0.5, 0.55))];
    const layout = layoutSpatialItems(rows, "table");
    expect(named(layout, "table")).toMatchObject({ x: 0, z: 0, rotationY: 0, isAnchor: true });
    const far = ["chair-0", "chair-2"].map(id => named(layout, id));
    const near = ["chair-1", "chair-3"].map(id => named(layout, id));
    expect(far.map(chair => chair.z)).toEqual([expect.closeTo(-0.925, 8), expect.closeTo(-0.925, 8)]);
    expect(near.map(chair => chair.z)).toEqual([expect.closeTo(0.925, 8), expect.closeTo(0.925, 8)]);
    expect(far[1].x - far[0].x).toBeCloseTo(0.5 + DINING_CHAIR_SPACING_M, 8);
    expect(near[1].x - near[0].x).toBeCloseTo(0.5 + DINING_CHAIR_SPACING_M, 8);
    expect(far.every(chair => chair.rotationY === 0)).toBe(true);
    expect(near.every(chair => Math.abs(chair.rotationY - Math.PI) < 1e-8)).toBe(true);
  });

  it("uses metre dimensions and keeps an uncategorised seventeen-piece composition non-overlapping", () => {
    expect(spatialDimensionsM(piece("known", "Known", "Other", 1.25, 0.65, 0.75))).toEqual({ width: 1.25, depth: 0.65, height: 0.75 });
    const rows = Array.from({ length: 17 }, (_, index) => piece(`piece-${index}`, `Object ${index}`, "Objects", 0.6 + index % 3 * 0.2, 0.7));
    const layout = layoutSpatialItems(rows);
    expect(layout).toHaveLength(17);
    for (let i = 0; i < layout.length; i++) for (let j = i + 1; j < layout.length; j++) {
      expect(spatialFootprintsOverlap({ x: layout[i].x, z: layout[i].z, width: layout[i].dimensions.width, depth: layout[i].dimensions.depth, rotationY: layout[i].rotationY }, { x: layout[j].x, z: layout[j].z, width: layout[j].dimensions.width, depth: layout[j].dimensions.depth, rotationY: layout[j].rotationY })).toBe(false);
    }
  });
});
