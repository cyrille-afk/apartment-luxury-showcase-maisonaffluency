import { createFileRoute } from "@tanstack/react-router";
import { TradeSamples } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/samples")({
  component: () => (
    <TradeSamples />
  ),
});
