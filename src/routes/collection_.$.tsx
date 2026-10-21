import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/collection_/$")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
