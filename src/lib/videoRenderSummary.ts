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
