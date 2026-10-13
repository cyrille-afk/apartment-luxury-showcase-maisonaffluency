import { afterEach, describe, expect, it, vi } from "vitest";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { FloatType, RGBAFormat, LinearSRGBColorSpace, EquirectangularReflectionMapping } from "three";
import { createExrEnvironmentTexture } from "./visualiserExrTexture";

describe("EXR environment texture", () => {
  afterEach(() => vi.restoreAllMocks());
  it("constructs a GPU texture from the parser pixel metadata", () => {
    const pixels = new Float32Array([1, 0.8, 0.6, 1]);
    vi.spyOn(EXRLoader.prototype, "parse").mockReturnValue({ width: 1, height: 1, data: pixels, format: RGBAFormat, type: FloatType, colorSpace: LinearSRGBColorSpace } as ReturnType<EXRLoader["parse"]>);
    const texture = createExrEnvironmentTexture(new ArrayBuffer(8));
    expect(texture.isDataTexture).toBe(true);
    expect(texture.image.data).toBe(pixels);
    expect(texture.image.width).toBe(1);
    expect(texture.mapping).toBe(EquirectangularReflectionMapping);
    expect(texture.version).toBeGreaterThan(0);
    texture.dispose();
  });
});