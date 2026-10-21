import { createFileRoute } from "@tanstack/react-router";
import { TradeAxonometricGallery } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/axonometric-gallery")({
  component: () => (
    <TradeAxonometricGallery />
  ),
});
