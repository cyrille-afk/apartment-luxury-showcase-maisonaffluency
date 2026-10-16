import { describe, it, expect } from "vitest";
import { classifyGpu, photorealPreset, matchPhotorealPreset, GPU_TIER_LABEL, PHOTOREAL_PRESET_LABEL, photorealPresetSettings, sampleCountLabel, renderScaleLabel, previewScaleLabel, photorealQualitySummary } from "../visualiserPathTracing";

describe("Photoreal presets", () => {
  it("classifies software GPUs as low and discrete as high", () => {
    expect(classifyGpu("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device))")).toBe("low");
    expect(classifyGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070)")).toBe("high");
  });
  it("balanced on a low GPU uses 256 samples at 75%", () => {
    expect(photorealPreset("balanced", "low")).toMatchObject({ maxSamples: 256, renderScale: 0.75, previewScale: 0.25 });
  });
  it("high quality on a high GPU uses 2048 samples at 150%", () => {
    expect(photorealPreset("high", "high")).toMatchObject({ maxSamples: 2048, renderScale: 1.5 });
  });
  it("keeps the chosen light and detects custom settings", () => {
    expect(photorealPreset("high", "mid", 2).lightIntensity).toBe(2);
    expect(matchPhotorealPreset(photorealPreset("balanced", "mid"), "mid")).toBe("balanced");
    expect(matchPhotorealPreset({ ...photorealPreset("balanced", "mid"), maxSamples: 64 }, "mid")).toBe("custom");
  });
});
