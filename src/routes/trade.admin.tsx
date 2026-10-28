import { createFileRoute } from "@tanstack/react-router";
import { TradeAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/admin")({
  head: () => ({ meta: [
    { title: "Administration | Maison Affluency Trade" },
    { name: "description", content: "Review Maison Affluency Trade applications and saved product price changes." },
    { property: "og:title", content: "Administration | Maison Affluency Trade" },
    { property: "og:description", content: "Review Maison Affluency Trade applications and saved product price changes." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeAdmin />
  ),
});
