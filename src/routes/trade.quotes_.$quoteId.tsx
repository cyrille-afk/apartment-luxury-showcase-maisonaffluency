import { createFileRoute } from "@tanstack/react-router";
import { TradeQuotes } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/quotes_/$quoteId")({
  head: () => ({ meta: [
    { title: "Quote Editor — Maison Affluency Trade" },
    { name: "description", content: "Review and prepare your selected catalogue pieces and client quote." },
    { property: "og:title", content: "Quote Editor — Maison Affluency Trade" },
    { property: "og:description", content: "Review and prepare your selected catalogue pieces and client quote." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeQuotes />
  ),
});
