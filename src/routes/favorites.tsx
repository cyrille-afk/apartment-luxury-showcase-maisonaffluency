import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicFavorites } from "@/app/legacyShell";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [
    { title: "My Favorites & Folders — Maison Affluency" },
    { name: "description", content: "Your private collection of saved Maison Affluency pieces and folders." },
    { property: "og:title", content: "My Favorites & Folders — Maison Affluency" },
    { property: "og:description", content: "Your private collection of saved Maison Affluency pieces and folders." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicFavorites /></Suspense>
  ),
});
