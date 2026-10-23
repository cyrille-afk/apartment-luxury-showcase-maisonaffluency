import { createFileRoute } from "@tanstack/react-router";
import { TradeDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/")({
  head: () => ({ meta: [
    { title: "Trade Studio Dashboard | Maison Affluency" },
    { name: "description", content: "Manage your Maison Affluency trade studio, project folders and quotes." },
    { property: "og:title", content: "Trade Studio Dashboard | Maison Affluency" },
    { property: "og:description", content: "Manage your Maison Affluency trade studio, project folders and quotes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeDashboard />
  ),
});
