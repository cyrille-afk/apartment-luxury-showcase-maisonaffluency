import { describe, expect, it } from "vitest";
import { curate, sceneFromCuration } from "./curationEngine";
import type { LiveCatalogueItem } from "./mockAiLayoutService";

const piece = (id: string, role: LiveCatalogueItem["role"], manufacturer: string): LiveCatalogueItem => ({
  componentId: id, sku: id, name: id, role, manufacturer, glbUrl: "model.glb", price: 1000,
  available: true, stockStatus: null, leadWeeks: null, styleTokens: [], dimensionsCubic: { w: 0.8, d: 0.6, h: 0.8 },
});
describe("all-maker brief curation", () => {
  it("chooses Man of Parts, Kerstens and Delcourt across equally matched roles", () => {
    const result = curate("quiet luxury budget €150,000", [
      piece("sofa", "anchor", "Man of Parts"), piece("lamp-mop", "light", "Man of Parts"),
      piece("lamp-kerstens", "light", "Kerstens"), piece("table-mop", "table", "Man of Parts"),
      piece("table-delcourt", "table", "Delcourt Collection"),
    ], 150000);
    expect(new Set(result.selected.map((r) => r.item.manufacturer)).size).toBe(3);
    const scene = sceneFromCuration(result, { roomType: "living", style: "quiet-luxury", totalBudget: 150000, roomDimensions: { width: 7.2, length: 6, height: 3.2 } });
    expect(scene.curatedAssets).toHaveLength(3);
    expect(scene.financialSummary.allocatedSpend).toBe(3000);
  });
});