import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicDesignerBiography } from "@/app/legacyShell";

export const Route = createFileRoute("/designers_/$slug_/biography")({
  head: ({ params }) => {
    const name = params.slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
    const title = `${name} — Portrait | Maison Affluency`;
    const description = `The full portrait of ${name}: history, craftsmanship and the studio's design philosophy.`;
    return { meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ] };
  },
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicDesignerBiography /></Suspense>
  ),
});
