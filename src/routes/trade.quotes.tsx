import { createFileRoute } from "@tanstack/react-router";
import { TradeQuotes } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/quotes")({
  head: () => ({ meta: [
    { title: "Quotes & Proformas | Maison Affluency" },
    { name: "description", content: "Manage project quotations, client documents and procurement billing." },
    { property: "og:title", content: "Quotes & Proformas | Maison Affluency" },
    { property: "og:description", content: "Manage project quotations, client documents and procurement billing." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeQuotes />
  ),
});
