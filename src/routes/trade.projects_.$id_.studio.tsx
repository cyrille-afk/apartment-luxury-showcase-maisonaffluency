import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeProjectStudio } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/projects_/$id_/studio")({
  head: () => ({ meta: [
    { title: "Project Studio | Maison Affluency Trade" },
    { name: "description", content: "Compose your project visual canvas, review specifications and curate pairings in Maison Affluency Project Studio." },
    { property: "og:title", content: "Project Studio | Maison Affluency Trade" },
    { property: "og:description", content: "Review your project composition, specifications and curated pairings." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeProjectStudio /></Suspense>
  ),
});
