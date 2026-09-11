/**
 * Lightweight pulse skeleton used as the Suspense fallback for lazily loaded,
 * data-dense admin panels. Zinc palette, no dependencies, near-zero JS cost.
 */
export default function AdminPanelSkeleton({
  rows = 4,
  height = "h-64",
}: {
  rows?: number;
  height?: string;
}) {
  return (
    <div className="animate-pulse rounded-2xl border border-zinc-200/70 bg-zinc-50/60 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="h-3 w-40 rounded-sm bg-zinc-200 dark:bg-zinc-800" />
      <div className={`mt-4 w-full rounded-xl bg-zinc-200/70 dark:bg-zinc-800/70 ${height}`} />
      <div className="mt-4 space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-3 w-full rounded-sm bg-zinc-200/70 dark:bg-zinc-800/60" />
        ))}
      </div>
    </div>
  );
}
