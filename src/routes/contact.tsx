import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Suspense } from "react";
import { ContactPage, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/contact")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.contact),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ContactPage /></Suspense>
  ),
});
