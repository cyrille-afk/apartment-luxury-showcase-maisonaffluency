import { createFileRoute } from "@tanstack/react-router";
import { TradeLeadTimeCalendar } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/lead-time-calendar")({
  component: () => (
    <TradeLeadTimeCalendar />
  ),
});
