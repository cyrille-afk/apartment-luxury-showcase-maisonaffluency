import { createFileRoute } from "@tanstack/react-router";
import { BetaFeedboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/beta-feedboard")({
  component: () => (
    <BetaFeedboard />
  ),
});
