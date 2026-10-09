// Aggregate billing figures for the walkthrough render history.
// Money is summed in integer cents so repeated renders cannot drift through
// floating-point addition, then converted back for display.

export type VideoRenderRecord = {
  job_id: string;
  state: string;
  video_url: string | null;
  failure: string | null;
  created_at: string;
  quality?: string | null;
  render_seconds?: number | null;
  cost_usd?: number | null;
};

export type VideoRenderSummary = {
  /** Every render in the history, billed or not. */
  renderCount: number;
  /** Renders that carry a recorded billed cost. */
  billedCount: number;
  readyCount: number;
  failedCount: number;
  /** Sum of recorded billed costs, in cents. */
  totalCostCents: number;
  /** totalCostCents / billedCount, rounded to the nearest cent. Null when nothing billed. */
  averageCostCents: number | null;
  /** Renders with no recorded billed cost yet (older rows, failed or in-flight renders). */
  unbilledCount: number;
};

const toCents = (value: number | null | undefined): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
};

export function summarizeVideoRenders(jobs: readonly VideoRenderRecord[]): VideoRenderSummary {
  let totalCostCents = 0;
  let billedCount = 0;
  let readyCount = 0;
  let failedCount = 0;

  for (const job of jobs) {
    if (job.video_url) readyCount += 1;
    else if (job.failure || job.state === "failed") failedCount += 1;
    const cents = toCents(job.cost_usd);
    if (cents !== null) {
      totalCostCents += cents;
      billedCount += 1;
    }
  }

  return {
    renderCount: jobs.length,
    billedCount,
    readyCount,
    failedCount,
    totalCostCents,
    averageCostCents: billedCount > 0 ? Math.round(totalCostCents / billedCount) : null,
    unbilledCount: jobs.length - billedCount,
  };
}

