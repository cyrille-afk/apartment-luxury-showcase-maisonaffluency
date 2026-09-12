import React from 'react';

/**
 * Initial-load placeholder for the checkout order summary.
 *
 * Mirrors the real summary's wrapper (sticky aside + bordered panel) so the
 * swap to real content doesn't shift the layout, and uses neutral rows only —
 * never invented line labels.
 */
export function OrderSummarySkeleton({ isLoading, children }: { isLoading: boolean; children: React.ReactNode }) {
  if (!isLoading) return <>{children}</>;

  return (
    <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] h-fit" aria-busy="true">
      <div className="border border-border/70 px-7 py-8 animate-pulse">
        <div className="h-6 w-40 rounded-sm bg-muted" />

        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-4 w-44 rounded-sm bg-muted" />
                <div className="h-3 w-28 rounded-sm bg-muted/60" />
              </div>
              <div className="h-4 w-16 rounded-sm bg-muted" />
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-3 border-t border-border/70 pt-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-24 rounded-sm bg-muted/60" />
              <div className="h-3 w-16 rounded-sm bg-muted" />
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-baseline justify-between border-t border-border/70 pt-6">
          <div className="h-4 w-20 rounded-sm bg-muted" />
          <div className="h-6 w-28 rounded-sm bg-muted" />
        </div>

        <div className="mt-6 h-12 w-full rounded-sm bg-muted" />
      </div>
    </aside>
  );
}
