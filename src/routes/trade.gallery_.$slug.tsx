import { createFileRoute } from "@tanstack/react-router";
import { TradeGallery } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/gallery_/$slug")({
  head: ({ params }) => ({ meta: [
    { title: `${params.slug.replace(/-/g, " ")} — Trade Gallery — Maison Affluency` },
    { name: "description", content: "Discover this atelier’s pieces, select finishes and save them to your project moodboard." },
    { property: "og:title", content: `${params.slug.replace(/-/g, " ")} — Maison Affluency Trade` },
    { property: "og:description", content: "Discover atelier pieces, configure finishes and prepare your project quote." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <TradeGallery />
  ),
});