/** $1.20 style label from an integer-cent amount. */
export function formatUsdCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export type VideoRenderMonth = {
  /** "2026-10" UTC month key, used for sorting. */
  monthKey: string;
  /** "Oct 2026" style display label. */
  label: string;
  billedCount: number;
  totalCostCents: number;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Sentinel month key meaning "no month filter applied". */
export const VIDEO_RENDER_MONTH_ALL = "all";

/** "2026-10" UTC month key for a render, or null when the date is unparseable. */
export function videoRenderMonthKey(createdAt: string): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "Oct 2026" style label from a "2026-10" month key. */
export function videoRenderMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Every UTC calendar month present in the history — billed or not — newest first.
 * Used to populate the month filter.
 */
export function videoRenderMonthOptions(jobs: readonly Pick<VideoRenderRecord, "created_at">[]): { monthKey: string; label: string }[] {
  const keys = new Set<string>();
  for (const job of jobs) {
    const key = videoRenderMonthKey(job.created_at);
    if (key) keys.add(key);
  }
  return [...keys]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((monthKey) => ({ monthKey, label: videoRenderMonthLabel(monthKey) }));
}

/** Renders whose UTC month matches monthKey; VIDEO_RENDER_MONTH_ALL (or blank) returns them all. */
export function filterVideoRendersByMonth<T extends Pick<VideoRenderRecord, "created_at">>(
  jobs: readonly T[],
  monthKey: string,
): T[] {
  if (!monthKey || monthKey === VIDEO_RENDER_MONTH_ALL) return [...jobs];
  return jobs.filter((job) => videoRenderMonthKey(job.created_at) === monthKey);
}

/** "2026-09" for "2026-10"; rolls back across years. Null for the all-months sentinel or junk. */
export function previousVideoRenderMonthKey(monthKey: string): string | null {
  if (!monthKey || monthKey === VIDEO_RENDER_MONTH_ALL) return null;
  const [year, month] = monthKey.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
}

export type VideoRenderMonthComparison = {
  monthKey: string;
  label: string;
  /** Previous calendar month key, or null when monthKey is invalid/all. */
  previousMonthKey: string | null;
  previousLabel: string | null;
  /** All renders in each month, billed or not. */
  renderCount: number;
  previousRenderCount: number;
  renderCountDelta: number;
  /** Billed totals per month; deltas are null when the previous month has no history at all. */
  billedCount: number;
  previousBilledCount: number;
  totalCostCents: number;
  previousTotalCostCents: number;
  costCentsDelta: number | null;
};

/**
 * Month-over-month comparison: the selected month against the previous calendar
 * month. Render counts include every render; cost figures only count billed
 * renders. When the previous month has no renders at all, costCentsDelta is
 * null so the UI can say "no prior month" instead of showing a misleading
 * −100% drop.
 */
export function videoRenderMonthComparison(
  jobs: readonly VideoRenderRecord[],
  monthKey: string,
): VideoRenderMonthComparison | null {
  const previousMonthKey = previousVideoRenderMonthKey(monthKey);
  if (!previousMonthKey) return null;

  const current = filterVideoRendersByMonth(jobs, monthKey);
  const previous = filterVideoRendersByMonth(jobs, previousMonthKey);
  const currentSummary = summarizeVideoRenders(current);
  const previousSummary = summarizeVideoRenders(previous);

  return {
    monthKey,
    label: videoRenderMonthLabel(monthKey),
    previousMonthKey,
    previousLabel: videoRenderMonthLabel(previousMonthKey),
    renderCount: currentSummary.renderCount,
    previousRenderCount: previousSummary.renderCount,
    renderCountDelta: currentSummary.renderCount - previousSummary.renderCount,
    billedCount: currentSummary.billedCount,
    previousBilledCount: previousSummary.billedCount,
    totalCostCents: currentSummary.totalCostCents,
    previousTotalCostCents: previousSummary.totalCostCents,
    costCentsDelta:
      previousSummary.renderCount > 0
        ? currentSummary.totalCostCents - previousSummary.totalCostCents
        : null,
  };
}

/**
 * Billed render costs grouped by UTC calendar month, newest month first.
 * Renders without a recorded cost are excluded; unparseable dates are skipped.
 */
export function monthlyCostBreakdown(jobs: readonly VideoRenderRecord[]): VideoRenderMonth[] {
  const byMonth = new Map<string, { billedCount: number; totalCostCents: number }>();
  for (const job of jobs) {
    const cents = toCents(job.cost_usd);
    if (cents === null) continue;
    const key = videoRenderMonthKey(job.created_at);
    if (!key) continue;
    const entry = byMonth.get(key) ?? { billedCount: 0, totalCostCents: 0 };
    entry.billedCount += 1;
    entry.totalCostCents += cents;
    byMonth.set(key, entry);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([monthKey, entry]) => ({ monthKey, label: videoRenderMonthLabel(monthKey), ...entry }));
}

export type VideoRenderChartPoint = {
  /** "2026-10" UTC month key. */
  monthKey: string;
  /** "Oct 2026" style display label. */
  label: string;
  /** Every render that month, billed or not. */
  renderCount: number;
  /** Sum of recorded billed costs that month, in cents. */
  totalCostCents: number;
};

/**
 * Monthly render counts and billed costs, oldest month first — the series the
 * history chart plots. Unlike monthlyCostBreakdown this counts every render,
 * not just billed ones, so months with only failed/unbilled renders still show.
 */
export function videoRenderChartSeries(jobs: readonly VideoRenderRecord[]): VideoRenderChartPoint[] {
  const byMonth = new Map<string, { renderCount: number; totalCostCents: number }>();
  for (const job of jobs) {
    const key = videoRenderMonthKey(job.created_at);
    if (!key) continue;
    const entry = byMonth.get(key) ?? { renderCount: 0, totalCostCents: 0 };
    entry.renderCount += 1;
    const cents = toCents(job.cost_usd);
    if (cents !== null) entry.totalCostCents += cents;
    byMonth.set(key, entry);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([monthKey, entry]) => ({ monthKey, label: videoRenderMonthLabel(monthKey), ...entry }));
}

// Rough Luma estimates for a 5s 16:9 walkthrough, mirroring VIDEO_QUALITY_OPTIONS
// on the AI layout page. Unknown qualities fall back to the 720p estimate, the
// same fallback the video-generate route applies server-side.
const QUALITY_ESTIMATES: Record<string, { seconds: number; costCents: number }> = {
  "540p": { seconds: 15, costCents: 35 },
  "720p": { seconds: 25, costCents: 60 },
  "1080p": { seconds: 45, costCents: 120 },
};

export type VideoRenderDelta = {
  /** actual render_seconds minus the estimate; null when no actual recorded. */
  secondsDelta: number | null;
  /** actual billed cost minus the estimate, in cents; null when no cost recorded. */
  costCentsDelta: number | null;
};

/** How far a render's recorded actuals sit from its quality estimate. */
export function videoRenderDelta(job: Pick<VideoRenderRecord, "quality" | "render_seconds" | "cost_usd">): VideoRenderDelta {
  const estimate = QUALITY_ESTIMATES[job.quality ?? ""] ?? QUALITY_ESTIMATES["720p"];
  const cents = toCents(job.cost_usd);
  return {
    secondsDelta:
      typeof job.render_seconds === "number" && Number.isFinite(job.render_seconds)
        ? Math.round(job.render_seconds) - estimate.seconds
        : null,
    costCentsDelta: cents !== null ? cents - estimate.costCents : null,
  };
}

export type VideoRenderOverrun = {
  /** % by which actual render time exceeds the estimate; null when no actual recorded. */
  secondsOverPct: number | null;
  /** % by which billed cost exceeds the estimate; null when no cost recorded. */
  costOverPct: number | null;
};

/**
 * How far a render's actuals exceed its estimate, as rounded percentages.
 * Negative values mean the render came in under estimate.
 */
export function videoRenderOverrun(job: Pick<VideoRenderRecord, "quality" | "render_seconds" | "cost_usd">): VideoRenderOverrun {
  const estimate = QUALITY_ESTIMATES[job.quality ?? ""] ?? QUALITY_ESTIMATES["720p"];
  const cents = toCents(job.cost_usd);
  return {
    secondsOverPct:
      typeof job.render_seconds === "number" && Number.isFinite(job.render_seconds)
        ? Math.round(((job.render_seconds - estimate.seconds) / estimate.seconds) * 100)
        : null,
    costOverPct: cents !== null ? Math.round(((cents - estimate.costCents) / estimate.costCents) * 100) : null,
  };
}

/** True when either actual exceeds its estimate by more than thresholdPct (e.g. 20 = 20%). */
export function renderExceedsEstimate(job: Pick<VideoRenderRecord, "quality" | "render_seconds" | "cost_usd">, thresholdPct: number): boolean {
  const over = videoRenderOverrun(job);
  return (over.secondsOverPct ?? -Infinity) > thresholdPct || (over.costOverPct ?? -Infinity) > thresholdPct;
}

/** "+2s" / "−5s" style signed label. */
export function formatSecondsDelta(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${Math.abs(Math.round(delta))}s`;
}

/** "+$0.10" / "−$0.05" style signed label from integer cents. */
export function formatUsdCentsDelta(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "±";
  const abs = Math.abs(Math.round(cents));
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
