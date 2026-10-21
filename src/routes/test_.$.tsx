import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/test_/$")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
