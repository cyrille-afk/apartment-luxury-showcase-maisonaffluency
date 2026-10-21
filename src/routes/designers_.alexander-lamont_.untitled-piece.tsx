import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/designers_/alexander-lamont_/untitled-piece")({
  component: () => (
    <Navigate to="/designers/alexander-lamont/geo-table-lamp" replace />
  ),
});
