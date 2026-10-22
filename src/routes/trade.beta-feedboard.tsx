import { createFileRoute } from "@tanstack/react-router";
import { BetaFeedboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/beta-feedboard")({
  head: () => ({ meta: [
    { title: "Beta Feedback | Maison Affluency" },
    { name: "description", content: "Report studio workflow issues and share product ideas." },
    { property: "og:title", content: "Beta Feedback | Maison Affluency" },
    { property: "og:description", content: "Report studio workflow issues and share product ideas." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <BetaFeedboard />
  ),
});
