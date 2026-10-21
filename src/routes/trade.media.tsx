import { createFileRoute } from "@tanstack/react-router";
import { TradeMediaLibrary } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/media")({
  component: () => (
    <TradeMediaLibrary />
  ),
});
