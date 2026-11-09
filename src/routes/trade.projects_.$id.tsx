import { createFileRoute } from "@tanstack/react-router";
import { TradeProjectDetail } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/projects_/$id")({
  head: () => ({ meta: [
    { title: "Project Workspace | Maison Affluency" },
    { name: "description", content: "Your Maison Affluency project folder, client workspace and curated selections." },
    { property: "og:title", content: "Project Workspace | Maison Affluency" },
    { property: "og:description", content: "Your Maison Affluency project folder, client workspace and curated selections." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <TradeProjectDetail />
  ),
});
