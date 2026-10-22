import { createFileRoute } from "@tanstack/react-router";
import { TradeCustomRequests } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/custom-requests")({
  head: () => ({ meta: [
    { title: "Bespoke Requests | Maison Affluency" },
    { name: "description", content: "Track custom specifications and atelier responses." },
    { property: "og:title", content: "Bespoke Requests | Maison Affluency" },
    { property: "og:description", content: "Track custom specifications and atelier responses." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeCustomRequests />
  ),
});
