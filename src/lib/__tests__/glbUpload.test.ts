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
import { prepareGlbFile, uploadGlbForProduct } from "@/lib/glbUpload";

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