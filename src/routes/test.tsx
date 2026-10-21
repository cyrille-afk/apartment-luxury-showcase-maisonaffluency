import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/test")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
