import { createFileRoute } from "@tanstack/react-router";
import { TradeSamples } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/samples")({
  head: () => ({ meta: [
    { title: "Sample Requests — Maison Affluency Trade" },
    { name: "description", content: "Request and track product and material samples for your studio projects." },
    { property: "og:title", content: "Sample Requests — Maison Affluency Trade" },
    { property: "og:description", content: "Request and track product and material samples for your studio projects." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeSamples />
  ),
});
