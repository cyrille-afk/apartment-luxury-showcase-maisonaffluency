import { createFileRoute } from "@tanstack/react-router";
import { Navigate } from "@/lib/router-compat";

export const Route = createFileRoute("/trade/boards")({
  component: () => (
    <Navigate to="/trade/projects?view=folders" replace />
  ),
});
