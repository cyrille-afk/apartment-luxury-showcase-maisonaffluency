import { createFileRoute } from "@tanstack/react-router";
import { TradeDesignersAdmin } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/designers_/admin")({
  head: () => ({ meta: [
    { title: "Designer Editor | Maison Affluency Trade" },
    { name: "description", content: "Manage Maison Affluency designer biographies, editorial media and catalogue pieces." },
    { property: "og:title", content: "Designer Editor | Maison Affluency Trade" },
    { property: "og:description", content: "Manage Maison Affluency designer biographies, editorial media and catalogue pieces." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeDesignersAdmin />
  ),
});
