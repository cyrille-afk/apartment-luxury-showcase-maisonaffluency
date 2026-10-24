import { createFileRoute } from "@tanstack/react-router";
import { TradeQuoteReview } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/quotes_/$quoteId_/review")({
  head: () => ({ meta: [
    { title: "Quote Pricing Review — Maison Affluency Trade" },
    { name: "description", content: "Inspect the selected pieces, quantities and recorded prices in your quote." },
    { property: "og:title", content: "Quote Pricing Review — Maison Affluency Trade" },
    { property: "og:description", content: "Inspect the selected pieces, quantities and recorded prices in your quote." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeQuoteReview />
  ),
});
