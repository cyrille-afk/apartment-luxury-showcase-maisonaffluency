import { createFileRoute } from "@tanstack/react-router";
import { TradeFavorites } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/favorites")({
  component: () => (
    <TradeFavorites />
  ),
});
