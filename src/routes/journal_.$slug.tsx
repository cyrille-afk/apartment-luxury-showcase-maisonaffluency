import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { JournalArticle, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/journal_/$slug")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><JournalArticle /></Suspense>
  ),
});
