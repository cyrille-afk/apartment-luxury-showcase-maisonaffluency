import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, ProductPage } from "@/app/legacyShell";
import { buildPageHead } from "@/lib/pageHead";
import { getLegacyProductHead } from "@/lib/pageHead.functions";

export const Route = createFileRoute("/product_/$id")({
  loader: async ({ params }) => ({ seo: await getLegacyProductHead({ data: { id: params.id } }) }),
  head: ({ loaderData, params }) => loaderData?.seo ? buildPageHead(loaderData.seo) : buildPageHead({
    title: "Product Collection — Maison Affluency",
    description: "Explore collectible furniture and lighting in Maison Affluency's curated collection of designers and ateliers.",
    path: `/product/${params.id}`,
  }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ProductPage /></Suspense>
  ),
});
