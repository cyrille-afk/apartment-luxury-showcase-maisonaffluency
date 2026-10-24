import { createFileRoute } from "@tanstack/react-router";
import { TradeFavorites } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/favorites")({
  head: () => ({ meta: [
    { title: "Saved Pieces & Folders — Maison Affluency Trade" },
    { name: "description", content: "Organize your saved catalogue pieces into room, project and design folders." },
    { property: "og:title", content: "Saved Pieces & Folders — Maison Affluency Trade" },
    { property: "og:description", content: "Organize your saved catalogue pieces into room, project and design folders." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeFavorites />
  ),
});
