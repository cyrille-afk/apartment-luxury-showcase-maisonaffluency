import { Helmet } from "react-helmet-async";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import LiveTransactionFunnelTracker from "@/components/admin/LiveTransactionFunnelTracker";

export default function TradeAdminFunnelTracker() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

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
        <LiveTransactionFunnelTracker />
      </div>
    </>
  );
}
