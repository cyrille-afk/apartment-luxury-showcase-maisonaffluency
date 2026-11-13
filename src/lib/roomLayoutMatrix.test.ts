import { describe, expect, it } from "vitest";
import { balanceLayoutMakers, boxAt, generateRoomLayoutMatrix, overlaps, selectLayoutCandidates, footprint } from "./roomLayoutMatrix";
import type { LiveCatalogueItem } from "./mockAiLayoutService";

const item = (id: string, role: LiveCatalogueItem["role"], price: number | null, dims = { w: 1, d: 1, h: 1 }): LiveCatalogueItem => ({
  componentId: id, sku: id, name: id, role, glbUrl: "", price, stockStatus: null, leadWeeks: null, available: true, styleTokens: [], dimensionsCubic: dims,
});
const cat = [item("sofa", "anchor", 20000, { w: 2.4, d: 1, h: 0.8 }), item("table", "table", 8000, { w: 1.2, d: 0.6, h: 0.4 }), item("lamp", "light", 3000, { w: 0.5, d: 0.5, h: 1.6 })];
const brief = { roomType: "living" as const, style: "quiet-luxury" as const, totalBudget: 60000, roomDimensions: { width: 7, length: 6, height: 3 } };

describe("generateRoomLayoutMatrix", () => {
  it("faces all Living room seating inward, including fallback placements", () => {
    const seats = Array.from({ length: 5 }, (_, i) => item(`chair-${i}`, "seat", 1000, { w: 0.6, d: 0.6, h: 0.8 }));
    const assets = generateRoomLayoutMatrix(brief, [...cat, ...seats]).scene.curatedAssets;
    const table = assets.find(a => a.componentId === "table");
    if (!table) throw new Error("Missing central table");
    expect(assets.filter(a => a.componentId.startsWith("chair-"))).toHaveLength(5);
    for (const a of assets.filter(a => a.componentId.startsWith("chair-") || a.componentId === "sofa")) {
      const dx = table.position[0] - a.position[0], dz = table.position[2] - a.position[2];
      expect(Math.sin(a.rotation[1]) * dx + Math.cos(a.rotation[1]) * dz).toBeGreaterThan(0);
    }
  });
  it("balances Man of Parts, Kerstens and Delcourt before repeating a maker", () => {
    const pool = [
      { ...item("mop-1", "seat", 1000), manufacturer: "Man of Parts" },
      { ...item("mop-2", "seat", 1000), manufacturer: "Man of Parts" },
      { ...item("kerstens", "seat", 1000), manufacturer: "Kerstens" },
      { ...item("delcourt", "seat", 1000), manufacturer: "Delcourt Collection" },
    ];
    expect(balanceLayoutMakers(pool).slice(0, 3).map((c) => c.manufacturer)).toEqual(["Man of Parts", "Kerstens", "Delcourt Collection"]);
  });
  it("falls back to all 8 pieces when fewer than 3 match Quiet luxury", () => {
    const eight = [...cat, ...Array.from({ length: 5 }, (_, i) => item(`chair-${i}`, "seat", 2000))];
    eight[0] = { ...eight[0], styleTokens: ["Quiet luxury"] };
    expect(selectLayoutCandidates({ ...brief, totalBudget: 150000 }, eight)).toHaveLength(8);
  });
  it("populates all fitting untagged pieces in a 7.2 × 6m room with a €150,000 ledger", () => {
    const eight = [...cat, ...Array.from({ length: 3 }, (_, i) => item(`chair-${i}`, "seat", 2000, { w: 0.8, d: 0.8, h: 0.8 })), item("console", "accent", 4000, { w: 1.5, d: 0.4, h: 0.8 }), item("side", "accent", 1500, { w: 0.4, d: 0.4, h: 0.5 })];
    const s = generateRoomLayoutMatrix({ ...brief, totalBudget: 150000, roomDimensions: { width: 7.2, length: 6, height: 3.2 } }, eight).scene;
    expect(s.curatedAssets).toHaveLength(8);
    expect(s.financialSummary).toEqual({ totalBudget: 150000, allocatedSpend: 42500, remainingBuffer: 107500 });
    const boxes = s.curatedAssets.map((a) => {
      const c = eight.find((c) => c.componentId === a.componentId);
      if (!c) throw new Error("Missing catalogue piece");
      const { w, d } = footprint(c); const turn = Math.abs(Math.sin(a.rotation[1])) > 0.5;
      return boxAt(a.position[0], a.position[2], turn ? d : w, turn ? w : d);
    });
    for (const [i, b] of boxes.entries()) {
      expect(b.minX).toBeGreaterThanOrEqual(-3.6); expect(b.maxX).toBeLessThanOrEqual(3.6);
      expect(b.minZ).toBeGreaterThanOrEqual(-3); expect(b.maxZ).toBeLessThanOrEqual(3);
      for (const other of boxes.slice(i + 1)) expect(overlaps(b, other)).toBe(false);
    }
  });
  it("retains recorded dimensions for a piece without a GLB", () => {
    const s = generateRoomLayoutMatrix(brief, [item("sofa", "anchor", 1000, { w: 2.4, d: 1, h: 0.8 })]).scene;
    expect(s.curatedAssets[0].glbUrl).toBe("");
    expect(s.curatedAssets[0].dimensionsCubic).toEqual({ w: 2.4, d: 1, h: 0.8 });
  });
  it("prioritizes active project pieces", () => {
    const pool = [item("a", "seat", 100), { ...item("z", "seat", 200), projectPriority: true }];
    expect(selectLayoutCandidates(brief, pool)[0].componentId).toBe("z");
  });
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
