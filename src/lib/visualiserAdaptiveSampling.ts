import type { PathTraceQuality } from "@/lib/visualiserPathTracing";

/**
 * Adaptive Photoreal sampling: measures the real time per completed path-traced
 * sample and steps resolution / preview / sample cap down when the GPU cannot
 * keep the render responsive, then back up toward the chosen preset when it can.
 * The user's preset (or custom settings) is always the ceiling — adaptation
 * never raises any setting above it, and never touches scene contents.
 */

/** Render-scale ladder adaptation moves along (matches the toolbar's options). */
export const ADAPTIVE_RENDER_SCALES = [0.5, 0.6, 0.75, 0.85, 1, 1.25, 1.5, 2] as const;
/** Preview-scale ladder (matches the toolbar's Draft/Low/Medium/Full options). */
export const ADAPTIVE_PREVIEW_SCALES = [0.15, 0.25, 0.5, 1] as const;

/** Above this average per-sample cost the render feels stuck; step down. */
export const ADAPTIVE_SLOW_SAMPLE_MS = 250;
/** Below this average there is headroom; step back up toward the ceiling. */
export const ADAPTIVE_FAST_SAMPLE_MS = 60;
/** Rolling window of per-sample durations used for the average. */
export const ADAPTIVE_WINDOW = 12;
/** Measure at least this many samples before the first adjustment. */
export const ADAPTIVE_MIN_MEASURED = 8;
/** Minimum time between adjustments so the render can settle between steps. */
export const ADAPTIVE_COOLDOWN_MS = 2000;
/** Sample-cap floor when scaling the cap down; adaptation never goes below it. */
export const ADAPTIVE_MIN_SAMPLES = 128;

export interface SampleTiming { samples: number; at: number; frameAt: number }
export const emptySampleTiming = (): SampleTiming => ({ samples: -1, at: 0, frameAt: 0 });
/** Ignore suspended frames and measure complete samples, not individual tiles. */
export function measureSampleDuration(timing: SampleTiming, samples: number, now: number, visible: boolean): number | null {
  const interrupted = !visible || timing.frameAt > 0 && now - timing.frameAt > 1000;
  timing.frameAt = now;
  if (interrupted || timing.samples < 0 || samples < timing.samples) {
    timing.samples = samples; timing.at = now; return null;
  }
  if (samples <= timing.samples) return null;
  const duration = (now - timing.at) / (samples - timing.samples);
  timing.samples = samples; timing.at = now;
  return duration > 0 ? duration : null;
}

export interface AdaptiveSamplingState {
  /** The user's chosen quality — the ceiling adaptation can never exceed. */
  ceiling: PathTraceQuality;
  renderScale: number;
  previewScale: number;
  maxSamples: number;
  /** Rolling per-sample durations in ms. */
  durations: number[];
  lastAdjustAt: number;
  /** True once adaptation has moved any setting below the ceiling. */
  adjusted: boolean;
}

export const createAdaptiveState = (ceiling: PathTraceQuality): AdaptiveSamplingState => ({
  ceiling,
  renderScale: ceiling.renderScale,
  previewScale: ceiling.previewScale,
  maxSamples: ceiling.maxSamples,
  durations: [],
  // Negative so the first adjustment is allowed as soon as enough samples are measured.
  lastAdjustAt: -ADAPTIVE_COOLDOWN_MS,
  adjusted: false,
});

/** A new preset/custom choice replaces the ceiling and restarts measurement. */
export const resetAdaptiveState = (state: AdaptiveSamplingState, ceiling: PathTraceQuality): AdaptiveSamplingState =>
  createAdaptiveState(ceiling);

const stepDown = (ladder: readonly number[], value: number) => {
  const index = ladder.findIndex((step) => step >= value - 1e-6);
  return ladder[Math.max(0, (index === -1 ? ladder.length : index) - 1)];
};

const stepUp = (ladder: readonly number[], value: number, ceiling: number) => {
  const index = ladder.findIndex((step) => step > value + 1e-6);
  const next = index === -1 ? ladder[ladder.length - 1] : ladder[index];
  return Math.min(next, ceiling);
};

const average = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * Record one measured per-sample duration. Returns true when an adjustment was
 * applied (the caller must restart accumulation because resolution changed).
 */
export function recordSampleDuration(state: AdaptiveSamplingState, msPerSample: number, now: number): boolean {
  if (!Number.isFinite(msPerSample) || msPerSample <= 0) return false;
  state.durations.push(msPerSample);
  if (state.durations.length > ADAPTIVE_WINDOW) state.durations.shift();
  if (state.durations.length < ADAPTIVE_MIN_MEASURED) return false;
  if (now - state.lastAdjustAt < ADAPTIVE_COOLDOWN_MS) return false;

  const avg = average(state.durations);
  if (avg > ADAPTIVE_SLOW_SAMPLE_MS) {
    state.renderScale = stepDown(ADAPTIVE_RENDER_SCALES, state.renderScale);
    state.previewScale = stepDown(ADAPTIVE_PREVIEW_SCALES, state.previewScale);
    if (state.maxSamples > 0) state.maxSamples = Math.max(ADAPTIVE_MIN_SAMPLES, Math.round(state.maxSamples * 0.75));
    state.lastAdjustAt = now;
    state.adjusted = true;
    return true;
  }
  if (avg < ADAPTIVE_FAST_SAMPLE_MS && state.adjusted) {
    state.renderScale = stepUp(ADAPTIVE_RENDER_SCALES, state.renderScale, state.ceiling.renderScale);
    state.previewScale = stepUp(ADAPTIVE_PREVIEW_SCALES, state.previewScale, state.ceiling.previewScale);
    if (state.ceiling.maxSamples > 0) {
      state.maxSamples = state.maxSamples > 0 ? Math.min(state.ceiling.maxSamples, Math.round(state.maxSamples / 0.75)) : state.ceiling.maxSamples;
    }
    state.lastAdjustAt = now;
    state.adjusted =
      state.renderScale < state.ceiling.renderScale - 1e-6 ||
      state.previewScale < state.ceiling.previewScale - 1e-6 ||
      (state.ceiling.maxSamples > 0 && state.maxSamples < state.ceiling.maxSamples);
    return true;
  }
  return false;
}

/** The quality the tracer should run at right now. */
export const adaptiveQuality = (state: AdaptiveSamplingState): PathTraceQuality => ({
  previewScale: state.previewScale,
  maxSamples: state.maxSamples,
  renderScale: state.renderScale,
  lightIntensity: state.ceiling.lightIntensity,
});

/** One-line readout for the preset menu footer. */
export const adaptiveSummary = (state: AdaptiveSamplingState): string =>
  state.adjusted
    ? `Adaptive: reduced to ${Math.round(state.renderScale * 100)}% resolution · ${state.maxSamples > 0 ? `${state.maxSamples} samples` : "unlimited samples"}`
    : "Adaptive: running at preset";
