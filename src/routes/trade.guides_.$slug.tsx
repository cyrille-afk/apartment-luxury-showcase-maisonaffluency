import { createFileRoute } from "@tanstack/react-router";
import { TradeGuideDetail } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/guides_/$slug")({
  component: () => (
    <TradeGuideDetail />
  ),
});
