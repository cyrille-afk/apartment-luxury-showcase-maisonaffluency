/**
 * Inbound Trade Applications review queue.
 *
 * User-submitted 3-step trade applications with AI Critical Radar scoring
 * and the Visual Theme Analysis frames. Admin-only — RLS is the real
 * control, the guard below is convenience.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import TradeApplicationsQueue from "@/components/trade/TradeApplicationsQueue";
import { TimeToApprovalKpi } from "@/components/trade/TimeToApproval";
import EvidenceHealthPanel from "@/components/trade/EvidenceHealthPanel";

const TradeAdminApplications = () => {
  const { user, isAdmin, loading } = useAuth();
  const enabled = !!user && isAdmin;

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <h1 className="font-serif text-2xl">403 — Forbidden</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Inbound Applications is restricted to internal administrators.
        </p>
        <Link to="/trade" className="text-sm underline underline-offset-4">
          Return to the Trade Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Inbound Applications | Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="w-full px-8 py-12 md:px-10 md:py-16">
        <div className="space-y-6"><TimeToApprovalKpi /><EvidenceHealthPanel /><TradeApplicationsQueue /></div>
      </div>
    </div>
  );
};

export default TradeAdminApplications;
