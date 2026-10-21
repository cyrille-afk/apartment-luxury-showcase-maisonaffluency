import { createFileRoute } from "@tanstack/react-router";
import { TradeReorder } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/reorder")({
  component: () => (
    <TradeReorder />
  ),
});
