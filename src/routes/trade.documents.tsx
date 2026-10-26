import { createFileRoute } from "@tanstack/react-router";
import { TradeDocuments } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/documents")({
  head: () => ({ meta: [
    { title: "Resources | Maison Affluency Trade" },
    { name: "description", content: "Browse designer and atelier catalogues and product documentation in your Maison Affluency workspace." },
    { property: "og:title", content: "Resources | Maison Affluency Trade" },
    { property: "og:description", content: "Browse designer and atelier catalogues and product documentation in your Maison Affluency workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeDocuments />
  ),
});
