import { createFileRoute } from "@tanstack/react-router";
import { TradePresentationBuilder } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/presentations_/$id")({
  component: () => (
    <TradePresentationBuilder />
  ),
});
