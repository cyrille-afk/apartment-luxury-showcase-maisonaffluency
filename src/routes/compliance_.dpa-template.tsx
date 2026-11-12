import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DpaTemplate, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/compliance_/dpa-template")({
  head: () => ({ meta: [
    { title: "Supplier DPA Template | Maison Affluency" },
    { name: "description", content: "Supplier data processing agreement and downloadable contractual terms for Maison Affluency." },
    { property: "og:title", content: "Supplier DPA Template | Maison Affluency" },
    { property: "og:description", content: "Supplier data processing agreement and downloadable contractual terms for Maison Affluency." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ] }),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><DpaTemplate /></Suspense>
  ),
});
