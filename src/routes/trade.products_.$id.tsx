import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, ProductPageContainer } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/products_/$id")({
  head: () => ({ meta: [
    { title: "Product Configuration — Studio | Maison Affluency" },
    { name: "description", content: "Configure catalogue finishes and review product specifications in the Maison Affluency Studio." },
    { property: "og:title", content: "Product Configuration — Studio | Maison Affluency" },
    { property: "og:description", content: "Configure catalogue finishes and review product specifications in the Maison Affluency Studio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ProductPageContainer isInsideTradePortal /></Suspense>
  ),
});
