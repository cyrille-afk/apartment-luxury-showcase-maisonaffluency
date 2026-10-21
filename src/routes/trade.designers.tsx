import { createFileRoute } from "@tanstack/react-router";
import { TradeDesigners } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/designers")({
  component: () => (
    <TradeDesigners />
  ),
});
