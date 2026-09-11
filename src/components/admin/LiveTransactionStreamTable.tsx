import type { Region, StreamAction, StreamEvent } from "./LiveTransactionFunnelTracker";

// Badge colors use scoped `.ft-badge-*` classes (funnel-tracker.css), which
// ship in the lazy chunk's own CSS file instead of the global stylesheet.
const ACTION_META: Record<StreamAction, { label: string; badge: string; dot: string }> = {
  views: {
    label: "View",
    badge: "ft-badge-view",
    dot: "bg-zinc-400",
  },
  cart: {
    label: "Cart Add",
    badge: "ft-badge-cart",
    dot: "bg-blue-500",
  },
  checkout: {
    label: "Checkout",
    badge: "ft-badge-checkout",
    dot: "bg-amber-500",
  },
  purchases: {
    label: "Purchase",
    badge: "ft-badge-purchase",
    dot: "bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.55)]",
  },
};

const REGION_SHORT: Record<Exclude<Region, "global">, string> = {
  na: "NA",
  eu: "EU",
  apac: "APAC",
};

const formatClock = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
};

/** Data-dense webhook log table, loaded lazily so it stays out of the initial bundle. */
export default function LiveTransactionStreamTable({
  events,
  running,
}: {
  events: StreamEvent[];
  running: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              running ? "bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.55)] animate-pulse" : "bg-zinc-400"
            }`}
          />
          <h3 className="font-body text-[11px] uppercase tracking-[0.16em] text-foreground">Live Transaction Stream</h3>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          {running ? "streaming" : "paused"} · {events.length}/30
        </span>
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-muted/70 backdrop-blur">
            <tr className="font-body text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <th className="px-4 py-2 font-normal">Timestamp</th>
              <th className="px-4 py-2 font-normal">Event</th>
              <th className="px-4 py-2 font-normal text-right">Value</th>
              <th className="px-4 py-2 font-normal">Market</th>
              <th className="px-4 py-2 font-normal">Session</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {events.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center font-body text-xs text-muted-foreground">
                  Awaiting webhook payloads…
                </td>
              </tr>
            )}
            {events.map((e, i) => {
              const meta = ACTION_META[e.action];
              return (
                <tr
                  key={e.id}
                  className={`transition-colors ${
                    i === 0 ? "animate-fade-in bg-emerald-500/[0.07]" : "hover:bg-muted/40"
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatClock(e.at)}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`ft-badge ${meta.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-right font-mono text-[11px] tabular-nums text-foreground">
                    {e.valueUsd ? `$${e.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-body text-[11px] text-muted-foreground">
                    {REGION_SHORT[e.region]}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[10px] text-muted-foreground">
                    {e.token}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
