import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/index.html")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
