import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { ChatGPTTradeSidebar, PageLoadingSkeleton } from "@/app/legacyShell";

export const Route = createFileRoute("/trade_/concierge_/sidebar")({
  component: () => (
    <Suspense fallback={<PageLoadingSkeleton />}><ChatGPTTradeSidebar /></Suspense>
  ),
});
