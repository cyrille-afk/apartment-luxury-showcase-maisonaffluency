import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Suspense } from "react";
import { PageLoadingSkeleton, PublicGallery } from "@/app/legacyShell";

export const Route = createFileRoute("/gallery")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.gallery),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><PublicGallery /></Suspense>
  ),
});
