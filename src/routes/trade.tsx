import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { TradeErrorBoundary, TradeLayout } from "@/app/legacyShell";
import { guardStudioSetupRoute } from "@/lib/studioSetupRouteGuard";

// Shown when the trade route's beforeLoad (session/studio/role reads) fails
// after its own retries — e.g. a dropped connection or a brief outage. Gives
// the member a clear way forward instead of the generic app crash screen.
function TradeRouteRecovery() {
  const next = `${window.location.pathname}${window.location.search}`;
  return (
    <div role="alert" className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="font-body text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Maison Affluency — Trade Portal</p>
        <h1 className="mt-4 font-display text-3xl text-foreground">We couldn't load your trade settings</h1>
        <p className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
          Your session or studio settings didn't come through — usually a brief connection hiccup.
          Nothing has been lost: your account, tier, projects and quotes are safe.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <a
            href={`/trade/login?next=${encodeURIComponent(next)}`}
            className="inline-flex items-center justify-center rounded-full border border-border px-6 py-2.5 font-body text-[11px] uppercase tracking-[0.2em] text-foreground transition-opacity hover:opacity-80"
          >
            Sign in again
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/trade")({
  ssr: false,
  beforeLoad: ({ location, preload }) => guardStudioSetupRoute({ pathname: location.pathname, search: location.searchStr, preload }),
  errorComponent: TradeRouteRecovery,
  component: () => (
    <Suspense fallback={null}><TradeErrorBoundary><TradeLayout /></TradeErrorBoundary></Suspense>
  ),
});
