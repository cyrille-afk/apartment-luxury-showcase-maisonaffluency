import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Suspense } from "react";
import { Journal, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/journal")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.journal),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><Journal /></Suspense>
  ),
});
