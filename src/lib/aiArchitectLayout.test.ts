import { describe, expect, it } from "vitest";
import { buildArchitectCatalog, validateArchitectLayout, type ArchitectOutput } from "./aiArchitectLayout";
import type { LiveCatalogueItem } from "./mockAiLayoutService";

const item = (id: string, role: LiveCatalogueItem["role"], price: number | null, w: number, d: number): LiveCatalogueItem => ({
  componentId: id, sku: id, name: id, role, glbUrl: "", price, stockStatus: null, leadWeeks: null, available: true, styleTokens: [], dimensionsCubic: { w, d, h: 0.8 },
});
const cat = [item("sofa", "anchor", 20000, 2.4, 1), item("table", "table", 10000, 1.2, 0.6), item("por", "seat", null, 0.8, 0.8)];
const brief = { roomType: "living" as const, style: "quiet-luxury" as const, totalBudget: 30000, roomDimensions: { width: 7, length: 6, height: 3 } };
const rows = buildArchitectCatalog(cat, 0.1);
// Sofa centre y=3 (front edge y=3.5, facing north); table depth 0.6 → centre 3.5+0.6+0.3 = 4.4
const out = (tableY = 4.4, extra: ArchitectOutput["placements"] = []): ArchitectOutput => ({
  layout_metadata: { total_items_placed: 2, total_trade_spend_eur: 27000, budget_buffer_remaining: 3000 },
  placements: [
    { sku: "sofa", category: "sofa", position: [3.5, 3, 0], rotation: 0, layout_logic_justification: "" },
    { sku: "table", category: "coffee_table", position: [3.5, tableY, 0], rotation: 0, layout_logic_justification: "" },
    ...extra,
  ],
});

describe("AI architect layout rules", () => {
  it("budgets on trade cost (RRP less tier discount), not RRP", () => {
    expect(rows.find((r) => r.sku === "sofa")?.trade_cost).toBe(18000);
    // RRP total 30,000 equals budget; trade total 27,000 fits.
    expect(validateArchitectLayout(out(), brief, cat, rows, []).tradeSpend).toBe(27000);
  });
  it("rejects trade spend over budget", () => {
    expect(validateArchitectLayout(out(), { ...brief, totalBudget: 26000 }, cat, rows, []).ok).toBe(false);
  });
  it("accepts a coffee table exactly 0.6 m from the sofa edge", () => {
    expect(validateArchitectLayout(out(), brief, cat, rows, []).ok).toBe(true);
  });
  it("rejects a 0.45 m coffee table gap", () => {
    expect(validateArchitectLayout(out(4.25), brief, cat, rows, []).ok).toBe(false);
  });
  it("never places Price upon Request pieces", () => {
    const r = validateArchitectLayout(out(4.4, [{ sku: "por", category: "accent_chair", position: [1, 1, 0], rotation: 90, layout_logic_justification: "" }]), brief, cat, rows, []);
    expect(rows.find((x) => x.sku === "por")?.trade_cost).toBeNull();
    expect(r.ok).toBe(false);
  });
  it("rejects pieces outside the room", () => {
    const r = validateArchitectLayout({ ...out(), placements: [{ sku: "sofa", category: "sofa", position: [0.5, 3, 0], rotation: 0, layout_logic_justification: "" }] }, brief, cat, rows, []);
    expect(r.ok).toBe(false);
  });
  it("rejects pieces blocking a window", () => {
    const window = { type: "window" as const, position: [0, 1.5, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: [2.4, 1.8, 0.1] as [number, number, number] };
    // window centred on room → prompt (3.5, 3); sofa at (3.5, 3) collides
    expect(validateArchitectLayout(out(), brief, cat, rows, [window]).ok).toBe(false);
  });
});
