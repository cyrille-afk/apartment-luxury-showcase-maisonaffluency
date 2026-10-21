import { createFileRoute } from "@tanstack/react-router";
import { TradeCollectiblesAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/collectibles_/admin")({
  component: () => (
    <TradeCollectiblesAdmin />
  ),
});
