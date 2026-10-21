import { createFileRoute } from "@tanstack/react-router";
import { TradeFavoriteFolderDetail } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/favorites_/folders_/$id")({
  component: () => (
    <TradeFavoriteFolderDetail />
  ),
});
