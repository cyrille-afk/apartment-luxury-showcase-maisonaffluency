import { createFileRoute } from "@tanstack/react-router";
import { TradeDescriptionWriter } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/description-writer")({
  component: () => (
    <TradeDescriptionWriter />
  ),
});
