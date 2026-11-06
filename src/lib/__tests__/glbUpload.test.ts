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
import { prepareGlbFile, uploadGlbForProduct, normalizeSizeToCm, formatDimensionLabel, canApplyMeasuredDimensions, measureGlbDimensions } from "@/lib/glbUpload";

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
  it("converts confirmed metres", () =>
    expect(normalizeSizeToCm({ x: 1.08, y: 0.75, z: 1.08 }, "m")).toEqual({ wCm: 108, dCm: 108, hCm: 75 }));
  it("converts confirmed millimetres", () =>
    expect(normalizeSizeToCm({ x: 1680, y: 740, z: 1080 }, "mm")).toEqual({ wCm: 168, dCm: 108, hCm: 74 }));
  it("keeps confirmed centimetres", () =>
    expect(normalizeSizeToCm({ x: 128, y: 75, z: 108 }, "cm")).toEqual({ wCm: 128, dCm: 108, hCm: 75 }));
  it("does not misread a 300 mm lamp as 300 cm", () =>
    expect(normalizeSizeToCm({ x: 300, y: 300, z: 300 }, "mm")).toEqual({ wCm: 30, dCm: 30, hCm: 30 }));
  it("does not infer unknown source units", () => expect(normalizeSizeToCm({ x: 300, y: 300, z: 300 })).toBeNull());
  it("does not measure a file without confirmed source units", async () => expect(await measureGlbDimensions(new File(["invalid"], "lamp.glb"))).toBeNull());
  it("converts confirmed inches", () => expect(normalizeSizeToCm({ x: 10, y: 10, z: 10 }, "in")).toEqual({ wCm: 25.4, dCm: 25.4, hCm: 25.4 }));
  it("rejects empty boxes", () => expect(normalizeSizeToCm({ x: 0, y: 0, z: 0 }, "m")).toBeNull());
  it("rejects invalid axes", () => expect(normalizeSizeToCm({ x: NaN, y: 1, z: 1 }, "m")).toBeNull());
});

describe("dimension label precedence", () => {
  it("protects filename W × D × H", () => expect(canApplyMeasuredDimensions({ label: "W 95 × D 77 × H 75" })).toBe(false));
  it("protects partial filename sizes", () => expect(canApplyMeasuredDimensions({ label: "W 168" })).toBe(false));
  it("protects manual labels, including Default", () => expect(canApplyMeasuredDimensions({ label: "Default", labelTouched: true })).toBe(false));
  it("allows measuring a placeholder", () => expect(canApplyMeasuredDimensions({ label: "Default" })).toBe(true));
  it("allows remeasuring a confirmed measurement", () => expect(canApplyMeasuredDimensions({ label: "W 30 × D 30 × H 30", measured: { wCm: 30, dCm: 30, hCm: 30 } })).toBe(true));
});

describe("formatDimensionLabel", () => {
  it("matches the admin W × D convention", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 108, hCm: 75 })).toBe("W 108 × D 108 × H 75"));
  it("defaults to centimetres", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 108, hCm: 75 }, "cm")).toBe("W 108 × D 108 × H 75"));
  it("reads out millimetres when the admin picks mm", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 108, hCm: 75 }, "mm")).toBe("W 1080 × D 1080 × H 750 mm"));
  it("converts to inches at one decimal when the admin picks in", () =>
    expect(formatDimensionLabel({ wCm: 108, dCm: 77, hCm: 75 }, "in")).toBe("W 42.5 × D 30.3 × H 29.5 in"));
});
