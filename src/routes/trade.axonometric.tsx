import { createFileRoute } from "@tanstack/react-router";
import { Navigate, useLocation } from "@/lib/router-compat";

function RedirectToAiRenderStudio() {
  const location = useLocation();
  return <Navigate to={`/tools/ai-render-studio${location.search || ""}`} replace />;
}

export const Route = createFileRoute("/trade/axonometric")({
  component: RedirectToAiRenderStudio,
});
