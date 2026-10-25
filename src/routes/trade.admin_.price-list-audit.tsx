import { createFileRoute } from "@tanstack/react-router";
import TradeAdminPriceListAudit from "@/pages/TradeAdminPriceListAudit";

export const Route = createFileRoute("/trade/admin_/price-list-audit")({
  head: () => ({
    meta: [
      { title: "Price List Security Audit — Maison Affluency Admin" },
      { name: "description", content: "Admin audit of price list records and storage for remaining public links or files." },
      { property: "og:title", content: "Price List Security Audit — Maison Affluency Admin" },
      { property: "og:description", content: "Admin audit of price list records and storage for remaining public links or files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: TradeAdminPriceListAudit,
});
