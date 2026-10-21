import { createFileRoute } from "@tanstack/react-router";
import { TradeBoardBuilder } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/boards_/$id")({
  component: () => (
    <TradeBoardBuilder />
  ),
});
