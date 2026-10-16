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
  it("labels the detected graphics class and the presets", () => {
    expect(GPU_TIER_LABEL.low).toBe("Low");
    expect(GPU_TIER_LABEL.high).toBe("High");
    expect(PHOTOREAL_PRESET_LABEL.balanced).toBe("Balanced");
    expect(PHOTOREAL_PRESET_LABEL.high).toBe("High Quality");
  });
  it("shows the same settings the preset applies", () => {
    expect(photorealPresetSettings("balanced", "low")).toMatchObject({ maxSamples: 256, renderScale: 0.75, previewScale: 0.25 });
    expect(sampleCountLabel(256)).toBe("256 samples");
    expect(sampleCountLabel(0)).toBe("Unlimited samples");
    expect(renderScaleLabel(0.75)).toBe("75%");
    expect(renderScaleLabel(1.5)).toBe("150%");
    expect(previewScaleLabel(0.25)).toBe("Low");
    expect(previewScaleLabel(1)).toBe("Full");
  });
  it("summarises the active sampling and resolution", () => {
    expect(photorealQualitySummary(photorealPreset("high", "high", 1))).toBe("2048 samples · 150% resolution · Low preview");
    expect(photorealQualitySummary({ ...photorealPreset("balanced", "mid"), maxSamples: 0 })).toContain("Unlimited samples");
  });
});
