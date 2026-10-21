import { createFileRoute } from "@tanstack/react-router";
import { LegacyRouteRedirect } from "@/app/legacyShell";

export const Route = createFileRoute("/index.php")({
  component: () => (
    <LegacyRouteRedirect to="/designers" />
  ),
});
