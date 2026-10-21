import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/trade/admin_/trade-review")({
  component: () => (
    <Navigate to="/trade/admin/trade-applications" replace />
  ),
});
