import { createFileRoute } from "@tanstack/react-router";
import { TradeGuides } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/guides")({
  component: () => (
    <TradeGuides />
  ),
});
