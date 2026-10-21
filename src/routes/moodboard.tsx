import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/moodboard")({
  component: () => (
    <Navigate to="/trade-program" replace />
  ),
});
