import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { CartPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [
    { title: "Your Cart | Maison Affluency" },
    { name: "description", content: "Review your selected Maison Affluency pieces." },
    { property: "og:title", content: "Your Cart | Maison Affluency" },
    { property: "og:description", content: "Review your selected pieces before ordering." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><CartPage /></Suspense>
  ),
});
