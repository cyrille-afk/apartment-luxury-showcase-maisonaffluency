import { createFileRoute } from "@tanstack/react-router";
import { TradeMyDashboard } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/me")({
  head: () => ({ meta: [
    { title: "Studio invitations & My Dashboard — Maison Affluency" },
    { name: "description", content: "Review your studio invitation and manage your Maison Affluency account." },
    { property: "og:title", content: "Studio invitations & My Dashboard — Maison Affluency" },
    { property: "og:description", content: "Review your studio invitation and manage your Maison Affluency account." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeMyDashboard />
  ),
});
