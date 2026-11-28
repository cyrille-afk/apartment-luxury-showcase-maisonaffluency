import { describe, expect, it } from "vitest";
import { eyeLevelCameraKey, planPoint, restoreProposalRenderDraft, validEyeLevelCamera, requireEyeLevelTargets, validEyeLevelTarget } from "./proposalRenderDraft";
import { eyeLevelShellPrompt, eyeLevelStagingPrompt } from "../../supabase/functions/_shared/eyeLevelPrompt";
import { EYE_LEVEL_HEIGHT_M, EYE_LEVEL_LENS_MM } from "../../supabase/functions/_shared/eyeLevelCamera";
const camera = { position: { x: 60, y: 70 }, target: { x: 60, y: 20 } };
describe("eye-level proposal rules", () => {
  it("uses the requested 1.5m eye height and 30mm architectural lens", () => { expect(EYE_LEVEL_HEIGHT_M).toBe(1.5); expect(EYE_LEVEL_LENS_MM).toBe(30); expect(() => eyeLevelShellPrompt(camera)).not.toThrow(); });
  it("maps camera coordinates against actual image bounds", () => { expect(planPoint(300, 450, { left: 100, top: 50, width: 400, height: 500 })).toEqual({ x: 50, y: 80 }); });
  it("rejects coincident or outside-plan sightlines", () => { expect(validEyeLevelCamera({ position: camera.position, target: camera.position })).toBe(false); expect(validEyeLevelCamera({ ...camera, position: { x: 101, y: 50 } })).toBe(false); });
  it("invalidates a shell when camera, target or plan changes", () => { const key = eyeLevelCameraKey("plan-a", camera); expect(eyeLevelCameraKey("plan-b", camera)).not.toBe(key); expect(eyeLevelCameraKey("plan-a", { ...camera, target: { x: 50, y: 20 } })).not.toBe(key); });
  it("never restores another room's camera, shell or furniture", () => { expect(restoreProposalRenderDraft({ sourceKey: "old", camera }, "new")).toBeNull(); });
  it("retains separate views and drops transient image bytes", () => { const restored = restoreProposalRenderDraft({ sourceKey: "plan", camera, view: "eye-level", shellUrl: "data:image/png;base64,abc", axonometricResult: "https://example.com/axo.png", eyeLevelResult: "https://example.com/eye.png" }, "plan"); expect(restored?.shellUrl).toBeNull(); expect(restored?.axonometricResult).toBe("https://example.com/axo.png"); expect(restored?.eyeLevelResult).toBe("https://example.com/eye.png"); });
  it("requires a bounded selected collection before staging", () => { expect(() => eyeLevelStagingPrompt([])).toThrow(); expect(() => eyeLevelStagingPrompt(Array.from({ length: 11 }, () => ({ product_name: "Coffee table" })))).toThrow(); });
  it("requires a numbered target for every admin-staged product", () => {
    expect(() => eyeLevelStagingPrompt([{ product_name: "Yoma CLW Console" }], { requireTargets: true })).toThrow();
    expect(() => requireEyeLevelTargets([{ product_name: "Yoma CLW Console", target: { x: 20, y: 65, instruction: "against solid left wall" } }, { product_name: "Coffee table" }])).toThrow();
    expect(() => requireEyeLevelTargets([{ product_name: "Yoma CLW Console", target: { x: 20, y: 65, instruction: "against solid left wall" } }])).not.toThrow();
  });
  it("rejects off-image targets and oversized placement notes", () => {
    expect(validEyeLevelTarget({ x: 101, y: 50, instruction: "against left wall" })).toBe(false);
    expect(validEyeLevelTarget({ x: 20, y: NaN, instruction: "against left wall" })).toBe(false);
    expect(validEyeLevelTarget({ x: 20, y: 60, instruction: "a".repeat(301) })).toBe(false);
  });
  it("stages all four selected pieces with pins even when three notes are empty", () => {
    const products = [
      { id: "gum", product_name: "GUM armchair by Christophe Delcourt", x: 53.6, y: 67.6, instruction: "right side angled toward coffee table, clear of sliding glass doors" },
      { id: "rift", product_name: "Rift CTS", x: 40.4, y: 80.6, instruction: "" },
      { id: "frenchmen", product_name: "Frenchmen Street Lounge Chair", x: 64.6, y: 85.5, instruction: " " },
      { id: "rua", product_name: "Rua Leblon", x: 16.8, y: 71.6, instruction: "" },
    ].map(({ x, y, instruction, ...piece }) => ({ ...piece, brand_name: "Recorded maker", image_url: "https://example.com/product.jpg", target: { x, y, instruction } }));
    expect(() => requireEyeLevelTargets(products)).not.toThrow();
    const prompt = eyeLevelStagingPrompt(products, { requireTargets: true, hasLayout: false });
    for (const [index, piece] of products.entries()) {
      expect(prompt).toContain(piece.product_name);
      expect(prompt).toContain(`PIN ${index + 1}: floor-contact/footprint centre at (${piece.target.x.toFixed(2)}%, ${piece.target.y.toFixed(2)}%)`);
    }
    const restored = restoreProposalRenderDraft({ sourceKey: "plan", products }, "plan");
    expect(restored?.products.map(p => p.target)).toEqual(products.map(p => p.target));
  });
  it("restores uploaded shell provenance and exact product target without requiring a blueprint camera", () => {
    const target = { x: 20, y: 65, instruction: "against solid left wall" };
    const restored = restoreProposalRenderDraft({ sourceKey: "plan", shellSource: "upload", shellUrl: "https://example.com/room.jpg", products: [{ id: "one", product_name: "Yoma CLW Console", brand_name: "Kerstens", image_url: "https://example.com/console.jpg", target }] }, "plan");
    expect(restored?.shellSource).toBe("upload"); expect(restored?.camera).toBeNull(); expect(restored?.products[0]?.target).toEqual(target);
  });
});