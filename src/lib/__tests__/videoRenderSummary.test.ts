import { describe, expect, it } from "vitest";

describe("monthlyCostBreakdown", () => {
  it("groups billed costs by UTC month, newest first", () => {
    const months = monthlyCostBreakdown([
      job({ job_id: "a", created_at: "2026-10-09T02:00:00Z", cost_usd: 0.6 }),
      job({ job_id: "b", created_at: "2026-10-01T23:30:00Z", cost_usd: 0.35 }),
      job({ job_id: "c", created_at: "2026-09-15T12:00:00Z", cost_usd: 1.2 }),
    ]);
    expect(months).toEqual([
      { monthKey: "2026-10", label: "Oct 2026", billedCount: 2, totalCostCents: 95 },
      { monthKey: "2026-09", label: "Sep 2026", billedCount: 1, totalCostCents: 120 },
    ]);
  });
  it("skips renders with no recorded cost or unparseable dates", () => {
    const months = monthlyCostBreakdown([
      job({ job_id: "a", cost_usd: null }),
      job({ job_id: "b", created_at: "not-a-date", cost_usd: 0.6 }),
    ]);
    expect(months).toEqual([]);
  });
});
import { filterVideoRendersByMonth, formatUsdCents, monthlyCostBreakdown, previousVideoRenderMonthKey, renderExceedsEstimate, summarizeVideoRenders, type VideoRenderRecord, formatSecondsDelta, formatUsdCentsDelta, videoRenderDelta, videoRenderMonthComparison, videoRenderMonthKey, videoRenderMonthLabel, videoRenderMonthOptions, VIDEO_RENDER_MONTH_ALL, videoRenderOverrun, videoRenderChartSeries } from "../videoRenderSummary";

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

describe("videoRenderOverrun / renderExceedsEstimate", () => {
  it("computes over-estimate percentages", () => {
    expect(videoRenderOverrun({ quality: "720p", render_seconds: 30, cost_usd: 0.72 })).toEqual({ secondsOverPct: 20, costOverPct: 20 });
    expect(videoRenderOverrun({ quality: "540p", render_seconds: 10, cost_usd: 0.3 })).toEqual({ secondsOverPct: -33, costOverPct: -14 });
  });
  it("returns null when actuals are missing", () => {
    expect(videoRenderOverrun({ quality: "1080p", render_seconds: null, cost_usd: null })).toEqual({ secondsOverPct: null, costOverPct: null });
  });
  it("flags renders over the threshold on either axis", () => {
    const over = { quality: "720p", render_seconds: 40, cost_usd: 0.6 };
    expect(renderExceedsEstimate(over, 20)).toBe(true);
    expect(renderExceedsEstimate(over, 70)).toBe(false);
    expect(renderExceedsEstimate({ quality: "720p", render_seconds: null, cost_usd: null }, 0)).toBe(false);
  });
});

describe("month filter", () => {
  it("derives the UTC month key and label", () => {
    expect(videoRenderMonthKey("2026-10-09T02:00:00Z")).toBe("2026-10");
    expect(videoRenderMonthKey("2026-09-30T23:59:59Z")).toBe("2026-09");
    expect(videoRenderMonthKey("not-a-date")).toBeNull();
    expect(videoRenderMonthLabel("2026-10")).toBe("Oct 2026");
  });

  it("lists every month in the history, unbilled renders included, newest first", () => {
    const options = videoRenderMonthOptions([
      job({ job_id: "a", created_at: "2026-10-09T02:00:00Z", cost_usd: 0.6 }),
      job({ job_id: "b", created_at: "2026-10-01T23:30:00Z", cost_usd: null }),
      job({ job_id: "c", created_at: "2026-08-15T12:00:00Z", cost_usd: 1.2 }),
      job({ job_id: "d", created_at: "not-a-date", cost_usd: 0.35 }),
    ]);
    expect(options).toEqual([
      { monthKey: "2026-10", label: "Oct 2026" },
      { monthKey: "2026-08", label: "Aug 2026" },
    ]);
  });

  it("keeps only the selected month's renders", () => {
    const jobs = [
      job({ job_id: "a", created_at: "2026-10-09T02:00:00Z", cost_usd: 0.6 }),
      job({ job_id: "b", created_at: "2026-10-01T23:30:00Z", cost_usd: null }),
      job({ job_id: "c", created_at: "2026-09-15T12:00:00Z", cost_usd: 1.2 }),
    ];
    expect(filterVideoRendersByMonth(jobs, "2026-10").map((j) => j.job_id)).toEqual(["a", "b"]);
    expect(filterVideoRendersByMonth(jobs, "2026-07")).toEqual([]);
  });

  it("returns every render for the all-months sentinel", () => {
    const jobs = [job({ job_id: "a" }), job({ job_id: "b", created_at: "not-a-date" })];
    expect(filterVideoRendersByMonth(jobs, VIDEO_RENDER_MONTH_ALL).map((j) => j.job_id)).toEqual(["a", "b"]);
    expect(filterVideoRendersByMonth(jobs, "").map((j) => j.job_id)).toEqual(["a", "b"]);
  });

  it("drops renders with unparseable dates when a month is selected", () => {
    const jobs = [job({ job_id: "a", created_at: "not-a-date" })];
    expect(filterVideoRendersByMonth(jobs, "2026-10")).toEqual([]);
  });

  it("summary figures follow the selected month", () => {
    const jobs = [
      job({ job_id: "a", created_at: "2026-10-09T02:00:00Z", cost_usd: 0.6 }),
      job({ job_id: "b", created_at: "2026-10-01T23:30:00Z", cost_usd: 0.35 }),
      job({ job_id: "c", created_at: "2026-09-15T12:00:00Z", cost_usd: 1.2 }),
    ];
    const october = filterVideoRendersByMonth(jobs, "2026-10");
    expect(summarizeVideoRenders(october)).toMatchObject({ renderCount: 2, billedCount: 2, totalCostCents: 95 });
    expect(monthlyCostBreakdown(october)).toEqual([
      { monthKey: "2026-10", label: "Oct 2026", billedCount: 2, totalCostCents: 95 },
    ]);
  });
});

