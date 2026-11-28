import { describe, expect, it, vi } from "vitest";
vi.mock("./privateTradeUpload", () => ({ resignPrivateTradeUrl: (url: string) => url }));
import { correctionBounds, furnitureCorrectionRequest, mergeCorrectionPixels } from "./furnitureCorrection";
describe("single-piece correction", () => {
  it("preserves every pixel outside the chosen rectangle exactly", () => {
    const original = Uint8ClampedArray.from({ length: 64 }, (_, i) => i);
    const edited = new Uint8ClampedArray(64).fill(255);
    const result = mergeCorrectionPixels(original, edited, 4, 4, { x: 25, y: 25, width: 50, height: 50 });
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const offset = (y * 4 + x) * 4;
      expect(result.slice(offset, offset + 4)).toEqual(x >= 1 && x < 3 && y >= 1 && y < 3 ? edited.slice(offset, offset + 4) : original.slice(offset, offset + 4));
    }
    expect(original[0]).toBe(0);
  });
  it("uses the current render and only the chosen furniture photo", () => {
    const request = furnitureCorrectionRequest("https://example.com/current.png", { id: "frenchmen", product_name: "Frenchmen Street Lounge Chair", brand_name: "Man of Parts", image_url: "https://example.com/frenchmen.jpg", selected_finishes: [{ axis: "Fabric", name: "Linen" }] }, { x: 50, y: 40, width: 30, height: 50 });
    expect(request.mode).toBe("product_swap");
    expect(request.imageUrl).toBe("https://example.com/current.png");
    expect(request.swaps).toHaveLength(1);
    expect(request.swaps[0]?.imageUrl).toBe("https://example.com/frenchmen.jpg");
    expect(request.referenceImageUrl).toBeNull();
    expect(request.swaps[0]?.prompt).toContain("Fabric: Linen");
  });
  it("rejects empty or out-of-image edit areas", () => {
    expect(() => correctionBounds({ x: 90, y: 0, width: 20, height: 10 }, 100, 100)).toThrow();
    expect(() => correctionBounds({ x: 0, y: 0, width: 0, height: 10 }, 100, 100)).toThrow();
  });
  it("blends the inner boundary without changing any outside pixels", () => {
    const original = new Uint8ClampedArray(100 * 100 * 4).fill(20);
    const edited = new Uint8ClampedArray(original.length).fill(200);
    const result = mergeCorrectionPixels(original, edited, 100, 100, { x: 20, y: 20, width: 60, height: 60 });
    expect(result[(20 * 100 + 20) * 4]).toBe(20);
    expect(result[(50 * 100 + 50) * 4]).toBe(200);
    expect(result[(19 * 100 + 50) * 4]).toBe(20);
    expect(result[(21 * 100 + 50) * 4]).toBeGreaterThan(20);
    expect(result[(21 * 100 + 50) * 4]).toBeLessThan(200);
  });
});