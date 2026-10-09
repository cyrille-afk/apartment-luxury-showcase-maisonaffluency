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

/**
 * Billed render costs grouped by UTC calendar month, newest month first.
 * Renders without a recorded cost are excluded; unparseable dates are skipped.
 */
export function monthlyCostBreakdown(jobs: readonly VideoRenderRecord[]): VideoRenderMonth[] {
  const byMonth = new Map<string, { billedCount: number; totalCostCents: number }>();
  for (const job of jobs) {
    const cents = toCents(job.cost_usd);
    if (cents === null) continue;
    const date = new Date(job.created_at);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const entry = byMonth.get(key) ?? { billedCount: 0, totalCostCents: 0 };
    entry.billedCount += 1;
    entry.totalCostCents += cents;
    byMonth.set(key, entry);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([monthKey, entry]) => {
      const [year, month] = monthKey.split("-").map(Number);
      return { monthKey, label: `${MONTH_NAMES[month - 1]} ${year}`, ...entry };
    });
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
