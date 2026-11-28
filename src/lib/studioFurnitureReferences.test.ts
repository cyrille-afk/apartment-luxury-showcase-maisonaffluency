import { describe, expect, it, vi } from "vitest";
import { fetchStudioPhoto, fullResolutionStudioUrl, studioFurnitureInputs } from "../../supabase/functions/_shared/studioFurnitureReferences";
import type { RoomFurnitureReference } from "../../supabase/functions/_shared/roomFurnitureEditing";

const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 20, 30, 40, 50]);
const response = () => new Response(bytes, { headers: { "content-type": "image/png" } });
const pieces: RoomFurnitureReference[] = ["Yoma CLW Console", "Rift CTS", "Mono STS", "GUM left", "GUM right"].map((product_name, i) => ({ product_name, image_url: `https://res.cloudinary.com/studio/image/upload/c_fill,w_200,h_200,q_auto/v1/piece-${i}.png` }));

describe("original studio photo references", () => {
  it("removes thumbnail delivery transforms without changing the asset, version or material edits", () => {
    expect(fullResolutionStudioUrl(pieces[0]?.image_url ?? "")).toBe("https://res.cloudinary.com/studio/image/upload/v1/piece-0.png");
    expect(fullResolutionStudioUrl("https://res.cloudinary.com/studio/image/upload/c_fill,w_200/e_grayscale/v7/chairs/gum.png")).toBe("https://res.cloudinary.com/studio/image/upload/e_grayscale/v7/chairs/gum.png");
    expect(fullResolutionStudioUrl("https://res.cloudinary.com/studio/image/upload/kerstens_rift_cts/photo.jpg")).toBe("https://res.cloudinary.com/studio/image/upload/kerstens_rift_cts/photo.jpg");
  });
  it("embeds the original fetched bytes without resizing or recompressing", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const encoded = await fetchStudioPhoto(pieces[0]?.image_url ?? "", "Yoma", fetcher);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://res.cloudinary.com/studio/image/upload/v1/piece-0.png");
    expect(Uint8Array.from(atob(encoded.split(",")[1] ?? ""), char => char.charCodeAt(0))).toEqual(bytes);
  });
  it("attaches every one of five selected primary images before any finish or angle image", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const swatch = "https://res.cloudinary.com/studio/image/upload/c_crop,x_20,y_40,w_70,h_70/v1/linen.png";
    const inputs = await studioFurnitureInputs(pieces.map((p, i) => i ? p : { ...p, selected_finishes: [{ axis: "Fabric", name: "Linen", image_url: swatch }], secondary_image_urls: ["https://example.com/side.png"] }), fetcher);
    const images = inputs.filter(p => p.type === "image_url");
    expect(images).toHaveLength(7);
    expect(fetcher.mock.calls.slice(0, 5).map(call => call[0])).toEqual(pieces.map(p => fullResolutionStudioUrl(p.image_url)));
    expect(fetcher.mock.calls[5]?.[0]).toBe(swatch); // Preserve the selected crop, not the whole supplier sheet.
    expect(fetcher.mock.calls[6]?.[0]).toBe("https://example.com/side.png");
    expect(inputs.slice(0, 10).map(p => p.type)).toEqual(Array.from({ length: 5 }, () => ["text", "image_url"]).flat());
  });
  it("keeps all ten selected references, including repeated instances of the same piece", async () => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const inputs = await studioFurnitureInputs([...pieces, ...pieces], fetcher);
    expect(inputs.filter(p => p.type === "image_url")).toHaveLength(10);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it("single-item correction attaches only the chosen piece and its selected finish", async () => {
    const target = pieces[1];
    if (!target) throw new Error("Missing Rift test fixture");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => response());
    const inputs = await studioFurnitureInputs([{ ...target, selected_finishes: [{ axis: "Top", name: "Oak", image_url: "https://example.com/oak.png" }] }], fetcher);
    expect(inputs.filter(p => p.type === "image_url")).toHaveLength(2);
    expect(fetcher.mock.calls.map(call => call[0])).toEqual([fullResolutionStudioUrl(target.image_url), "https://example.com/oak.png"]);
  });
  it("fails on an unavailable product photo rather than falling back to its text name", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("missing", { status: 404 }));
    await expect(studioFurnitureInputs(pieces, fetcher)).rejects.toThrow("studio photo could not be loaded");
    await expect(studioFurnitureInputs([{ product_name: "Generic chair", image_url: "" }], fetcher)).rejects.toThrow();
  });
  it("fails on an unavailable selected swatch rather than silently omitting it", async () => {
    const target = pieces[0];
    if (!target) throw new Error("Missing Yoma test fixture");
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => String(url).includes("missing") ? new Response("missing", { status: 404 }) : response());
    await expect(studioFurnitureInputs([{ ...target, selected_finishes: [{ axis: "Wood", name: "Elm", image_url: "https://example.com/missing.png" }] }], fetcher)).rejects.toThrow("studio photo could not be loaded");
  });
  it("rejects non-image bytes and private/redirected URLs", async () => {
    await expect(fetchStudioPhoto("http://127.0.0.1/a.png", "Chair")).rejects.toThrow("public HTTPS");
    await expect(fetchStudioPhoto("https://example.com/a", "Chair", vi.fn<typeof fetch>().mockResolvedValue(new Response("html")))).rejects.toThrow("not a supported product image");
    await expect(fetchStudioPhoto("https://example.com/a", "Chair", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302 })))).rejects.toThrow("could not be loaded");
  });
});