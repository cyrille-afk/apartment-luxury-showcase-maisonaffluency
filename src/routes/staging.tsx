import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/staging")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
