import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareAiRenderImages } from "./aiRenderImages";
afterEach(() => vi.unstubAllGlobals());
describe("render product image transport", () => {
  it("embeds the selected local coffee table photo across placements and overlays once", async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(["coffee table"], { type: "image/png" }) });
    vi.stubGlobal("fetch", fetcher);
    const photo = "/src/assets/curators-picks/man-of-parts-coffee-table.png";
    const payload = { placements: [{ image_url: photo, product_name: "Praia da Granja Coffee Table" }], overlayImages: [photo] };
    const prepared = await prepareAiRenderImages(payload);
    expect(prepared.placements[0]?.image_url).toBe("data:image/png;base64,Y29mZmVlIHRhYmxl");
    expect(prepared.overlayImages[0]).toBe(prepared.placements[0]?.image_url);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(payload.placements[0]?.image_url).toBe(photo);
  });
  it("keeps cloud image links and non-image copy unchanged", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    const payload = { imageUrl: "https://example.com/cloud.png", userPrompt: "/src/assets/not-an-image" };
    expect(await prepareAiRenderImages(payload)).toEqual(payload);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects inaccessible preview images before spending a generation", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await expect(prepareAiRenderImages({ imageUrl: "/src/assets/missing.png" })).rejects.toThrow("could not be loaded");
  });
});