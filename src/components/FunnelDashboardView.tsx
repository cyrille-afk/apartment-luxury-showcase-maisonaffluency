import { Suspense, lazy } from "react";
import { Helmet } from "react-helmet-async";
import AdminPanelSkeleton from "@/components/admin/AdminPanelSkeleton";
// Scoped styles for the funnel dashboard tables/badges. Imported here (inside
// the lazy chunk) so they ship in a separate CSS file and never bloat the
// global index stylesheet.
import "./admin/funnel-tracker.css";

const LiveTransactionFunnelTracker = lazy(
  () => import("@/components/admin/LiveTransactionFunnelTracker")
);

/**
 * Complete Live Transaction Funnel dashboard view. Loaded exclusively via
 * React.lazy from TradeAdminFunnelTracker so the whole panel — charting
 * vendor code included — stays out of the main index bundle.
 */
export default function FunnelDashboardView() {
  return (
    <>
      <Helmet>
        <title>Funnel Tracker — Trade Portal — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-2xl text-foreground">Live Transaction Funnel Tracker</h1>
          <p className="font-body text-sm text-muted-foreground mt-1">
            Model views, cart adds, checkout and purchases across markets.
          </p>
        </div>
        <Suspense fallback={<AdminPanelSkeleton rows={4} height="h-56" />}>
          <LiveTransactionFunnelTracker />
        </Suspense>
      </div>
    </>
  );
}
