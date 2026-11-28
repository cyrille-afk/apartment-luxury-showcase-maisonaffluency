import { describe, expect, it, vi } from "vitest";
vi.mock("./privateTradeUpload", () => ({ resignPrivateTradeUrl: (url: string) => url }));
import { correctionBounds, furnitureCorrectionRequest, fullFrameCorrectionImage } from "./furnitureCorrection";
import type { ProposalProduct } from "./proposalRenderDraft";
const chair: ProposalProduct = { id: "frenchmen", product_name: "Frenchmen Street Lounge Chair", brand_name: "Man of Parts", image_url: "https://example.com/frenchmen.jpg", selected_finishes: [{ axis: "Fabric", name: "Linen", image_url: "https://example.com/linen.jpg" }] };
const rift: ProposalProduct = { id: "rift", product_name: "Rift CTS Coffee Table", brand_name: "Delcourt", image_url: "https://example.com/rift.jpg", dimensions: "108 × 108 × 28 cm", selected_finishes: [{ axis: "Top", name: "Oak" }, { axis: "Base", name: "Travertine" }] };
describe("single-piece correction", () => {
  it("sends the full current image and every active room photo/finish, not only the target", () => {
    const request = furnitureCorrectionRequest("https://example.com/current.png", chair, { x: 50, y: 40, width: 30, height: 50 }, [chair, rift]);
    expect(request.mode).toBe("product_swap");
    expect(request.imageUrl).toBe("https://example.com/current.png");
    expect(request.fullFrameFurnitureEdit).toBe(true);
    expect(request.swaps).toHaveLength(1);
    expect(request.swaps[0]?.imageUrl).toBe("https://example.com/frenchmen.jpg");
    expect(request.referenceImageUrl).toBeNull();
    expect(request.placements.map(p => p.image_url)).toEqual([chair.image_url, rift.image_url]);
    expect(request.placements[0]?.selected_finishes).toEqual(chair.selected_finishes);
    expect(request.placements[1]?.dimensions).toBe("108 × 108 × 28 cm");
    expect(request).not.toHaveProperty("maskDataUrl");
  });
  it("embeds the 1:1 rounded-square squircle guardrail and target identity when Rift CTS is corrected", () => {
    const request = furnitureCorrectionRequest("https://example.com/current.png", { ...rift, product_id: "b26d428c-98ce-46e3-befa-d5308b894ba6" }, { x: 40, y: 60, width: 25, height: 20 }, [chair, rift]);
    expect(request.swaps[0]?.productId).toBe("b26d428c-98ce-46e3-befa-d5308b894ba6");
    expect(request.swaps[0]?.productName).toBe("Rift CTS Coffee Table");
    expect(request.swaps[0]?.prompt).toContain("1:1 rounded-square (squircle)");
    expect(request.swaps[0]?.prompt).not.toContain("not another selected chair");
  });
  it("rejects empty or out-of-image edit areas", () => {
    expect(() => correctionBounds({ x: 90, y: 0, width: 20, height: 10 }, 100, 100)).toThrow();
    expect(() => correctionBounds({ x: 0, y: 0, width: 0, height: 10 }, 100, 100)).toThrow();
  });
  it("rejects a missing non-target reference rather than silently omitting Rift", () => {
    expect(() => furnitureCorrectionRequest("current.png", chair, { x: 10, y: 10, width: 20, height: 20 }, [chair, { ...rift, image_url: "" }])).toThrow("Every active room piece");
  });
  it("stores complete model output bytes without cropping, blending or resizing", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const fetchMock = vi.fn().mockResolvedValue(new Response(bytes, { headers: { "Content-Type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const blob = await fullFrameCorrectionImage("https://example.com/full.png");
      expect(new Uint8Array(await blob.arrayBuffer())).toEqual(bytes);
      expect(fetchMock).toHaveBeenCalledWith("https://example.com/full.png");
    } finally { vi.unstubAllGlobals(); }
  });
});