import { createFileRoute } from "@tanstack/react-router";
import { TradeAdminOgPipeline } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin_/og-pipeline")({
  component: () => (
    <TradeAdminOgPipeline />
  ),
});
