import { createFileRoute } from "@tanstack/react-router";
import { TradeGallery } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/gallery_/$slug")({
  component: () => (
    <TradeGallery />
  ),
});
