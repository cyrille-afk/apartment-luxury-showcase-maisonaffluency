import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, SharedProcurementBoard } from "@/app/legacyShell";

export const Route = createFileRoute("/shared_/board_/$projectSlug_/$boardSlug")({
  head: () => ({ meta: [
    { title: "Shared Project Folder | Maison Affluency" },
    { name: "description", content: "Review your designer’s selected pieces in a private Maison Affluency project folder." },
    { property: "og:title", content: "Shared Project Folder | Maison Affluency" },
    { property: "og:description", content: "Review your designer’s selected pieces in a private Maison Affluency project folder." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><SharedProcurementBoard /></Suspense>
  ),
});
