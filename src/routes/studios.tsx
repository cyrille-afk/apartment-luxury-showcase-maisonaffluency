import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, Studios } from "@/app/legacyShell";

export const Route = createFileRoute("/studios")({
  head: () => ({ meta: [
    { title: "Interior Design Studios | Maison Affluency" },
    { name: "description", content: "Explore interior design studios, collectible furniture and the Maison Affluency Gallery." },
    { property: "og:title", content: "Interior Design Studios | Maison Affluency" },
    { property: "og:description", content: "Explore interior design studios, collectible furniture and the Maison Affluency Gallery." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><Studios /></Suspense>
  ),
});
