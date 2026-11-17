import { createFileRoute } from "@tanstack/react-router";
import { TradeConcierge } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/concierge_/$threadId")({
  head: () => ({ meta: [
    { title: "Felix Conversation | Maison Affluency Trade" },
    { name: "description", content: "Resume your saved Felix project conversation and curation." },
    { property: "og:title", content: "Felix Conversation | Maison Affluency Trade" },
    { property: "og:description", content: "Resume your saved Felix project conversation and curation." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <TradeConcierge />
  ),
});
