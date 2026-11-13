import { createFileRoute } from "@tanstack/react-router";
import { TradeFFESchedule } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/ffe-schedule")({
  head: () => ({
    meta: [
      { title: "FF&E Schedule | Maison Affluency Trade" },
      { name: "description", content: "Review project furniture schedules, quote prices and procurement dates in Maison Affluency Trade." },
      { property: "og:title", content: "FF&E Schedule | Maison Affluency Trade" },
      { property: "og:description", content: "Review project furniture schedules, quote prices and procurement dates in Maison Affluency Trade." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <TradeFFESchedule />
  ),
});
