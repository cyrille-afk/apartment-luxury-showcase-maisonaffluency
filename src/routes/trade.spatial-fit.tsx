import { createFileRoute } from "@tanstack/react-router";
import { TradeSpatialFit } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/spatial-fit")({
  component: () => (
    <TradeSpatialFit />
  ),
});
