import { describe, expect, it } from "vitest";
import { boxAt, generateRoomLayoutMatrix, overlaps } from "./roomLayoutMatrix";
import type { LiveCatalogueItem } from "./mockAiLayoutService";

const item = (id: string, role: LiveCatalogueItem["role"], price: number | null, dims = { w: 1, d: 1, h: 1 }): LiveCatalogueItem => ({
  componentId: id, sku: id, name: id, role, glbUrl: "", price, stockStatus: null, leadWeeks: null, available: true, styleTokens: [], dimensionsCubic: dims,
});
const cat = [item("sofa", "anchor", 20000, { w: 2.4, d: 1, h: 0.8 }), item("table", "table", 8000, { w: 1.2, d: 0.6, h: 0.4 }), item("lamp", "light", 3000, { w: 0.5, d: 0.5, h: 1.6 })];
const brief = { roomType: "living" as const, style: "quiet-luxury" as const, totalBudget: 60000, roomDimensions: { width: 7, length: 6, height: 3 } };

describe("generateRoomLayoutMatrix", () => {
  it("places the table exactly 0.6 m in front of the sofa", () => {
    const [s, t] = generateRoomLayoutMatrix(brief, cat).scene.curatedAssets;
    expect(t.position[2] - 0.3 - (s.position[2] + 0.5)).toBeCloseTo(0.6);
  });
  it("never overlaps the three pieces", () => {
    const a = generateRoomLayoutMatrix(brief, cat).scene.curatedAssets;
    const dims = [[2.4, 1], [1.2, 0.6], [0.5, 0.5]];
    const boxes = a.map((x, i) => boxAt(x.position[0], x.position[2], dims[i][0], dims[i][1]));
    expect(overlaps(boxes[0], boxes[2]) || overlaps(boxes[1], boxes[2]) || overlaps(boxes[0], boxes[1])).toBe(false);
  });
  it("stays within the budget", () => {
    const r = generateRoomLayoutMatrix({ ...brief, totalBudget: 25000 }, cat);
    expect(r.scene.financialSummary.allocatedSpend).toBeLessThanOrEqual(25000);
  });
  it("never places unpriced pieces", () => {
    const r = generateRoomLayoutMatrix(brief, [item("sofa", "anchor", null)]);
    expect(r.scene.curatedAssets).toHaveLength(0);
  });
  it("builds a 0.5 m floor grid from width and length", () => {
    const m = generateRoomLayoutMatrix(brief, cat).matrix;
    expect([m.cols, m.rows]).toEqual([14, 12]);
  });
});
