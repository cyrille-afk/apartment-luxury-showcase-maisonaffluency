import { describe, expect, it } from "vitest";
import { comparatorExportFields, comparatorExportValues, defaultComparatorExportOptions } from "./comparatorExport";

describe("intentional comparator export", () => {
  it("defaults to client mode with retail and specifications on and trade off", () => {
    expect(defaultComparatorExportOptions()).toEqual({ mode: "client", retail: true, trade: false, logistics: true, materials: true });
  });
  it("removes supplier names, trade costs and internal notes even if trade is requested in client mode", () => {
    const result = comparatorExportValues({ brand_name: "Private supplier", trade_price_cents: "€900", designer_notes: "Margin 20%", rrp_price_cents: "€1,100", markup: "20%" }, { ...defaultComparatorExportOptions(), trade: true }, true);
    expect(result.rrp_price_cents).toBe("€1,100");
    expect(result).not.toHaveProperty("brand_name");
    expect(result).not.toHaveProperty("trade_price_cents");
    expect(result).not.toHaveProperty("designer_notes");
    expect(result).not.toHaveProperty("markup");
  });
  it("includes explicitly selected internal trade prices without exposing tier or margin fields", () => {
    const fields = comparatorExportFields({ ...defaultComparatorExportOptions(), mode: "internal", trade: true }, true);
    expect(fields).toContainEqual({ key: "trade_price_cents", label: "Trade Price" });
    expect(fields.map(f => f.key)).toContain("designer_notes");
  });
  it("does not allow export settings to bypass trade price visibility", () => {
    expect(comparatorExportFields({ ...defaultComparatorExportOptions(), mode: "internal", trade: true }, false).map(f => f.key)).not.toContain("trade_price_cents");
  });
  it("omits each disabled retail, logistics and materials section", () => {
    const keys = comparatorExportFields({ ...defaultComparatorExportOptions(), retail: false, logistics: false, materials: false }, true).map(f => f.key);
    expect(keys).toEqual(["category"]);
  });
});