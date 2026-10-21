import { createFileRoute } from "@tanstack/react-router";
import { TradeProjects } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/projects")({
  component: () => (
    <TradeProjects />
  ),
});
