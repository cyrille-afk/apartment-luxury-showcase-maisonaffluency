import { createFileRoute } from "@tanstack/react-router";
import { TradeGallery } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/gallery")({
  head: () => ({ meta: [
    { title: "Trade Gallery — Maison Affluency" },
    { name: "description", content: "Explore pieces and configure finishes for your Maison Affluency trade projects." },
    { property: "og:title", content: "Trade Gallery — Maison Affluency" },
    { property: "og:description", content: "Explore pieces and configure finishes for your trade projects." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeGallery />
  ),
});
