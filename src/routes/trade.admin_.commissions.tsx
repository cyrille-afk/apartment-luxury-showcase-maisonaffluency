import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/trade/admin_/commissions")({
  component: () => (
    <Navigate to="/trade/admin/procurement-ledger" replace />
  ),
});
