import { createFileRoute } from "@tanstack/react-router";
import { TradeSettings } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/settings")({
  head: () => ({ meta: [
    { title: "Trade Account Settings | Maison Affluency" },
    { name: "description", content: "Manage your Maison Affluency trade account, studio preferences and partner tier progress." },
    { property: "og:title", content: "Trade Account Settings | Maison Affluency" },
    { property: "og:description", content: "Manage your trade account, studio preferences and partner tier progress." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeSettings />
  ),
});
