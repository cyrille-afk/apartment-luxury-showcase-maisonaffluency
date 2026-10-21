import { createFileRoute } from "@tanstack/react-router";
import { TradeSpatialFitAudit } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/spatial-fit_/audit")({
  component: () => (
    <TradeSpatialFitAudit />
  ),
});
