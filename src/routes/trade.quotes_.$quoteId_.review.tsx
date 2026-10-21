import { createFileRoute } from "@tanstack/react-router";
import { TradeQuoteReview } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/quotes_/$quoteId_/review")({
  component: () => (
    <TradeQuoteReview />
  ),
});
