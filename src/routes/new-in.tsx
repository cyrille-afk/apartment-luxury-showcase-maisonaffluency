import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Suspense } from "react";
import { NewIn, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/new-in")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.newIn),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><NewIn /></Suspense>
  ),
});
