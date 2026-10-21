import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicDesigners } from "@/app/legacyShell";

export const Route = createFileRoute("/designers")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.designers),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicDesigners /></Suspense>
  ),
});
