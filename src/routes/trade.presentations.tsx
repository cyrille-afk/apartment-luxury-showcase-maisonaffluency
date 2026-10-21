import { createFileRoute } from "@tanstack/react-router";
import { TradePresentations } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/presentations")({
  component: () => (
    <TradePresentations />
  ),
});
