import { createFileRoute } from "@tanstack/react-router";
import { TradeFairCalendar } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/calendar")({
  component: () => (
    <TradeFairCalendar />
  ),
});
