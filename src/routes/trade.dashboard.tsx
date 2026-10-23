import { createFileRoute } from "@tanstack/react-router";
import { TradeDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/dashboard")({
  head: () => ({ meta: [
    { title: "Trade Dashboard Overview | Maison Affluency" },
    { name: "description", content: "Browse your Maison Affluency studio collections, recent activity, resources and active projects." },
    { property: "og:title", content: "Trade Dashboard Overview | Maison Affluency" },
    { property: "og:description", content: "Browse your Maison Affluency studio collections, recent activity, resources and active projects." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeDashboard />
  ),
});
