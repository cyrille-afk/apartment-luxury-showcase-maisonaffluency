import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, ProductPageContainer } from "@/app/legacyShell";

export const Route = createFileRoute("/trade/products_/$slug_/$productSlug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ProductPageContainer isInsideTradePortal /></Suspense>
  ),
});
