import React, { Suspense } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminPanelSkeleton from "@/components/admin/AdminPanelSkeleton";

// Explicit dynamic import: the entire funnel dashboard (Recharts panel +
// Live Transaction Stream table) lives in its own chunk and never lands in
// the main index bundle.
const FunnelDashboardView = React.lazy(() => import("@/components/FunnelDashboardView"));

export default function TradeAdminFunnelTracker() {
  const { isAdmin, loading } = useAuth();
  if (loading) return null;
  if (!isAdmin) return <Navigate to="/trade" replace />;

  return (
    <Suspense fallback={<AdminPanelSkeleton rows={4} height="h-56" />}>
      <FunnelDashboardView />
    </Suspense>
  );
}
