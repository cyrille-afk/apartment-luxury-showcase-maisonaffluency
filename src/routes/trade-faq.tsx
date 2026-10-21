import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { PageLoadingSkeleton, TradeFaqPage } from "@/app/legacyShell";

export const Route = createFileRoute("/trade-faq")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><TradeFaqPage /></Suspense>
  ),
});
