import { createFileRoute } from "@tanstack/react-router";
import { TradeDeliveryTracker } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/delivery-tracker")({
  head: () => ({ meta: [
    { title: "Delivery Tracker | Maison Affluency Trade" },
    { name: "description", content: "Track project deliveries and download delivery reports for your Maison Affluency studio." },
    { property: "og:title", content: "Delivery Tracker | Maison Affluency Trade" },
    { property: "og:description", content: "Track project deliveries and download delivery reports for your Maison Affluency studio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <TradeDeliveryTracker />
  ),
});
