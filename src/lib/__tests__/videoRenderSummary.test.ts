import { describe, expect, it } from "vitest";
import { formatUsdCents, summarizeVideoRenders, type VideoRenderRecord, formatSecondsDelta, formatUsdCentsDelta, videoRenderDelta } from "../videoRenderSummary";

const job = (over: Partial<VideoRenderRecord>): VideoRenderRecord => ({
  job_id: over.job_id ?? "job",
  state: over.state ?? "completed",
  video_url: "video_url" in over ? over.video_url : "https://example.com/v.mp4",
  failure: over.failure ?? null,
  created_at: over.created_at ?? "2026-10-09T02:00:00Z",
  quality: over.quality ?? "720p",
  render_seconds: over.render_seconds ?? 24,
  cost_usd: over.cost_usd ?? null,
});

describe("summarizeVideoRenders", () => {
  it("totals billed cost and averages per billed render", () => {
    const s = summarizeVideoRenders([
      job({ job_id: "a", cost_usd: 0.35 }),
      job({ job_id: "b", cost_usd: 0.6 }),
      job({ job_id: "c", cost_usd: 1.2 }),
    ]);
    expect(s.renderCount).toBe(3);
    expect(s.billedCount).toBe(3);
    expect(s.totalCostCents).toBe(215);
    expect(s.averageCostCents).toBe(72); // 2.15 / 3 = 0.7167 -> $0.72
    expect(s.unbilledCount).toBe(0);
  });

  it("sums without floating-point drift across many renders", () => {
    const s = summarizeVideoRenders(
      Array.from({ length: 10 }, (_, i) => job({ job_id: `j${i}`, cost_usd: 0.07 })),
    );
    expect(s.totalCostCents).toBe(70); // 0.07 * 10 === 0.7000000000000001 in floats
    expect(s.averageCostCents).toBe(7);
  });

  it("ignores renders with no recorded cost", () => {
    const s = summarizeVideoRenders([
      job({ job_id: "a", cost_usd: 0.6 }),
      job({ job_id: "b", cost_usd: null }),
      job({ job_id: "c", cost_usd: undefined }),
    ]);
    expect(s.renderCount).toBe(3);
    expect(s.billedCount).toBe(1);
    expect(s.totalCostCents).toBe(60);
    expect(s.averageCostCents).toBe(60);
    expect(s.unbilledCount).toBe(2);
  });

  it("has no average when nothing was billed", () => {
    const s = summarizeVideoRenders([job({ job_id: "a", cost_usd: null })]);
    expect(s.totalCostCents).toBe(0);
    expect(s.averageCostCents).toBeNull();
  });

  it("counts ready and failed renders separately from billed ones", () => {
    const s = summarizeVideoRenders([
      job({ job_id: "a", cost_usd: 0.35 }),
      job({ job_id: "b", video_url: null, state: "failed", failure: "Render failed", cost_usd: null }),
    ]);
    expect(s.readyCount).toBe(1);
    expect(s.failedCount).toBe(1);
    expect(s.billedCount).toBe(1);
  });

  it("rejects negative or non-finite costs", () => {
    const s = summarizeVideoRenders([
      job({ job_id: "a", cost_usd: -1 }),
      job({ job_id: "b", cost_usd: Number.NaN }),
    ]);
    expect(s.billedCount).toBe(0);
    expect(s.totalCostCents).toBe(0);
    expect(s.averageCostCents).toBeNull();
  });
});

describe("formatUsdCents", () => {
  it("renders two decimals", () => {
    expect(formatUsdCents(72)).toBe("$0.72");
    expect(formatUsdCents(215)).toBe("$2.15");
    expect(formatUsdCents(1200)).toBe("$12.00");
    expect(formatUsdCents(0)).toBe("$0.00");
  });
});

describe("videoRenderDelta", () => {
  it("computes positive and negative deltas against the quality estimate", () => {
    expect(videoRenderDelta({ quality: "720p", render_seconds: 27, cost_usd: 0.7 })).toEqual({ secondsDelta: 2, costCentsDelta: 10 });
    expect(videoRenderDelta({ quality: "540p", render_seconds: 10, cost_usd: 0.3 })).toEqual({ secondsDelta: -5, costCentsDelta: -5 });
  });
  it("falls back to the 720p estimate for unknown qualities", () => {
    expect(videoRenderDelta({ quality: "4k", render_seconds: 25, cost_usd: 0.6 })).toEqual({ secondsDelta: 0, costCentsDelta: 0 });
  });
  it("returns null deltas when actuals are missing", () => {
    expect(videoRenderDelta({ quality: "1080p", render_seconds: null, cost_usd: null })).toEqual({ secondsDelta: null, costCentsDelta: null });
  });
});

describe("delta formatting", () => {
  it("formats signed seconds and cents", () => {
    expect(formatSecondsDelta(2)).toBe("+2s");
    expect(formatSecondsDelta(-5)).toBe("−5s");
    expect(formatSecondsDelta(0)).toBe("±0s");
    expect(formatUsdCentsDelta(10)).toBe("+$0.10");
    expect(formatUsdCentsDelta(-5)).toBe("−$0.05");
  });
});
