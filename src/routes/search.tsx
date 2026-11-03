import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, RoomSearch } from "@/app/legacyShell";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [
    { title: "Search the Collection | Maison Affluency" },
    { name: "description", content: "Search Maison Affluency’s curated designers and collectible furniture." },
    { property: "og:title", content: "Search the Collection | Maison Affluency" },
    { property: "og:description", content: "Discover designers and pieces in the Maison Affluency collection." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, follow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><RoomSearch /></Suspense>
  ),
});
