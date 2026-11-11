import { createFileRoute } from "@tanstack/react-router";
import { TradeQuotesAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/quotes-admin")({
  head: () => ({ meta: [
    { title: "Quote Management | Maison Affluency Trade" },
    { name: "description", content: "Review submitted project quotes, save pricing and manage draft revisions." },
    { property: "og:title", content: "Quote Management | Maison Affluency Trade" },
    { property: "og:description", content: "Administrator review of project quote pricing and revisions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeQuotesAdmin />
  ),
});
