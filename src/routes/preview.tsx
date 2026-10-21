import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/preview")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
