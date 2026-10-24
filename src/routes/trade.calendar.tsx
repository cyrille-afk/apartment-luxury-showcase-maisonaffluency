import { createFileRoute } from "@tanstack/react-router";
import { TradeFairCalendar } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/calendar")({
  head: () => ({ meta: [
    { title: "Gallery & Trade Fair Calendar | Maison Affluency" },
    { name: "description", content: "Collectible design Gallery events and international trade fairs for Maison Affluency partners." },
    { property: "og:title", content: "Gallery & Trade Fair Calendar | Maison Affluency" },
    { property: "og:description", content: "Collectible design Gallery events and international trade fairs for Maison Affluency partners." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeFairCalendar />
  ),
});
