import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead } from "@/lib/pageHead";
import { getProductHead } from "@/lib/pageHead.functions";
import { Suspense } from "react";
import { PageLoadingSkeleton, ProductPageContainer } from "@/app/legacyShell";

export const Route = createFileRoute("/designers_/$slug_/$productSlug")({
  loader: async ({ params }) => {
    try {
      return { seo: await getProductHead({ data: { designerSlug: params.slug, productSlug: params.productSlug } }) };
    } catch {
      return { seo: null };
    }
  },
  head: ({ loaderData }) => (loaderData?.seo ? buildPageHead(loaderData.seo) : {}),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ProductPageContainer isInsideTradePortal={false} /></Suspense>
  ),
});
