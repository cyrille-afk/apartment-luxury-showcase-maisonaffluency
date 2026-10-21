import { createFileRoute } from "@tanstack/react-router";
import { TradeBudgetTracker } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/budget")({
  component: () => (
    <TradeBudgetTracker />
  ),
});
