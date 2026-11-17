import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const single = vi.fn();
  const select = vi.fn(() => ({ single }));
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  const insert = vi.fn(() => ({ select }));
  return {
    single,
    select,
    eq,
    update,
    insert,
    upload: vi.fn(),
    remove: vi.fn(),
    compress: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: mocks.upload,
        remove: mocks.remove,
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://assets.example/${path}` } }),
      }),
    },
    from: () => ({ insert: mocks.insert, update: mocks.update }),
  },
}));
vi.mock("@/lib/catalogGlbCompression", () => ({ compressCatalogGlb: mocks.compress }));

import { uploadCatalogGlb, validateCatalogItemDetails } from "@/lib/catalogGlbUpload";

const details = {
  sku: "MA-TEST-001",
  name: "Compression Test Chair",
  designer: "Test Studio",
  category_role: "lounge_chair",
  room_type: ["Living"],
  width_m: 0.8,
  depth_m: 0.85,
  height_m: 0.75,
  base_price_sgd: 1200,
  base_lead_time_weeks: 8,
};
const record = { ...details, id: "catalog-id", glb_url_compressed: "https://assets.example/model.glb", glb_url_proxy: null };

beforeEach(() => {
  vi.clearAllMocks();
  const raw = new File(["raw"], "chair.glb", { type: "model/gltf-binary" });
  const optimized = new File(["optimized"], "chair-compressed.glb", { type: "model/gltf-binary" });
  mocks.compress.mockResolvedValue({ file: optimized, originalBytes: raw.size, compressedBytes: optimized.size, textureCount: 1 });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
  mocks.single.mockResolvedValue({ data: record, error: null });
});

describe("catalog GLB upload", () => {
  it("uploads only the browser-compressed GLB and saves its public URL on a new item", async () => {
    const raw = new File(["raw"], "chair.glb", { type: "model/gltf-binary" });
    const stages: string[] = [];
    const result = await uploadCatalogGlb({ file: raw, details, onStage: (stage) => stages.push(stage) });

    expect(mocks.compress).toHaveBeenCalledWith(raw);
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^catalog-items\/ma-test-001\/\d+-chair-compressed\.glb$/);
    expect(mocks.upload.mock.calls[0][1].name).toBe("chair-compressed.glb");
    expect(mocks.upload.mock.calls[0][2]).toMatchObject({ contentType: "model/gltf-binary", upsert: false });
    expect(mocks.insert).toHaveBeenCalledWith({ ...details, glb_url_compressed: result.publicUrl });
    expect(result.publicUrl).toContain("/catalog-items/ma-test-001/");
    expect(stages).toEqual(["compressing", "uploading", "saving"]);
  });

  it("updates only the compressed URL when replacing an existing catalog item model", async () => {
    await uploadCatalogGlb({ file: new File(["raw"], "chair.glb"), details, itemId: "catalog-id" });
    expect(mocks.update).toHaveBeenCalledWith({ glb_url_compressed: expect.stringContaining("https://assets.example/catalog-items/") });
    expect(mocks.eq).toHaveBeenCalledWith("id", "catalog-id");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("removes an orphaned upload when the database save fails", async () => {
    mocks.single.mockResolvedValue({ data: null, error: new Error("save failed") });
    await expect(uploadCatalogGlb({ file: new File(["raw"], "chair.glb"), details })).rejects.toThrow("save failed");
    expect(mocks.remove).toHaveBeenCalledWith([expect.stringMatching(/^catalog-items\/ma-test-001\//)]);
  });
});

describe("catalog item validation", () => {
  it("requires real positive dimensions", () => {
    expect(() => validateCatalogItemDetails({ ...details, width_m: 0 })).toThrow("Width, depth, and height");
  });
  it("requires at least one room", () => {
    expect(() => validateCatalogItemDetails({ ...details, room_type: [] })).toThrow("at least one room");
  });
  it("requires a whole non-negative lead time", () => {
    expect(() => validateCatalogItemDetails({ ...details, base_lead_time_weeks: 1.5 })).toThrow("whole number of weeks");
  });
});
