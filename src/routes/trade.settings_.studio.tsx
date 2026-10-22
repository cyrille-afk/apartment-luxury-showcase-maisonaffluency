import { createFileRoute } from "@tanstack/react-router";
import { TradeStudioSettings } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/settings_/studio")({
  head: () => ({ meta: [
    { title: "Studio Branding Settings | Maison Affluency" },
    { name: "description", content: "Manage your studio identity, logo, client PDF colours and team at Maison Affluency." },
    { property: "og:title", content: "Studio Branding Settings | Maison Affluency" },
    { property: "og:description", content: "Manage your client-facing studio branding and team preferences." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeStudioSettings />
  ),
});
