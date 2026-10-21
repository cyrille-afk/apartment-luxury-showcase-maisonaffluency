import { createFileRoute } from "@tanstack/react-router";
import { TradeJournal } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/journal")({
  component: () => (
    <TradeJournal />
  ),
});
