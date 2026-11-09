import { createFileRoute } from "@tanstack/react-router";
import { TradeBoardBuilder } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/boards_/$id")({
  head: () => ({ meta: [
    { title: "Project Folder | Maison Affluency" },
    { name: "description", content: "Your Maison Affluency project folder and client selections." },
    { property: "og:title", content: "Project Folder | Maison Affluency" },
    { property: "og:description", content: "Your Maison Affluency project folder and client selections." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <TradeBoardBuilder />
  ),
});
