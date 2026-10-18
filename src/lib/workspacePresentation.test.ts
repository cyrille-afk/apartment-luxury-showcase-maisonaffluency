import { describe, it, expect } from "vitest";
import { parseWorkspacePresentation } from "./workspacePresentation";
const view = { id: "00000000-0000-4000-8000-000000000001", name: "Room A", created_at: "2026-10-18T00:00:00Z", floorPlanUrl: null, bounds: { width: 12, depth: 8, height: 3 }, scene: { objects: [] } };
const presentation = { title: "Client presentation", studioName: "Studio", studioLogo: "", floorPlanUrl: "https://example.com/plan.jpg", views: [view] };
describe("read-only workspace presentations", () => {
  it("retains the shared floor plan and named room bounds", () => {
    const result = parseWorkspacePresentation(presentation);
    expect(result.floorPlanUrl).toBe("https://example.com/plan.jpg");
    expect(result.views[0].bounds).toEqual({ width: 12, depth: 8, height: 3 });
    expect(result.views[0].scene).toBeNull();
  });
  it("rejects unsafe floor-plan addresses", () => {
    expect(() => parseWorkspacePresentation({ ...presentation, floorPlanUrl: "javascript:alert(1)" })).toThrow();
    expect(() => parseWorkspacePresentation({ ...presentation, views: [{ ...view, floorPlanUrl: "http://example.com/plan.jpg" }] })).toThrow();
  });
  it("excludes ownership and pricing from parsed presentations", () => {
    const result = parseWorkspacePresentation({ ...presentation, user_id: "owner", trade_price_cents: 500, views: [{ ...view, trade_price_cents: 100 }] });
    expect(result).not.toHaveProperty("user_id");
    expect(result).not.toHaveProperty("trade_price_cents");
    expect(result.views[0]).not.toHaveProperty("trade_price_cents");
  });
  it("rejects more than twenty saved views", () => {
    expect(parseWorkspacePresentation({ ...presentation, views: Array.from({ length: 20 }, () => view) }).views).toHaveLength(20);
    expect(() => parseWorkspacePresentation({ ...presentation, views: Array.from({ length: 21 }, () => view) })).toThrow();
  });
  it("rejects invalid room dimensions", () => {
    expect(() => parseWorkspacePresentation({ ...presentation, views: [{ ...view, bounds: { ...view.bounds, width: -1 } }] })).toThrow();
  });
});