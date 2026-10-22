import { createFileRoute } from "@tanstack/react-router";
import { TradeProjects } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/projects")({
  head: () => ({ meta: [
    { title: "Studio Projects | Maison Affluency" },
    { name: "description", content: "Organise client engagements and project folders." },
    { property: "og:title", content: "Studio Projects | Maison Affluency" },
    { property: "og:description", content: "Organise client engagements and project folders." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeProjects />
  ),
});