describe("month-over-month comparison", () => {
  it("rolls the previous month back across years", () => {
    expect(previousVideoRenderMonthKey("2026-10")).toBe("2026-09");
    expect(previousVideoRenderMonthKey("2027-01")).toBe("2026-12");
    expect(previousVideoRenderMonthKey(VIDEO_RENDER_MONTH_ALL)).toBeNull();
    expect(previousVideoRenderMonthKey("junk")).toBeNull();
  });

  it("compares render counts and billed costs against the previous month", () => {
    const jobs = [
      job({ job_id: "a", created_at: "2026-10-09T02:00:00Z", cost_usd: 0.7 }),
      job({ job_id: "b", created_at: "2026-10-02T10:00:00Z", cost_usd: 0.35 }),
      job({ job_id: "c", created_at: "2026-10-05T10:00:00Z", cost_usd: null }),
      job({ job_id: "d", created_at: "2026-09-15T12:00:00Z", cost_usd: 1.2 }),
    ];
    const comparison = videoRenderMonthComparison(jobs, "2026-10");
    expect(comparison).toMatchObject({
      monthKey: "2026-10",
      label: "Oct 2026",
      previousMonthKey: "2026-09",
      previousLabel: "Sep 2026",
      renderCount: 3,
      previousRenderCount: 1,
      renderCountDelta: 2,
      billedCount: 2,
      previousBilledCount: 1,
      totalCostCents: 105,
      previousTotalCostCents: 120,
      costCentsDelta: -15,
    });
  });

  it("reports a null cost delta when the previous month has no renders", () => {
    const jobs = [job({ job_id: "a", created_at: "2026-10-09T02:00:00Z", cost_usd: 0.6 })];
    const comparison = videoRenderMonthComparison(jobs, "2026-10");
    expect(comparison).toMatchObject({
      renderCount: 1,
      previousRenderCount: 0,
      renderCountDelta: 1,
      costCentsDelta: null,
    });
  });

  it("returns null for the all-months sentinel and invalid keys", () => {
    const jobs = [job({ job_id: "a" })];
    expect(videoRenderMonthComparison(jobs, VIDEO_RENDER_MONTH_ALL)).toBeNull();
    expect(videoRenderMonthComparison(jobs, "junk")).toBeNull();
  });
});

describe("videoRenderChartSeries", () => {
  it("plots every render per month, oldest first, with billed costs summed in cents", () => {
    const jobs = [
      job({ job_id: "oct-a", created_at: "2026-10-08T10:00:00Z", cost_usd: 0.7 }),
      job({ job_id: "sep-a", created_at: "2026-09-15T10:00:00Z", cost_usd: 1.2 }),
      job({ job_id: "oct-b", created_at: "2026-10-05T10:00:00Z", cost_usd: 0.35 }),
      job({ job_id: "oct-c", created_at: "2026-10-01T10:00:00Z" }), // unbilled still counts
    ];
    expect(videoRenderChartSeries(jobs)).toEqual([
      { monthKey: "2026-09", label: "Sep 2026", renderCount: 1, totalCostCents: 120 },
      { monthKey: "2026-10", label: "Oct 2026", renderCount: 3, totalCostCents: 105 },
    ]);
  });

  it("skips unparseable dates and returns [] for empty history", () => {
    expect(videoRenderChartSeries([job({ job_id: "a", created_at: "not-a-date", cost_usd: 1 })])).toEqual([]);
    expect(videoRenderChartSeries([])).toEqual([]);
  });
});
