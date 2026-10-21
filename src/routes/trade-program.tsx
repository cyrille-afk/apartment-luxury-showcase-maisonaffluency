import { createFileRoute } from "@tanstack/react-router";
import { buildPageHead, STATIC_PAGE_HEADS } from "@/lib/pageHead";
import { Suspense } from "react";
import { TradeLanding } from "@/app/legacyShell";

export const Route = createFileRoute("/trade-program")({
  head: () => buildPageHead(STATIC_PAGE_HEADS.tradeProgram),
  component: () => (
    <Suspense fallback={null}><TradeLanding /></Suspense>
  ),
});
