import { describe, expect, it } from "vitest";
import {
  ADAPTIVE_COOLDOWN_MS,
  ADAPTIVE_MIN_MEASURED,
  ADAPTIVE_MIN_SAMPLES,
  adaptiveQuality,
  adaptiveSummary,
  createAdaptiveState,
  recordSampleDuration,
  resetAdaptiveState,
  emptySampleTiming,
  measureSampleDuration,
} from "@/lib/visualiserAdaptiveSampling";
import { photorealPreset } from "@/lib/visualiserPathTracing";

const ceiling = photorealPreset("high", "high", 1.6); // 2048 samples · 150% · Full preview

const feed = (ms: number, count: number, start = 0) => {
  const state = createAdaptiveState(ceiling);
  let adjusted = false;
  for (let i = 0; i < count; i++) {
    // Space recordings beyond the cooldown so every window evaluation can adjust.
    adjusted = recordSampleDuration(state, ms, start + i * (ADAPTIVE_COOLDOWN_MS + 100)) || adjusted;
  }
  return { state, adjusted };
};

describe("visualiserAdaptiveSampling", () => {
  it("excludes tab suspension at 2500 SPP from GPU timing", () => {
    const timing = emptySampleTiming();
    measureSampleDuration(timing, 2500, 100, true);
    expect(measureSampleDuration(timing, 2501, 60100, true)).toBeNull();
    expect(measureSampleDuration(timing, 2502, 60200, true)).toBe(100);
  });
  it("measures whole samples across partial tile frames", () => {
    const timing = emptySampleTiming();
    measureSampleDuration(timing, 2500, 100, true);
    expect(measureSampleDuration(timing, 2500, 200, true)).toBeNull();
    expect(measureSampleDuration(timing, 2500, 300, true)).toBeNull();
    expect(measureSampleDuration(timing, 2501, 400, true)).toBe(300);
  });
  it("excludes hidden frames from GPU timing", () => {
    const timing = emptySampleTiming();
    measureSampleDuration(timing, 2500, 100, true);
    expect(measureSampleDuration(timing, 2500, 30100, false)).toBeNull();
  });
  it("does not adjust before enough samples are measured", () => {
    const state = createAdaptiveState(ceiling);
    for (let i = 0; i < ADAPTIVE_MIN_MEASURED - 1; i++) {
      expect(recordSampleDuration(state, 1000, i * 100)).toBe(false);
    }
    expect(state.renderScale).toBe(ceiling.renderScale);
    expect(state.adjusted).toBe(false);
  });

  it("steps resolution, preview and sample cap down on a slow GPU", () => {
    const { state, adjusted } = feed(400, ADAPTIVE_MIN_MEASURED + 1);
    expect(adjusted).toBe(true);
    expect(state.renderScale).toBeLessThan(ceiling.renderScale);
    expect(state.previewScale).toBeLessThan(ceiling.previewScale);
    expect(state.maxSamples).toBeLessThan(ceiling.maxSamples);
    expect(state.maxSamples).toBeGreaterThanOrEqual(ADAPTIVE_MIN_SAMPLES);
  });

  it("keeps stepping down while the GPU stays slow, never below the floors", () => {
    const { state } = feed(1000, 40);
    expect(state.renderScale).toBe(0.5);
    expect(state.previewScale).toBe(0.15);
    expect(state.maxSamples).toBe(ADAPTIVE_MIN_SAMPLES);
  });

  it("steps back up toward the preset on a fast GPU but never above it", () => {
    const { state } = feed(400, ADAPTIVE_MIN_MEASURED + 1);
    expect(state.adjusted).toBe(true);
    // Now the GPU gets fast: refill the window with quick samples.
    for (let i = 0; i < 60; i++) {
      recordSampleDuration(state, 20, 100_000 + i * (ADAPTIVE_COOLDOWN_MS + 100));
    }
    expect(state.renderScale).toBe(ceiling.renderScale);
    expect(state.previewScale).toBe(ceiling.previewScale);
    expect(state.maxSamples).toBe(ceiling.maxSamples);
    expect(state.adjusted).toBe(false);
  });

  it("respects the cooldown between adjustments", () => {
    const state = createAdaptiveState(ceiling);
    let firstAdjustAt = -1;
    for (let i = 0; i < ADAPTIVE_MIN_MEASURED; i++) {
      if (recordSampleDuration(state, 500, i * 10)) firstAdjustAt = i * 10;
    }
    expect(firstAdjustAt).toBeGreaterThanOrEqual(0);
    const scaleAfterFirst = state.renderScale;
    // Inside the cooldown: even very slow samples must not adjust again.
    expect(recordSampleDuration(state, 500, firstAdjustAt + 100)).toBe(false);
    expect(state.renderScale).toBe(scaleAfterFirst);
  });

  it("ignores invalid measurements", () => {
    const state = createAdaptiveState(ceiling);
    expect(recordSampleDuration(state, Number.NaN, 0)).toBe(false);
    expect(recordSampleDuration(state, -5, 0)).toBe(false);
    expect(state.durations).toHaveLength(0);
  });

  it("reset restarts measurement at the new ceiling", () => {
    const { state } = feed(400, ADAPTIVE_MIN_MEASURED + 1);
    const balanced = photorealPreset("balanced", "low", 1.6);
    const next = resetAdaptiveState(state, balanced);
    expect(next.renderScale).toBe(balanced.renderScale);
    expect(next.maxSamples).toBe(balanced.maxSamples);
    expect(next.durations).toHaveLength(0);
    expect(next.adjusted).toBe(false);
  });

  it("adaptiveQuality keeps the user's lighting choice", () => {
    const { state } = feed(400, ADAPTIVE_MIN_MEASURED + 1);
    expect(adaptiveQuality(state).lightIntensity).toBe(1.6);
  });

  it("summary reports preset until an adjustment happens", () => {
    expect(adaptiveSummary(createAdaptiveState(ceiling))).toBe("Adaptive: running at preset");
    const { state } = feed(400, ADAPTIVE_MIN_MEASURED + 1);
    expect(adaptiveSummary(state)).toContain("Adaptive: reduced to");
  });
});
