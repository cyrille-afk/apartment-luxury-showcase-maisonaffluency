import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/admin_/client-acquisitions")({
  component: () => (
    <Navigate to="/trade/admin/client-acquisitions" replace />
  ),
});
