import { createFileRoute } from "@tanstack/react-router";
import { TradeQuotes } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/quotes")({
  component: () => (
    <TradeQuotes />
  ),
});
