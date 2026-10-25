import { createFileRoute } from "@tanstack/react-router";
import { TradeComparator } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/comparator")({
  head: () => ({ meta: [
    { title: "Product Comparator — Maison Affluency" },
    { name: "description", content: "Compare catalogue pieces, save project shortlists and prepare detailed comparison PDFs in your studio." },
    { property: "og:title", content: "Product Comparator — Maison Affluency" },
    { property: "og:description", content: "Compare catalogue pieces and prepare project shortlists with recorded materials and dimensions." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <TradeComparator />
  ),
});
