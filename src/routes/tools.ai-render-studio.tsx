import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeAxonometric } from "@/app/legacyShell";

export const Route = createFileRoute("/tools/ai-render-studio")({
  head: () => ({ meta: [
    { title: "AI Render Studio | Maison Affluency Trade" },
    { name: "description", content: "Create axonometric and photorealistic eye-level interiors with camera-directed architecture and selected client furniture." },
    { property: "og:title", content: "AI Render Studio | Maison Affluency Trade" },
    { property: "og:description", content: "Create axonometric and photorealistic eye-level interiors with camera-directed architecture and selected client furniture." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeAxonometric /></Suspense>
  ),
});