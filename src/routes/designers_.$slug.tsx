import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicDesignerProfile } from "@/app/legacyShell";
import { getDesignerHead } from "@/lib/designerSeo.functions";

export const Route = createFileRoute("/designers_/$slug")({
  // Server-rendered per-designer preview tags; a lookup failure must never block the page.
  loader: async ({ params }) => {
    try {
      return { seo: await getDesignerHead({ data: { slug: params.slug } }) };
    } catch {
      return { seo: null };
    }
  },
  head: ({ loaderData }) => {
    const seo = loaderData?.seo;
    if (!seo) return {};
    return {
      meta: [
        { title: seo.seoTitle },
        { name: "description", content: seo.description },
        { property: "og:type", content: seo.type },
        { property: "og:site_name", content: "Maison Affluency" },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: seo.url },
        { property: "og:image", content: seo.image },
        { property: "og:image:secure_url", content: seo.image },
        ...(seo.imageType ? [{ property: "og:image:type", content: seo.imageType }] : []),
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: seo.imageAlt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: seo.title },
        { name: "twitter:description", content: seo.description },
        { name: "twitter:image", content: seo.image },
      ],
      links: [{ rel: "canonical", href: seo.url }],
    };
  },
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerProfile /></Suspense>
  ),
});
