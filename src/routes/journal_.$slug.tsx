import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead } from "@/lib/pageHead";
import { getJournalHead } from "@/lib/pageHead.functions";
import { Suspense } from "react";
import { JournalArticle, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/journal_/$slug")({
  loader: async ({ params }) => {
    try {
      return { seo: await getJournalHead({ data: { slug: params.slug } }) };
    } catch {
      return { seo: null };
    }
  },
  head: ({ loaderData }) => (loaderData?.seo ? buildPageHead(loaderData.seo) : {}),
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><JournalArticle /></Suspense>
  ),
});
