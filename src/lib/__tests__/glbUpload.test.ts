import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ insert: vi.fn(), update: vi.fn(), eq: vi.fn(), convertObj: vi.fn(), convert3ds: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "https://assets.example/current.glb" } }) }) },
  from: () => ({ insert: mocks.insert, update: mocks.update }),
} }));
vi.mock("@/lib/objToGlb", () => ({
  classifyObjBundle: (files: File[]) => files.some(f => /\.obj$/i.test(f.name)) ? { objFile: files.find(f => /\.obj$/i.test(f.name)) } : null,
  convertObjBundleToGlb: mocks.convertObj,
  convert3dsToGlb: mocks.convert3ds,
}));
import { prepareGlbFile, uploadGlbForProduct, normalizeSizeToCm, formatDimensionLabel } from "@/lib/glbUpload";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insert.mockResolvedValue({ error: null });
  mocks.eq.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.convertObj.mockResolvedValue(new File(["converted"], "model.glb"));
  mocks.convert3ds.mockResolvedValue(new File(["converted"], "model.glb"));
});

describe("original 3D upload provenance", () => {
  it.each(["glb", "gltf", "3ds"] as const)("records original %s before conversion", async format => {
    const prepared = await prepareGlbFile([new File(["source"], `original.${format.toUpperCase()}`)]);
    expect(prepared.originalFormat).toBe(format);
    expect(prepared.originalFilenames).toEqual([`original.${format.toUpperCase()}`]);
    expect(prepared.ext).toBe(format === "gltf" ? "gltf" : "glb");
  });
  it("retains OBJ format and companion names on insertion", async () => {
    const names = ["chair.OBJ", "chair.mtl", "wood.jpg"];
    const prepared = await prepareGlbFile(names.map(name => new File(["source"], name)));
    await uploadGlbForProduct({ productId: "product", label: "Default", prepared, existingVariants: [] });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ original_upload_format: "obj", original_upload_filenames: names }));
    expect(prepared.ext).toBe("glb");
  });
  it("replaces source metadata when replacing a variant", async () => {
    const prepared = await prepareGlbFile([new File(["source"], "replacement.glb")]);
    await uploadGlbForProduct({ productId: "product", label: "Default", prepared, existingVariants: [{ id: "variant", variant_label: "Default", is_default: true }] });
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ original_upload_format: "glb", original_upload_filenames: ["replacement.glb"] }));
    expect(mocks.eq).toHaveBeenCalledWith("id", "variant");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
describe("normalizeSizeToCm", () => {
  it("treats small sizes as metres", () =>
    expect(normalizeSizeToCm({ x: 1.08, y: 0.75, z: 1.08 })).toEqual({ wCm: 108, dCm: 108, hCm: 75 }));
  it("treats large sizes as millimetres", () =>
    expect(normalizeSizeToCm({ x: 1680, y: 740, z: 1080 })).toEqual({ wCm: 168, dCm: 108, hCm: 74 }));
  it("keeps mid-range sizes as centimetres", () =>
    expect(normalizeSizeToCm({ x: 128, y: 75, z: 108 })).toEqual({ wCm: 128, dCm: 108, hCm: 75 }));
  it("rejects empty boxes", () => expect(normalizeSizeToCm({ x: 0, y: 0, z: 0 })).toBeNull());
});

describe("formatDimensionLabel", () => {
  it("matches the admin W × D convention", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 108, hCm: 75 })).toBe("W 108 × D 108"));
  it("defaults to centimetres", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 108, hCm: 75 }, "cm")).toBe("W 108 × D 108"));
  it("reads out millimetres when the admin picks mm", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 108, hCm: 75 }, "mm")).toBe("W 1080 × D 1080 mm"));
  it("converts to inches at one decimal when the admin picks in", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 77, hCm: 75 }, "in")).toBe("W 42.5 × D 30.3 in"));
});
