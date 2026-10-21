import { createFileRoute } from "@tanstack/react-router";
import { TradeFFESchedule } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/ffe-schedule")({
  component: () => (
    <TradeFFESchedule />
  ),
});
