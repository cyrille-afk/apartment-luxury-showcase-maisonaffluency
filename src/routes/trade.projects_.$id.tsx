import { createFileRoute } from "@tanstack/react-router";
import { TradeProjectDetail } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/projects_/$id")({
  component: () => (
    <TradeProjectDetail />
  ),
});
