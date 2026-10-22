import { createFileRoute } from "@tanstack/react-router";
import { TradeConcierge } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/concierge")({
  head: () => ({ meta: [
    { title: "Trade Concierge | Maison Affluency" },
    { name: "description", content: "Curate catalogue selections and specifications with Felix." },
    { property: "og:title", content: "Trade Concierge | Maison Affluency" },
    { property: "og:description", content: "Curate catalogue selections and specifications with Felix." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeConcierge />
  ),
});
