/**
 * Premium editorial skeleton for the Checkout Order Summary panel.
 *
 * Mirrors the real financial summary block with shape blocks and a soft
 * Tailwind pulse shimmer while product assets, FX multipliers and trade
 * discount calculations settle into local context.
 */
export function OrderSummarySkeleton() {
  return (
    <aside className="lg:sticky lg:top-[calc(var(--header-h)+2rem)] h-fit">
      <div className="border border-border/70 bg-zinc-50 px-7 py-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="h-6 w-40 animate-pulse rounded-sm bg-zinc-200/80" />
          <div className="h-5 w-16 animate-pulse rounded-sm bg-zinc-200/80" />
        </div>

        {/* Product line placeholders */}
        <ul className="mt-6 space-y-4">
          {[1, 2].map((i) => (
            <li
              key={i}
              className="flex gap-4 border-b border-border/60 pb-4 last:border-0 last:pb-0"
            >
              <div className="w-16 shrink-0 self-start">
                <div className="aspect-square w-full animate-pulse rounded-sm bg-zinc-200/80" />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-20 animate-pulse rounded-sm bg-zinc-200/80" />
                <div className="h-4 w-3/4 animate-pulse rounded-sm bg-zinc-200/80" />
                <div className="h-3 w-1/2 animate-pulse rounded-sm bg-zinc-200/80" />
              </div>
              <div className="shrink-0 space-y-2 text-right">
                <div className="h-4 w-20 animate-pulse rounded-sm bg-zinc-200/80" />
              </div>
            </li>
          ))}
        </ul>

        {/* Financial rows */}
        <dl className="mt-7 space-y-4 border-t border-border pt-6 font-body text-sm">
          <SummaryRow label="Subtotal" />
          <SummaryRow label="Front Door Premium Delivery" />
          <SummaryRow label="Taxes" />
        </dl>

        {/* Total row */}
        <div className="mt-6 border-t-2 border-foreground pt-5">
            <div className="flex items-baseline justify-between">
              <span className="font-medium uppercase text-[11px] tracking-[0.2em] text-black">
                Total Due
              </span>
              <div className="h-5 w-28 animate-pulse rounded-sm bg-zinc-300" />
            </div>
          </div>

          {/* Payment method marks */}
          <div className="mt-8 flex items-center justify-center gap-10">
            <div className="h-6 w-10 animate-pulse rounded-sm bg-zinc-200/80" />
            <div className="h-6 w-10 animate-pulse rounded-sm bg-zinc-200/80" />
            <div className="h-6 w-10 animate-pulse rounded-sm bg-zinc-200/80" />
          </div>
        </div>
      </aside>
    );
  }
  
  function SummaryRow({ label }: { label: string }) {
    return (
      <div className="flex items-baseline justify-between">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="h-4 w-20 animate-pulse rounded-sm bg-zinc-200/80" aria-hidden="true" />
      </div>
    );
  }
