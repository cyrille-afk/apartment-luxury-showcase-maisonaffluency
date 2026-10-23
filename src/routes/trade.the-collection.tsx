import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { GallerySkeleton, TradeShowroom } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/the-collection")({
  head: () => ({ meta: [
    { title: "The Collection — Maison Affluency Trade" },
    { name: "description", content: "Explore the Interactive Gallery and Designers & Ateliers in your Maison Affluency Trade workspace." },
    { property: "og:title", content: "The Collection — Maison Affluency Trade" },
    { property: "og:description", content: "Browse residential galleries and designer collections in your Trade workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<div className="px-6 py-10"><GallerySkeleton withHeader /></div>}><TradeShowroom /></Suspense>
  ),
});
