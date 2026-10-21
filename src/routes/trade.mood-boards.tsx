import { createFileRoute } from "@tanstack/react-router";
import { TradeMoodBoards } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/mood-boards")({
  component: () => (
    <TradeMoodBoards />
  ),
});
