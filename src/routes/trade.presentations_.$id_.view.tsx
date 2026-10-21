import { createFileRoute } from "@tanstack/react-router";
import { TradePresentationViewer } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/presentations_/$id_/view")({
  component: () => (
    <TradePresentationViewer />
  ),
});
