import { createFileRoute } from "@tanstack/react-router";
import { TradeTools } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/tools")({
  head: () => ({ meta: [
    { title: "Trade Tools | Maison Affluency" },
    { name: "description", content: "Access sourcing, specification and procurement tools for your studio." },
    { property: "og:title", content: "Trade Tools | Maison Affluency" },
    { property: "og:description", content: "Access sourcing, specification and procurement tools for your studio." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeTools />
  ),
});
