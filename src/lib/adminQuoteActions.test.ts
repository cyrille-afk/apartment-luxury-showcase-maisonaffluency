import { describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { quotePricingLines, saveAdminQuotePricing, reviseAdminQuote } from "./adminQuoteActions";

describe("admin quote actions", () => {
  it("requires valid prices for every piece and converts dollars to cents", () => {
    expect(quotePricingLines([{ id: "a" }], { a: "123.45" })).toEqual([{ id: "a", cents: 12345 }]);
    for (const price of ["", "bad", "-1", "Infinity"]) expect(() => quotePricingLines([{ id: "a" }], { a: price })).toThrow();
  });
  it("sends all prices and landed costs in one atomic operation", async () => {
    rpc.mockResolvedValueOnce({ data: "q", error: null });
    await saveAdminQuotePricing("q", [{ id: "a", cents: 12345 }], "notes", { cbm: 700, kg: 4, mode: "road" });
    expect(rpc).toHaveBeenLastCalledWith("admin_save_quote_pricing", { _quote_id: "q", _lines: [{ id: "a", cents: 12345 }], _notes: "notes", _cbm: 700, _kg: 4, _mode: "road" });
  });
  it("rejects failed pricing instead of returning success", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    await expect(saveAdminQuotePricing("q", [], "", { cbm: 1, kg: 1, mode: "road" })).rejects.toThrow("denied");
  });
  it("returns the saved revision identity and rejects failed creation", async () => {
    rpc.mockResolvedValueOnce({ data: "revision", error: null });
    expect(await reviseAdminQuote("original", "reason")).toBe("revision");
    rpc.mockResolvedValueOnce({ data: null, error: new Error("denied") });
    await expect(reviseAdminQuote("original", "reason")).rejects.toThrow("denied");
  });
});