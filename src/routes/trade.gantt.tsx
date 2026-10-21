import { createFileRoute } from "@tanstack/react-router";
import { TradeGanttTimeline } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/gantt")({
  component: () => (
    <TradeGanttTimeline />
  ),
});
