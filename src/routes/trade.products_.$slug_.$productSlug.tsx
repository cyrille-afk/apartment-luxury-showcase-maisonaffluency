import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, ProductPageContainer } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/products_/$slug_/$productSlug")({
  head: ({ params }) => {
    const name = params.productSlug.split("-").join(" ");
    const title = `${name} — Studio | Maison Affluency`;
    const description = `Explore ${name}, configure its finishes and review specifications in the Maison Affluency Studio.`;
    return { meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ] };
  },
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ProductPageContainer isInsideTradePortal /></Suspense>
  ),
});
