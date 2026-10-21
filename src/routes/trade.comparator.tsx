import { createFileRoute } from "@tanstack/react-router";
import { TradeComparator } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/comparator")({
  component: () => (
    <TradeComparator />
  ),
});
