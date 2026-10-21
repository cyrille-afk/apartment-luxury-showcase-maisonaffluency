import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/home")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
